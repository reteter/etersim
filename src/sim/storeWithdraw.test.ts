import { describe, expect, it } from "vitest";
import { applyCommand } from "./commands";
import { amountOf, storeOf } from "./goodsStore";
import { STOREHOUSE_CAPACITY } from "./storehouse";
import { tick } from "./tick";
import { createWorld, type World } from "./world";

/**
 * E13 (#100, docs/specs/E13-guild-buildings.md — "The Granary: storage as a
 * new optimization axis"; §Testing — "store/withdraw: capacity clamp, hold
 * clamp, goods-filter rejection, best-effort zero-quantity no-ops,
 * route-order and manual-command parity"). `storeGood`/`withdrawGood`
 * Commands + the matching Route `store`/`withdraw` Stop orders.
 */

/** A World with an activated agrarian Storehouse (Granary), s0 docked at
 *  its port, with the given cargo/store contents. */
function withActiveStorehouse(opts: {
  cargo?: Partial<Record<string, number>>;
  store?: Partial<Record<string, number>>;
  hold?: number;
}): World {
  const w0 = createWorld("store-withdraw-fixture");
  const portId = w0.region.ports.find((p) => p.archetype === "agrarian")!.id;
  const ship = {
    ...w0.company.ships[0],
    location: { kind: "docked" as const, portId },
    hold: opts.hold ?? w0.company.ships[0].hold,
    cargo: storeOf(opts.cargo ?? {}),
  };
  return {
    ...w0,
    company: {
      ...w0.company,
      ships: [ship],
      buildings: [{ type: "storehouse", variant: "agrarian", portId, store: storeOf(opts.store ?? {}) }],
    },
  };
}

function storehousePortId(w: World): string {
  return w.company.buildings[0].portId;
}

describe("storeGood command", () => {
  it("moves cargo into the Storehouse and appends a `store` event with the qty actually moved", () => {
    const w = withActiveStorehouse({ cargo: { grain: 15 } });
    const after = applyCommand(w, { kind: "storeGood", shipId: "s0", good: "grain" });
    expect(amountOf(after.company.ships[0].cargo, "grain")).toBe(0);
    expect(amountOf(after.company.buildings[0].store, "grain")).toBe(15);
    expect(after.ledger[after.ledger.length - 1]).toEqual({
      kind: "store",
      tick: w.tick,
      shipId: "s0",
      portId: storehousePortId(w),
      good: "grain",
      qty: 15,
    });
  });

  it("clamps at STOREHOUSE_CAPACITY, leaving the remainder aboard", () => {
    const w = withActiveStorehouse({ cargo: { grain: 30 }, store: { grain: STOREHOUSE_CAPACITY - 10 } });
    const after = applyCommand(w, { kind: "storeGood", shipId: "s0", good: "grain" });
    expect(amountOf(after.company.buildings[0].store, "grain")).toBe(STOREHOUSE_CAPACITY);
    expect(amountOf(after.company.ships[0].cargo, "grain")).toBe(20); // 30 - 10 accepted
  });

  it("rejects a good outside the goods filter (Granary: grain only) — no-op, no event", () => {
    const w = withActiveStorehouse({ cargo: { textiles: 10 } });
    const after = applyCommand(w, { kind: "storeGood", shipId: "s0", good: "textiles" });
    expect(after).toBe(w);
  });

  it("is a best-effort no-op with nothing to store (zero cargo) — no event", () => {
    const w = withActiveStorehouse({ cargo: {} });
    const after = applyCommand(w, { kind: "storeGood", shipId: "s0", good: "grain" });
    expect(after).toBe(w);
  });

  it("is a no-op when the ship isn't docked at a port with a Storehouse", () => {
    const w0 = withActiveStorehouse({ cargo: { grain: 10 } });
    const elsewhere = w0.region.ports.find((p) => p.id !== storehousePortId(w0))!.id;
    const w = {
      ...w0,
      company: {
        ...w0.company,
        ships: [{ ...w0.company.ships[0], location: { kind: "docked" as const, portId: elsewhere } }],
      },
    };
    expect(applyCommand(w, { kind: "storeGood", shipId: "s0", good: "grain" })).toBe(w);
  });
});

describe("withdrawGood command", () => {
  it("moves goods from the Storehouse into cargo and appends a `withdraw` event", () => {
    const w = withActiveStorehouse({ store: { grain: 20 } });
    const after = applyCommand(w, { kind: "withdrawGood", shipId: "s0", good: "grain" });
    expect(amountOf(after.company.buildings[0].store, "grain")).toBe(0);
    expect(amountOf(after.company.ships[0].cargo, "grain")).toBe(20);
    expect(after.ledger[after.ledger.length - 1]).toEqual({
      kind: "withdraw",
      tick: w.tick,
      shipId: "s0",
      portId: storehousePortId(w),
      good: "grain",
      qty: 20,
    });
  });

  it("clamps at the ship's remaining Hold space", () => {
    const w = withActiveStorehouse({ store: { grain: 30 }, cargo: { textiles: 45 }, hold: 50 });
    const after = applyCommand(w, { kind: "withdrawGood", shipId: "s0", good: "grain" });
    expect(amountOf(after.company.ships[0].cargo, "grain")).toBe(5); // 50 - 45 hold space
    expect(amountOf(after.company.buildings[0].store, "grain")).toBe(25);
  });

  it("is a best-effort no-op with nothing stored — no event", () => {
    const w = withActiveStorehouse({});
    const after = applyCommand(w, { kind: "withdrawGood", shipId: "s0", good: "grain" });
    expect(after).toBe(w);
  });
});

describe("route-order and manual-command parity (E9 equivalence)", () => {
  it("a Route's store/withdraw Stop orders produce the exact same state as the equivalent manual Commands", () => {
    const manual = (() => {
      let w = withActiveStorehouse({ cargo: { grain: 12 } });
      w = applyCommand(w, { kind: "storeGood", shipId: "s0", good: "grain" });
      w = applyCommand(w, { kind: "withdrawGood", shipId: "s0", good: "grain" });
      return w;
    })();

    const routed = (() => {
      const w0 = withActiveStorehouse({ cargo: { grain: 12 } });
      const portId = storehousePortId(w0);
      const otherPortId = w0.region.ports.find((p) => p.id !== portId)!.id;
      const route = {
        id: "r-store-withdraw",
        name: "storehouse loop",
        stops: [
          { portId, orders: [{ kind: "store" as const, good: "grain" as const }, { kind: "withdraw" as const, good: "grain" as const }] },
          { portId: otherPortId, orders: [{ kind: "buy" as const, good: "timber" as const }] },
        ],
      };
      let w: World = { ...w0, company: { ...w0.company, routes: [route] } };
      w = applyCommand(w, { kind: "assignRoute", shipId: "s0", routeId: route.id });
      w = tick(w, []); // ship is already docked at the first Stop's port -> executes immediately
      return w;
    })();

    expect(amountOf(routed.company.ships[0].cargo, "grain")).toBe(amountOf(manual.company.ships[0].cargo, "grain"));
    expect(amountOf(routed.company.buildings[0].store, "grain")).toBe(
      amountOf(manual.company.buildings[0].store, "grain"),
    );
    // Both events fired in the same order, same kinds.
    const kindsOf = (w: World) => w.ledger.map((e) => e.kind).filter((k) => k === "store" || k === "withdraw");
    expect(kindsOf(routed)).toEqual(kindsOf(manual));
  });
});
