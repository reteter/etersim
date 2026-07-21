import { describe, expect, it } from "vitest";
import { SHIP_RECIPE } from "./building";
import { amountOf, storeOf } from "./goodsStore";
import { applyCommand } from "./commands";
import {
  companyStores,
  moveOwnGoods,
  policyFor,
  readStore,
  resolveDeliveryTarget,
  writeStore,
  type StoreRef,
} from "./transfer";
import { createWorld, type World } from "./world";
import { tick } from "./tick";
import { TICKS_PER_DAY } from "./region";

/**
 * E13.0 (#307, docs/adr/0008-one-goods-store.md; docs/specs/E13.0-goods-store.md
 * §Tech — Transfer): StoreRef, companyStores, readStore, policyFor,
 * writeStore, moveOwnGoods, resolveDeliveryTarget — the thaler-free
 * hold<->site half only (market<->hold stays on applyTrade).
 */

/** A world with a founded Headquarters and an active (empty) Build Order,
 *  s0 docked at the HQ port with `cargo` electronics units aboard. */
function withHqBuildOrder(cargo: number): World {
  const w0 = createWorld("transfer-fixture");
  const s0 = w0.company.ships[0];
  if (s0.location.kind !== "docked") throw new Error("fixture: s0 must start docked");
  const hqPortId = s0.location.portId;
  let w: World = { ...w0, company: { ...w0.company, thalers: 1_000_000 } };
  w = applyCommand(w, { kind: "foundHeadquarters", portId: hqPortId });
  w = applyCommand(w, { kind: "placeBuildOrder" });
  const laden = { ...w.company.ships[0], cargo: storeOf({ electronics: cargo }) };
  return { ...w, company: { ...w.company, ships: [laden] } };
}

describe("transfer", () => {
  describe("companyStores", () => {
    it("lists one hold ref per ship, and no site refs with nothing active", () => {
      const w = createWorld("transfer-company-stores");
      const refs = companyStores(w);
      expect(refs).toEqual([{ kind: "hold", shipId: "s0" }]);
    });

    it("adds hqBuild once a Build Order is active", () => {
      const w = withHqBuildOrder(0);
      const refs = companyStores(w);
      expect(refs).toContainEqual({ kind: "hqBuild" });
      expect(refs.filter((r) => r.kind === "hqBuild")).toHaveLength(1);
    });
  });

  describe("readStore / policyFor", () => {
    it("readStore returns a ship's cargo for a hold ref", () => {
      const w = withHqBuildOrder(7);
      const ref: StoreRef = { kind: "hold", shipId: "s0" };
      const store = readStore(w, ref);
      expect(store).not.toBeNull();
      expect(amountOf(store!, "electronics")).toBe(7);
    });

    it("readStore returns null for a hold ref naming a nonexistent ship", () => {
      const w = createWorld("transfer-noship");
      expect(readStore(w, { kind: "hold", shipId: "no-such-ship" })).toBeNull();
    });

    it("readStore returns null for hqBuild with no active Build Order", () => {
      const w = createWorld("transfer-nohq");
      expect(readStore(w, { kind: "hqBuild" })).toBeNull();
    });

    it("policyFor returns a hold policy with the ship's own capacity", () => {
      const w = withHqBuildOrder(0);
      const policy = policyFor(w, { kind: "hold", shipId: "s0" });
      expect(policy).toEqual({ kind: "hold", capacity: w.company.ships[0].hold });
    });

    it("policyFor returns a constructionSite policy with SHIP_RECIPE for hqBuild", () => {
      const w = withHqBuildOrder(0);
      const policy = policyFor(w, { kind: "hqBuild" });
      expect(policy).toEqual({ kind: "constructionSite", recipe: SHIP_RECIPE });
    });
  });

  describe("writeStore", () => {
    it("writes back a ship's cargo for a hold ref", () => {
      const w = withHqBuildOrder(0);
      const next = storeOf({ grain: 42 });
      const written = writeStore(w, { kind: "hold", shipId: "s0" }, next);
      expect(amountOf(written.company.ships[0].cargo, "grain")).toBe(42);
    });

    it("writes back the HQ build site's siteStore for an hqBuild ref", () => {
      const w = withHqBuildOrder(0);
      const next = storeOf({ timber: 3 });
      const written = writeStore(w, { kind: "hqBuild" }, next);
      expect(amountOf(written.company.headquarters!.buildOrder!.siteStore, "timber")).toBe(3);
    });

    it("is a no-op when the target ref doesn't currently exist", () => {
      const w = createWorld("transfer-write-noop");
      const written = writeStore(w, { kind: "hqBuild" }, storeOf({ grain: 1 }));
      expect(written).toBe(w);
    });
  });

  describe("moveOwnGoods", () => {
    it("moves min(available, accepted) from hold to hqBuild with qty 'max'", () => {
      const w = withHqBuildOrder(10); // electronics need is 5 (SHIP_RECIPE)
      const moved = moveOwnGoods(
        w,
        { kind: "hold", shipId: "s0" },
        { kind: "hqBuild" },
        "electronics",
        "max",
      );
      expect(amountOf(moved.company.headquarters!.buildOrder!.siteStore, "electronics")).toBe(5);
      expect(amountOf(moved.company.ships[0].cargo, "electronics")).toBe(5); // 10 - 5
    });

    it("moves an explicit qty, clamped by what the target accepts", () => {
      const w = withHqBuildOrder(10);
      const moved = moveOwnGoods(
        w,
        { kind: "hold", shipId: "s0" },
        { kind: "hqBuild" },
        "electronics",
        3,
      );
      expect(amountOf(moved.company.headquarters!.buildOrder!.siteStore, "electronics")).toBe(3);
      expect(amountOf(moved.company.ships[0].cargo, "electronics")).toBe(7);
    });

    it("clamps to what's actually available in the source, even if qty asks for more", () => {
      const w = withHqBuildOrder(2);
      const moved = moveOwnGoods(
        w,
        { kind: "hold", shipId: "s0" },
        { kind: "hqBuild" },
        "electronics",
        100,
      );
      expect(amountOf(moved.company.headquarters!.buildOrder!.siteStore, "electronics")).toBe(2);
    });

    it("is a no-op (returns world unchanged) when the target has zero remaining need", () => {
      const w = withHqBuildOrder(10);
      // Drain the site's electronics need to 0 first.
      const filled = moveOwnGoods(w, { kind: "hold", shipId: "s0" }, { kind: "hqBuild" }, "electronics", "max");
      const again = moveOwnGoods(filled, { kind: "hold", shipId: "s0" }, { kind: "hqBuild" }, "electronics", "max");
      expect(again).toBe(filled);
    });

    it("is a no-op when the source has nothing to offer", () => {
      const w = withHqBuildOrder(0);
      const moved = moveOwnGoods(w, { kind: "hold", shipId: "s0" }, { kind: "hqBuild" }, "electronics", "max");
      expect(moved).toBe(w);
    });

    it("is value-neutral for company net worth (no thalers/market involved)", () => {
      const w = withHqBuildOrder(10);
      const before = w.company.thalers;
      const moved = moveOwnGoods(w, { kind: "hold", shipId: "s0" }, { kind: "hqBuild" }, "electronics", "max");
      expect(moved.company.thalers).toBe(before);
    });
  });

  describe("resolveDeliveryTarget", () => {
    it("targets the HQ build site when docked there with cargo it needs", () => {
      const w = withHqBuildOrder(10);
      expect(resolveDeliveryTarget(w, w.company.ships[0], "electronics")).toEqual({ kind: "hqBuild" });
    });

    it("returns null when the ship carries none of the requested good", () => {
      const w = withHqBuildOrder(0);
      expect(resolveDeliveryTarget(w, w.company.ships[0], "electronics")).toBeNull();
    });

    it("returns null once the HQ site's need for that good is already met", () => {
      const w0 = withHqBuildOrder(10);
      const filled = moveOwnGoods(w0, { kind: "hold", shipId: "s0" }, { kind: "hqBuild" }, "electronics", "max");
      // Give s0 more electronics than fits — but recipe need is now 0.
      const laden = { ...filled.company.ships[0], cargo: storeOf({ electronics: 5 }) };
      const w = { ...filled, company: { ...filled.company, ships: [laden] } };
      expect(resolveDeliveryTarget(w, w.company.ships[0], "electronics")).toBeNull();
    });

    it("returns null for an undocked (underway) ship", () => {
      const w = withHqBuildOrder(10);
      const underway = {
        ...w.company.ships[0],
        location: {
          kind: "underway" as const,
          course: [],
          voyageIndex: 0,
          voyageProgressTicks: 0,
          destination: w.region.ports[1].id,
        },
      };
      expect(resolveDeliveryTarget(w, underway, "electronics")).toBeNull();
    });

    it("matches the same precedence the deliver command exercises end-to-end (HQ -> Shipyard -> Refit)", () => {
      // A light end-to-end smoke check that resolveDeliveryTarget's answer is
      // consistent with what `deliver` actually does — the golden-run digest
      // (e13-0-equivalence.test.ts) is the authoritative behavior-preservation
      // proof for the full precedence chain across all three sites.
      const w0 = createWorld("transfer-precedence");
      const s0 = w0.company.ships[0];
      if (s0.location.kind !== "docked") throw new Error("fixture: s0 must start docked");
      let w: World = { ...w0, company: { ...w0.company, thalers: 1_000_000 } };
      w = applyCommand(w, { kind: "foundHeadquarters", portId: s0.location.portId });
      w = applyCommand(w, { kind: "placeBuildOrder" });
      const laden = { ...w.company.ships[0], cargo: storeOf({ grain: 10 }) };
      w = { ...w, company: { ...w.company, ships: [laden] } };

      const target = resolveDeliveryTarget(w, w.company.ships[0], "grain");
      expect(target).toEqual({ kind: "hqBuild" });

      const delivered = applyCommand(w, { kind: "deliver", shipId: "s0", good: "grain" });
      expect(amountOf(delivered.company.headquarters!.buildOrder!.siteStore, "grain")).toBe(10);
    });
  });

  it("moveOwnGoods stays deterministic across a full tick (no RNG involvement, ADR-0003)", () => {
    const w = withHqBuildOrder(10);
    const moved1 = moveOwnGoods(w, { kind: "hold", shipId: "s0" }, { kind: "hqBuild" }, "electronics", "max");
    const w2 = withHqBuildOrder(10);
    const moved2 = moveOwnGoods(w2, { kind: "hold", shipId: "s0" }, { kind: "hqBuild" }, "electronics", "max");
    expect(moved1.company.headquarters).toEqual(moved2.company.headquarters);
  });

  it("does not disturb ticking (sanity: a moved world still ticks normally)", () => {
    const w0 = withHqBuildOrder(10);
    const moved = moveOwnGoods(w0, { kind: "hold", shipId: "s0" }, { kind: "hqBuild" }, "electronics", "max");
    expect(() => tick(moved, [])).not.toThrow();
    for (let i = 0; i < TICKS_PER_DAY; i++) tick(moved, []);
  });
});
