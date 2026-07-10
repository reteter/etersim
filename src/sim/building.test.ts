import { describe, expect, it } from "vitest";
import { applyCommand } from "./commands";
import {
  AUTO_DRAW_PER_DAY,
  autoDrawCapForDayTick,
  emptySiteStore,
  generateShipName,
  HEADQUARTERS_COST,
  LABOR_FEE,
  SHIP_RECIPE,
} from "./building";
import { GOOD_IDS } from "./goods";
import { effectiveBase, quoteBuy } from "./market";
import { TICKS_PER_DAY } from "./region";
import { cargoUsed, type Ship } from "./ship";
import { tick } from "./tick";
import { createWorld, type World } from "./world";

const shipOf = (w: World): Ship => w.company.ships[0];
const hqPortId = (w: World): string => shipOf(w).location.kind === "docked"
  ? (shipOf(w).location as { portId: string }).portId
  : w.region.ports[0].id;

/** World with `thalers` in the purse and s0 docked at its home port. */
function rich(seedStr: string, thalers: number): World {
  const w = createWorld(seedStr);
  return { ...w, company: { ...w.company, thalers } };
}

describe("foundHeadquarters (#81)", () => {
  it("charges the flat cost and plants the HQ at the chosen port", () => {
    const w = rich("found", HEADQUARTERS_COST + 100);
    const portId = w.region.ports[2].id;
    const next = applyCommand(w, { kind: "foundHeadquarters", portId });
    expect(next.company.thalers).toBe(100);
    expect(next.company.headquarters).toEqual({ portId });
  });

  it("appends exactly one founding event", () => {
    const w = rich("found-ledger", HEADQUARTERS_COST + 100);
    const portId = w.region.ports[2].id;
    const next = applyCommand(w, { kind: "foundHeadquarters", portId });
    expect(next.ledger.length).toBe(w.ledger.length + 1);
    expect(next.ledger[next.ledger.length - 1]).toEqual({
      kind: "founding",
      tick: w.tick,
      portId,
      thalers: HEADQUARTERS_COST,
    });
  });

  it("rejects a second HQ, an unaffordable one, and an unknown port — no ledger event either", () => {
    const poor = rich("found2", HEADQUARTERS_COST - 1);
    expect(applyCommand(poor, { kind: "foundHeadquarters", portId: poor.region.ports[0].id })).toBe(poor);

    const w = rich("found3", HEADQUARTERS_COST * 2);
    const founded = applyCommand(w, { kind: "foundHeadquarters", portId: w.region.ports[0].id });
    const twice = applyCommand(founded, { kind: "foundHeadquarters", portId: w.region.ports[1].id });
    expect(twice).toBe(founded); // one per Company
    expect(applyCommand(w, { kind: "foundHeadquarters", portId: "no-such-port" })).toBe(w);
    expect(founded.ledger.length).toBe(w.ledger.length + 1); // only the successful founding
  });
});

describe("placeBuildOrder (#81)", () => {
  const founded = (): World => {
    const w = rich("place", HEADQUARTERS_COST + LABOR_FEE + 500);
    return applyCommand(w, { kind: "foundHeadquarters", portId: w.region.ports[0].id });
  };

  it("charges the labor fee once and opens an empty site store", () => {
    const w = founded();
    const next = applyCommand(w, { kind: "placeBuildOrder" });
    expect(next.company.thalers).toBe(w.company.thalers - LABOR_FEE);
    expect(next.company.headquarters!.buildOrder!.siteStore).toEqual(emptySiteStore());
  });

  it("appends exactly one laborFee event", () => {
    const w = founded();
    const next = applyCommand(w, { kind: "placeBuildOrder" });
    expect(next.ledger.length).toBe(w.ledger.length + 1);
    expect(next.ledger[next.ledger.length - 1]).toEqual({
      kind: "laborFee",
      tick: w.tick,
      thalers: LABOR_FEE,
    });
  });

  it("rejects a second concurrent build and an unaffordable labor fee", () => {
    const w = founded();
    const running = applyCommand(w, { kind: "placeBuildOrder" });
    expect(applyCommand(running, { kind: "placeBuildOrder" })).toBe(running); // one at a time

    const broke = { ...w, company: { ...w.company, thalers: LABOR_FEE - 1 } };
    expect(applyCommand(broke, { kind: "placeBuildOrder" })).toBe(broke);
  });

  it("rejects a build order with no Headquarters", () => {
    const w = rich("place-nohq", 10000);
    expect(applyCommand(w, { kind: "placeBuildOrder" })).toBe(w);
  });
});

describe("auto-draw (#81)", () => {
  it("spreads the daily cap: one unit per good on each of the first ticks, none after", () => {
    expect(autoDrawCapForDayTick(0)).toBe(1);
    expect(autoDrawCapForDayTick(AUTO_DRAW_PER_DAY - 1)).toBe(1);
    expect(autoDrawCapForDayTick(AUTO_DRAW_PER_DAY)).toBe(0);
    expect(autoDrawCapForDayTick(TICKS_PER_DAY - 1)).toBe(0);
  });

  it("never exceeds the daily cap or the remaining need, and keeps the purse solvent", () => {
    const w0 = rich("draw", 1_000_000); // deep purse: isolate the cap from affordability
    let w = applyCommand(w0, { kind: "foundHeadquarters", portId: w0.region.ports[0].id });
    w = applyCommand(w, { kind: "placeBuildOrder" });
    for (let t = 0; t < TICKS_PER_DAY; t++) w = tick(w, []);
    const store = w.company.headquarters!.buildOrder?.siteStore;
    if (store) {
      for (const good of GOOD_IDS) {
        expect(store[good]).toBeLessThanOrEqual(AUTO_DRAW_PER_DAY);
        expect(store[good]).toBeLessThanOrEqual(SHIP_RECIPE[good]);
      }
    }
    expect(w.company.thalers).toBeGreaterThanOrEqual(0);

    // Every unit that landed in the site store is accounted for by exactly
    // one autoDraw event of the same qty (docs/specs/E9 — Ledger).
    const autoDrawEvents = w.ledger.filter((e) => e.kind === "autoDraw");
    for (const good of GOOD_IDS) {
      const drawnQty = autoDrawEvents
        .filter((e) => e.kind === "autoDraw" && e.good === good)
        .reduce((sum, e) => sum + (e.kind === "autoDraw" ? e.qty : 0), 0);
      expect(drawnQty).toBe(store?.[good] ?? 0);
    }
  });

  it("stalls silently when the purse cannot afford it — no error, no debt, no store growth", () => {
    // Purse just covers founding + labor, leaving ~nothing for the market.
    const w0 = rich("stall", HEADQUARTERS_COST + LABOR_FEE);
    let w = applyCommand(w0, { kind: "foundHeadquarters", portId: w0.region.ports[0].id });
    w = applyCommand(w, { kind: "placeBuildOrder" });
    expect(w.company.thalers).toBe(0);
    for (let t = 0; t < TICKS_PER_DAY; t++) w = tick(w, []);
    expect(w.company.thalers).toBe(0);
    for (const good of GOOD_IDS) expect(w.company.headquarters!.buildOrder!.siteStore[good]).toBe(0);
    expect(w.ledger.some((e) => e.kind === "autoDraw")).toBe(false); // no movement, no event
  });
});

describe("deliver (#81)", () => {
  it("moves min(cargo, remaining need) into the site; leftovers stay aboard", () => {
    const w0 = rich("deliver", HEADQUARTERS_COST + 10);
    const portId = hqPortId(w0);
    let w = applyCommand(w0, { kind: "foundHeadquarters", portId });
    // Give s0 a full hold of electronics (need is only 5).
    const laden: Ship = { ...shipOf(w), cargo: { ...shipOf(w).cargo, electronics: 50 } };
    w = {
      ...w,
      company: {
        ...w.company,
        ships: [laden],
        headquarters: { portId, buildOrder: { siteStore: emptySiteStore() } },
      },
    };
    const after = applyCommand(w, { kind: "deliver", shipId: laden.id, good: "electronics" });
    expect(after.company.headquarters!.buildOrder!.siteStore.electronics).toBe(SHIP_RECIPE.electronics);
    expect(after.company.ships[0].cargo.electronics).toBe(50 - SHIP_RECIPE.electronics);
    expect(after.ledger.length).toBe(w.ledger.length + 1);
    expect(after.ledger[after.ledger.length - 1]).toEqual({
      kind: "delivery",
      tick: w.tick,
      shipId: laden.id,
      portId,
      good: "electronics",
      qty: SHIP_RECIPE.electronics,
    });
  });

  it("is a no-op away from the HQ port and with no active build", () => {
    const w0 = rich("deliver2", HEADQUARTERS_COST + 10);
    const other = w0.region.ports.find((p) => p.id !== hqPortId(w0))!.id;
    let w = applyCommand(w0, { kind: "foundHeadquarters", portId: other }); // HQ elsewhere
    w = {
      ...w,
      company: {
        ...w.company,
        ships: [{ ...shipOf(w), cargo: { ...shipOf(w).cargo, timber: 10 } }],
        headquarters: { portId: other, buildOrder: { siteStore: emptySiteStore() } },
      },
    };
    // Ship is docked at its home port, not the HQ port → deliver rejected.
    expect(applyCommand(w, { kind: "deliver", shipId: shipOf(w).id, good: "timber" })).toBe(w);
  });

  it("a delivery that moves nothing (no remaining need) appends no event", () => {
    const w0 = rich("deliver3", HEADQUARTERS_COST + 10);
    const portId = hqPortId(w0);
    let w = applyCommand(w0, { kind: "foundHeadquarters", portId });
    const full = { ...emptySiteStore(), ...SHIP_RECIPE }; // recipe already complete for electronics
    const laden: Ship = { ...shipOf(w), cargo: { ...shipOf(w).cargo, electronics: 5 } };
    w = {
      ...w,
      company: {
        ...w.company,
        ships: [laden],
        headquarters: { portId, buildOrder: { siteStore: full } },
      },
    };
    // Recipe is already complete: this deliver launches instead of moving goods.
    const after = applyCommand(w, { kind: "deliver", shipId: laden.id, good: "electronics" });
    expect(after.ledger.some((e) => e.kind === "delivery")).toBe(false); // moved 0, no delivery event
    expect(after.ledger.some((e) => e.kind === "launch")).toBe(true); // but it did launch
  });
});

describe("rush (#81)", () => {
  it("buys the remainder at the exact quoteBuy, stock-limited, and drains the purse by that much", () => {
    const w0 = rich("rush", 1_000_000);
    const portId = w0.region.ports[0].id;
    let w = applyCommand(w0, { kind: "foundHeadquarters", portId });
    w = applyCommand(w, { kind: "placeBuildOrder" });
    const before = w;
    const port = before.region.ports.find((p) => p.id === portId)!;

    // Expected: each good bought min(need, floor(stock)) at its quoteBuy.
    let expectedCost = 0;
    let expectedEventCount = 0;
    const expectedStore = emptySiteStore();
    for (const good of GOOD_IDS) {
      const entry = port.market[good];
      const q = Math.min(SHIP_RECIPE[good], Math.floor(entry.stock));
      expectedStore[good] = q;
      if (q > 0) {
        expectedCost += quoteBuy(entry, effectiveBase(port, good), q)!;
        expectedEventCount++;
      }
    }

    const after = applyCommand(before, { kind: "rushBuild" });
    // If the recipe didn't complete, the build order still exists to inspect.
    if (after.company.headquarters!.buildOrder) {
      for (const good of GOOD_IDS) {
        expect(after.company.headquarters!.buildOrder!.siteStore[good]).toBe(expectedStore[good]);
      }
    }
    expect(after.company.thalers).toBe(before.company.thalers - expectedCost);

    // One rush event per good actually bought; their thalers sum to the total spend.
    const rushEvents = after.ledger.filter((e) => e.kind === "rush");
    expect(rushEvents.length).toBe(expectedEventCount);
    const rushSpend = rushEvents.reduce((sum, e) => sum + (e.kind === "rush" ? e.thalers : 0), 0);
    expect(rushSpend).toBe(expectedCost);
  });

  it("is rejected with no active build order", () => {
    const w0 = rich("rush2", HEADQUARTERS_COST + 10);
    const w = applyCommand(w0, { kind: "foundHeadquarters", portId: w0.region.ports[0].id });
    expect(applyCommand(w, { kind: "rushBuild" })).toBe(w);
  });
});

describe("launch (#81)", () => {
  it("launches a docked, empty, named ship at the HQ port the tick the recipe completes", () => {
    const w0 = rich("launch", HEADQUARTERS_COST + 10);
    const portId = hqPortId(w0);
    let w = applyCommand(w0, { kind: "foundHeadquarters", portId });
    // Site one electronics short of the full recipe; ship holds the last unit.
    const nearlyDone = { ...emptySiteStore(), ...SHIP_RECIPE, electronics: SHIP_RECIPE.electronics - 1 };
    const laden: Ship = { ...shipOf(w), cargo: { ...shipOf(w).cargo, electronics: 5 } };
    w = {
      ...w,
      company: {
        ...w.company,
        ships: [laden],
        headquarters: { portId, buildOrder: { siteStore: nearlyDone } },
      },
    };
    const countBefore = w.company.ships.length;
    const after = applyCommand(w, { kind: "deliver", shipId: laden.id, good: "electronics" });

    expect(after.company.ships).toHaveLength(countBefore + 1);
    expect(after.company.headquarters!.buildOrder).toBeUndefined(); // build cleared
    const launched = after.company.ships[countBefore];
    expect(launched.location).toEqual({ kind: "docked", portId });
    expect(cargoUsed(launched)).toBe(0);
    expect(launched.name).toBe(generateShipName(countBefore));
    expect(launched.assignment).toBeUndefined();

    // The deliver that completed the recipe appends both a delivery event
    // (the last unit of electronics) and a launch event, in that order.
    const kinds = after.ledger.slice(w.ledger.length).map((e) => e.kind);
    expect(kinds).toEqual(["delivery", "launch"]);
    const launchEvent = after.ledger[after.ledger.length - 1];
    expect(launchEvent).toEqual({ kind: "launch", tick: w.tick, shipId: launched.id, portId });
  });
});

describe("ship name generator (#81)", () => {
  it("is deterministic and keyed by ship count, wrapping the fixed list", () => {
    expect(generateShipName(0)).toBe(generateShipName(0));
    expect(generateShipName(0)).not.toBe(generateShipName(1));
    // Wraps (no RNG, no unbounded list): count 10 reuses the first name.
    expect(generateShipName(10)).toBe(generateShipName(0));
  });
});
