import { describe, expect, it } from "vitest";
import { CONSTRUCTION_RESERVE, HEADQUARTERS_COST, SHIP_RECIPE } from "./building";
import { applyCommand } from "./commands";
import { GOOD_IDS } from "./goods";
import type { Route } from "./route";
import { emptyCargo, isRouteActive, type Ship } from "./ship";
import {
  computeRefitRushQuote,
  computeShipyardRushQuote,
  holdLadder,
  isShipyardUnderConstruction,
  isUnderRefit,
  nextHoldStep,
  refitRecipe,
  HOLD_LADDER,
  REFIT_LABOR_FEE,
  REFIT_MATERIAL_FACTOR,
  SHIPYARD_LABOR_FEE,
  SHIPYARD_RECIPE,
} from "./shipyard";
import { tick } from "./tick";
import { createWorld, type World } from "./world";

function ship(hold: number, baseHold = 50): Ship {
  return {
    id: "s0",
    name: "s0",
    hold,
    baseHold,
    cargo: emptyCargo(),
    location: { kind: "docked", portId: "a" },
  };
}

describe("HOLD_LADDER", () => {
  it("is the fixed cumulative multiplier sequence (spec: ×2 -> ×1.5 -> ×1.25)", () => {
    expect(HOLD_LADDER).toEqual([2, 1.5, 1.25]);
  });
});

describe("holdLadder", () => {
  it("computes thresholds for base 50: [100, 150, 188]", () => {
    expect(holdLadder(50)).toEqual([100, 150, 188]);
  });

  it("computes thresholds for a non-multiple-of-4 base where rung 3 needs real rounding: [74, 111, 139]", () => {
    // NOTE on the spec's "never iterated from prior rounded values": with
    // HOLD_LADDER = [2, 1.5, 1.25], the cumulative products through rung 2
    // (×2, ×3) are always exact integer multiples of an integer baseHold, so
    // rungs 1-2 never actually round, and by rung 3 the once-from-base value
    // (baseHold × 3.75) and the iterate-from-rounded value (round(rung2) ×
    // 1.25, where rung2 is already exact) are algebraically identical. For
    // this multiplier set and any integer baseHold, the two schemes cannot
    // diverge — no test can discriminate them. This asserts the documented
    // once-from-base formula as hardcoded literals (an independent oracle,
    // not the implementation's own arithmetic fed back at it).
    expect(holdLadder(37)).toEqual([74, 111, 139]);
  });

  it("has exactly three rungs (three refit levels, then a hard cap)", () => {
    expect(holdLadder(50)).toHaveLength(3);
  });
});

describe("nextHoldStep", () => {
  it("returns the first threshold above the ship's current hold", () => {
    expect(nextHoldStep(ship(50))).toBe(100);
    expect(nextHoldStep(ship(100))).toBe(150);
    expect(nextHoldStep(ship(150))).toBe(188);
  });

  it("returns null once the ship is at or past the ladder cap", () => {
    expect(nextHoldStep(ship(188))).toBeNull();
    expect(nextHoldStep(ship(500))).toBeNull();
  });

  it("returns the first threshold strictly above an off-ladder hold value", () => {
    // A ship somehow between rungs (shouldn't happen in practice, but the
    // predicate is "next threshold strictly above current hold", not
    // "next index in the ladder").
    expect(nextHoldStep(ship(120))).toBe(150);
  });
});

describe("refitRecipe", () => {
  it("scales SHIP_RECIPE by the Hold gained relative to baseHold, rounding up per good", () => {
    // baseHold 50, hold 50 -> next 100: holdGained 50, ratio 50/50 = 1 ->
    // recipe == SHIP_RECIPE (ceil of an exact multiple).
    // Hardcoded literals (independent oracle): 50 -> 100 gains a full baseHold,
    // so the recipe is exactly SHIP_RECIPE at factor 1.0.
    expect(refitRecipe(ship(50))).toEqual({
      grain: 100,
      textiles: 30,
      aetherSalt: 20,
      electronics: 5,
      timber: 12,
    });
  });

  it("scales down for the smaller last step (150 -> 188, holdGained 38): grain 76, textiles 23, aetherSalt 16, electronics 4, timber 10", () => {
    // Hardcoded literals (independent oracle) rather than the same ceil/ratio
    // formula the implementation uses, so a formula bug can't hide behind a
    // test that recomputes it identically.
    expect(refitRecipe(ship(150))).toEqual({
      grain: 76,
      textiles: 23,
      aetherSalt: 16,
      electronics: 4,
      timber: 10,
    });
  });
});

describe("tuning constants", () => {
  it("REFIT_MATERIAL_FACTOR is 1.0", () => {
    expect(REFIT_MATERIAL_FACTOR).toBe(1.0);
  });

  it("REFIT_LABOR_FEE is 500", () => {
    expect(REFIT_LABOR_FEE).toBe(500);
  });

  it("SHIPYARD_LABOR_FEE is a positive flat labor fee (tuning)", () => {
    expect(SHIPYARD_LABOR_FEE).toBeGreaterThan(0);
  });

  it("SHIPYARD_RECIPE has a positive quantity for every good (tuning)", () => {
    for (const good of GOOD_IDS) expect(SHIPYARD_RECIPE[good]).toBeGreaterThan(0);
  });
});

/**
 * Shipyard building + RefitOrder lifecycle (E14 #275; construction-via-site
 * fix #286). `richFounded` gives a world with a Headquarters already founded
 * (required before a Shipyard can be commissioned) and a generous purse.
 */
function richFounded(seedStr: string, thalers: number): World {
  const w = createWorld(seedStr);
  const funded: World = { ...w, company: { ...w.company, thalers } };
  const portId = funded.region.ports[0].id;
  return applyCommand(funded, { kind: "foundHeadquarters", portId });
}

/** Generous flat budget covering the Shipyard's own labor fee plus its full
 *  material Recipe at rush prices (with headroom) — commissioning now opens
 *  a ConstructionSite instead of an instant flat purchase (#286 fix), so
 *  fixtures below fund enough to actually complete construction via rush. */
const SHIPYARD_BUILD_BUDGET = 30_000;

/** Same as `richFounded`, plus a Shipyard commissioned AND completed (rushed
 *  to activation) at the second port — the #286 fix's updated fixture: a
 *  commissioned Shipyard no longer means a *built* one, so downstream Refit
 *  lifecycle tests need it actually finished. */
function richWithShipyard(seedStr: string, thalers: number): World {
  const founded = richFounded(seedStr, thalers);
  const shipyardPortId = founded.region.ports[1].id;
  let w = applyCommand(founded, { kind: "commissionShipyard", portId: shipyardPortId });
  let guard = 0;
  while (w.company.shipyard?.site && guard++ < 500) {
    w = applyCommand(w, { kind: "rushShipyard" });
    if (w.company.shipyard?.site) w = tick(w, []); // let stock/auto-draw cap replenish
  }
  return w;
}

/** Docks s0 at `portId` in place (no travel), matching building.test.ts's pattern. */
function dockShipAt(w: World, portId: string, shipId = w.company.ships[0].id): World {
  return {
    ...w,
    company: {
      ...w.company,
      ships: w.company.ships.map((s) => (s.id === shipId ? { ...s, location: { kind: "docked", portId } } : s)),
    },
  };
}

describe("commissionShipyard (#286)", () => {
  it("requires a Headquarters", () => {
    const w = createWorld("shipyard-nohq");
    const funded: World = { ...w, company: { ...w.company, thalers: SHIPYARD_BUILD_BUDGET } };
    const portId = funded.region.ports[0].id;
    expect(applyCommand(funded, { kind: "commissionShipyard", portId })).toBe(funded);
  });

  it("opens a construction site at the chosen port, charging the labor fee — the building is not built instantly", () => {
    const w = richFounded("shipyard-ok", HEADQUARTERS_COST + SHIPYARD_BUILD_BUDGET);
    const portId = w.region.ports[1].id;
    const next = applyCommand(w, { kind: "commissionShipyard", portId });
    expect(next.company.thalers).toBe(w.company.thalers - SHIPYARD_LABOR_FEE);
    expect(next.company.shipyard).toEqual({
      portId,
      site: { siteStore: Object.fromEntries(GOOD_IDS.map((g) => [g, 0])) },
    });
  });

  it("appends exactly one laborFee event and no shipyardBuilt event yet (not activated)", () => {
    const w = richFounded("shipyard-ledger", HEADQUARTERS_COST + SHIPYARD_BUILD_BUDGET);
    const portId = w.region.ports[1].id;
    const next = applyCommand(w, { kind: "commissionShipyard", portId });
    expect(next.ledger[next.ledger.length - 1]).toEqual({
      kind: "laborFee",
      tick: w.tick,
      thalers: SHIPYARD_LABOR_FEE,
    });
    expect(next.ledger.some((e) => e.kind === "shipyardBuilt")).toBe(false);
  });

  it("rejects a second Shipyard (one per Company, commissioned or built) and an unaffordable one — no ledger event either", () => {
    const w = richFounded("shipyard-second", HEADQUARTERS_COST + SHIPYARD_BUILD_BUDGET);
    const commissioned = applyCommand(w, { kind: "commissionShipyard", portId: w.region.ports[1].id });
    const twice = applyCommand(commissioned, { kind: "commissionShipyard", portId: w.region.ports[2].id });
    expect(twice).toBe(commissioned);

    const poor = richFounded("shipyard-poor", HEADQUARTERS_COST + SHIPYARD_LABOR_FEE + CONSTRUCTION_RESERVE - 1);
    expect(applyCommand(poor, { kind: "commissionShipyard", portId: poor.region.ports[1].id })).toBe(poor);
  });
});

describe("scarcity: one active Build Order per Company, ship or building (#286, E13 spec)", () => {
  it("rejects commissionShipyard while a ship Build Order is active at the Headquarters", () => {
    const w0 = createWorld("scarcity-ship-then-yard");
    let w: World = { ...w0, company: { ...w0.company, thalers: HEADQUARTERS_COST + SHIPYARD_BUILD_BUDGET } };
    w = applyCommand(w, { kind: "foundHeadquarters", portId: w.region.ports[0].id });
    w = applyCommand(w, { kind: "placeBuildOrder" });
    expect(w.company.headquarters?.buildOrder).toBeDefined();
    const rejected = applyCommand(w, { kind: "commissionShipyard", portId: w.region.ports[1].id });
    expect(rejected).toBe(w);
  });

  it("rejects placeBuildOrder while the Shipyard's own construction site is active", () => {
    const w0 = createWorld("scarcity-yard-then-ship");
    let w: World = { ...w0, company: { ...w0.company, thalers: HEADQUARTERS_COST + SHIPYARD_BUILD_BUDGET } };
    w = applyCommand(w, { kind: "foundHeadquarters", portId: w.region.ports[0].id });
    w = applyCommand(w, { kind: "commissionShipyard", portId: w.region.ports[1].id });
    expect(w.company.shipyard?.site).toBeDefined();
    const rejected = applyCommand(w, { kind: "placeBuildOrder" });
    expect(rejected).toBe(w);
  });

  it("does not reject placeBuildOrder once the Shipyard has activated (site cleared)", () => {
    const w = richWithShipyard("scarcity-yard-done", HEADQUARTERS_COST + SHIPYARD_BUILD_BUDGET + 10_000);
    expect(w.company.shipyard?.site).toBeUndefined();
    const placed = applyCommand(w, { kind: "placeBuildOrder" });
    expect(placed.company.headquarters?.buildOrder).toBeDefined();
  });
});

describe("Shipyard construction auto-draw/deliver/rush (#286)", () => {
  it("fills the Shipyard's own site over ticks, same cadence/cap as the HQ site, and stalls at the Reserve", () => {
    const w0 = richFounded("yard-autodraw", HEADQUARTERS_COST + 1_000_000);
    let w = applyCommand(w0, { kind: "commissionShipyard", portId: w0.region.ports[1].id });
    for (let t = 0; t < 24; t++) w = tick(w, []);
    expect(w.company.thalers).toBeGreaterThanOrEqual(CONSTRUCTION_RESERVE);
    const store = w.company.shipyard?.site?.siteStore;
    // The recipe totals far more than 24 units across all goods, so the site
    // must still be under construction — assert it exists rather than a
    // guarded `if (store)`, which would pass vacuously (and silently stop
    // checking anything) if the site had already cleared (incident 0005).
    expect(store).toBeDefined();
    for (const good of GOOD_IDS) expect(store![good]).toBeLessThanOrEqual(24);
    expect(w.ledger.some((e) => e.kind === "autoDraw")).toBe(true);
  });

  it("stalls silently at the Reserve — no dip below it, no site growth", () => {
    const w0 = richFounded("yard-stall", HEADQUARTERS_COST + SHIPYARD_LABOR_FEE + CONSTRUCTION_RESERVE);
    let w = applyCommand(w0, { kind: "commissionShipyard", portId: w0.region.ports[1].id });
    expect(w.company.thalers).toBe(CONSTRUCTION_RESERVE);
    for (let t = 0; t < 24; t++) w = tick(w, []);
    expect(w.company.thalers).toBe(CONSTRUCTION_RESERVE);
    for (const good of GOOD_IDS) expect(w.company.shipyard!.site!.siteStore[good]).toBe(0);
  });

  it("deliver fills the Shipyard's own site from a docked Company ship", () => {
    const w0 = richFounded("yard-deliver", HEADQUARTERS_COST + SHIPYARD_BUILD_BUDGET);
    const portId = w0.region.ports[1].id;
    const w1 = applyCommand(w0, { kind: "commissionShipyard", portId });
    const shipId = w1.company.ships[0].id;
    const laden: World = {
      ...w1,
      company: {
        ...w1.company,
        ships: w1.company.ships.map((s) => (s.id === shipId ? { ...s, cargo: { ...s.cargo, timber: 20 } } : s)),
      },
    };
    const dockedLaden = dockShipAt(laden, portId, shipId);
    const need = SHIPYARD_RECIPE.timber;
    const after = applyCommand(dockedLaden, { kind: "deliver", shipId, good: "timber" });
    const moved = Math.min(need, 20);
    expect(after.company.shipyard!.site!.siteStore.timber).toBe(moved);
    expect(after.company.ships.find((s) => s.id === shipId)!.cargo.timber).toBe(20 - moved);
    expect(after.ledger[after.ledger.length - 1]).toEqual({
      kind: "delivery",
      tick: dockedLaden.tick,
      shipId,
      portId,
      good: "timber",
      qty: moved,
    });
  });

  it("falls through to the Shipyard's own site when a same-port HQ build needs none of the good (#286, generalizing the #275/#286 audit precedent)", () => {
    const w0 = createWorld("yard-deliver-colocation");
    const samePortId = w0.region.ports[0].id;
    let w: World = { ...w0, company: { ...w0.company, thalers: HEADQUARTERS_COST + 1_000_000 } };
    w = applyCommand(w, { kind: "foundHeadquarters", portId: samePortId });
    w = applyCommand(w, { kind: "placeBuildOrder" });
    // The HQ build's own site is already full on timber (need 0) but
    // incomplete overall — commissioning the Shipyard at the SAME port
    // (once the ship build order is out of the way, per the one-Build-Order
    // scarcity law) exercises the fall-through chain.
    let guard = 0;
    while (w.company.headquarters?.buildOrder && guard++ < 5000) w = tick(w, []);
    expect(w.company.ships.length).toBeGreaterThan(1); // the first hull launched

    // Commission the Shipyard while no ship Build Order is active (scarcity
    // law), then hand-craft an active HQ build order directly onto the
    // world — the fixture only needs a same-port HQ site that's already
    // full on timber, not a real second build-to-completion.
    w = applyCommand(w, { kind: "commissionShipyard", portId: samePortId });
    const hqSiteStore = { ...emptyCargo(), timber: SHIP_RECIPE.timber };
    w = { ...w, company: { ...w.company, headquarters: { portId: samePortId, buildOrder: { siteStore: hqSiteStore } } } };

    const shipId = w.company.ships[0].id;
    const laden: World = {
      ...w,
      company: {
        ...w.company,
        ships: w.company.ships.map((s) => (s.id === shipId ? { ...s, cargo: { ...s.cargo, timber: 50 } } : s)),
      },
    };
    const dockedLaden = dockShipAt(laden, samePortId, shipId);
    const need = SHIPYARD_RECIPE.timber;

    const after = applyCommand(dockedLaden, { kind: "deliver", shipId, good: "timber" });
    expect(after.company.shipyard!.site!.siteStore.timber).toBe(need);
    expect(after.company.headquarters!.buildOrder!.siteStore.timber).toBe(SHIP_RECIPE.timber); // untouched
    expect(after.company.ships.find((s) => s.id === shipId)!.cargo.timber).toBe(50 - need);
  });

  it("computeShipyardRushQuote previews exactly what rushShipyard charges", () => {
    const w0 = richFounded("yard-rush", HEADQUARTERS_COST + 1_000_000);
    const w = applyCommand(w0, { kind: "commissionShipyard", portId: w0.region.ports[1].id });
    const quote = computeShipyardRushQuote(w);
    expect(quote.lines.length).toBeGreaterThan(0);
    const after = applyCommand(w, { kind: "rushShipyard" });
    const rushEvents = after.ledger
      .filter((e) => e.kind === "rush")
      .map((e) => (e.kind === "rush" ? { good: e.good, qty: e.qty, thalers: e.thalers } : null));
    expect(quote.lines).toEqual(rushEvents);
    expect(w.company.thalers - after.company.thalers).toBe(quote.total);
  });

  it("is rejected with no active site (never commissioned), and computeShipyardRushQuote is empty", () => {
    const w = richFounded("yard-rush-none", HEADQUARTERS_COST + SHIPYARD_BUILD_BUDGET);
    expect(computeShipyardRushQuote(w)).toEqual({ lines: [], total: 0 });
    expect(applyCommand(w, { kind: "rushShipyard" })).toBe(w);
  });

  it("quotes and spends at most purse - Reserve; never dips below it", () => {
    const w0 = richFounded("yard-rush-reserve", HEADQUARTERS_COST + SHIPYARD_LABOR_FEE + CONSTRUCTION_RESERVE + 2000);
    const w = applyCommand(w0, { kind: "commissionShipyard", portId: w0.region.ports[1].id });
    const quote = computeShipyardRushQuote(w);
    expect(quote.total).toBeLessThanOrEqual(2000);
    const after = applyCommand(w, { kind: "rushShipyard" });
    expect(after.company.thalers).toBeGreaterThanOrEqual(CONSTRUCTION_RESERVE);
  });
});

describe("Shipyard activation (#286)", () => {
  it("activates (site clears) once the Recipe fills, appending exactly one shipyardBuilt event with no thalers", () => {
    const w0 = richFounded("yard-activate", HEADQUARTERS_COST + 1_000_000);
    const portId = w0.region.ports[1].id;
    let w = applyCommand(w0, { kind: "commissionShipyard", portId });
    let guard = 0;
    while (w.company.shipyard?.site && guard++ < 500) {
      w = applyCommand(w, { kind: "rushShipyard" });
      if (w.company.shipyard?.site) w = tick(w, []);
    }
    expect(w.company.shipyard).toEqual({ portId });
    const builtEvents = w.ledger.filter((e) => e.kind === "shipyardBuilt");
    expect(builtEvents).toEqual([{ kind: "shipyardBuilt", tick: expect.any(Number), portId }]);
  });

  it("commissionRefit is rejected while the Shipyard's own site is still under construction", () => {
    const w0 = richFounded("yard-refit-too-early", HEADQUARTERS_COST + SHIPYARD_BUILD_BUDGET);
    const portId = w0.region.ports[1].id;
    const w = applyCommand(w0, { kind: "commissionShipyard", portId });
    expect(w.company.shipyard?.site).toBeDefined();
    const shipId = w.company.ships[0].id;
    const docked = dockShipAt(w, portId, shipId);
    expect(applyCommand(docked, { kind: "commissionRefit", shipId })).toBe(docked);
  });
});

describe("isShipyardUnderConstruction (#286)", () => {
  it("is false with no Shipyard", () => {
    const w = createWorld("underconstruction-none");
    expect(isShipyardUnderConstruction(w)).toBe(false);
  });

  it("is true right after commissionShipyard, before activation", () => {
    const w0 = richFounded("underconstruction-active", HEADQUARTERS_COST + SHIPYARD_BUILD_BUDGET);
    const w = applyCommand(w0, { kind: "commissionShipyard", portId: w0.region.ports[1].id });
    expect(isShipyardUnderConstruction(w)).toBe(true);
  });

  it("is false once the Shipyard has activated", () => {
    const w = richWithShipyard("underconstruction-done", HEADQUARTERS_COST + SHIPYARD_BUILD_BUDGET + 10_000);
    expect(isShipyardUnderConstruction(w)).toBe(false);
  });
});

describe("commissionRefit (#275/#286)", () => {
  it("requires a Shipyard", () => {
    const w = richFounded("refit-noyard", HEADQUARTERS_COST + 10_000);
    const shipId = w.company.ships[0].id;
    expect(applyCommand(w, { kind: "commissionRefit", shipId })).toBe(w);
  });

  it("requires the ship to be docked at the Shipyard port", () => {
    const w = richWithShipyard("refit-elsewhere", HEADQUARTERS_COST + SHIPYARD_BUILD_BUDGET + 10_000);
    const shipId = w.company.ships[0].id;
    // s0 is docked at its home port (port 0), the Shipyard is at port 1.
    expect(applyCommand(w, { kind: "commissionRefit", shipId })).toBe(w);
  });

  it("charges REFIT_LABOR_FEE and opens a RefitOrder targeting the next ladder rung", () => {
    const w0 = richWithShipyard("refit-ok", HEADQUARTERS_COST + SHIPYARD_BUILD_BUDGET + 10_000);
    const shipyardPortId = w0.company.shipyard!.portId;
    const w = dockShipAt(w0, shipyardPortId);
    const shipId = w.company.ships[0].id;
    const next = applyCommand(w, { kind: "commissionRefit", shipId });
    expect(next.company.thalers).toBe(w.company.thalers - REFIT_LABOR_FEE);
    expect(next.company.shipyard!.refitOrder).toEqual({
      shipId,
      targetHold: nextHoldStep(w.company.ships[0]),
      siteStore: Object.fromEntries(GOOD_IDS.map((g) => [g, 0])),
    });
  });

  it("appends exactly one refitStart event carrying thalers", () => {
    const w0 = richWithShipyard("refit-ledger", HEADQUARTERS_COST + SHIPYARD_BUILD_BUDGET + 10_000);
    const shipyardPortId = w0.company.shipyard!.portId;
    const w = dockShipAt(w0, shipyardPortId);
    const shipId = w.company.ships[0].id;
    const next = applyCommand(w, { kind: "commissionRefit", shipId });
    expect(next.ledger[next.ledger.length - 1]).toEqual({
      kind: "refitStart",
      tick: w.tick,
      shipId,
      portId: shipyardPortId,
      thalers: REFIT_LABOR_FEE,
    });
  });

  it("rejects a second concurrent RefitOrder (one at a time) and a fee that would dip into the Reserve", () => {
    const w0 = richWithShipyard("refit-second", HEADQUARTERS_COST + SHIPYARD_BUILD_BUDGET + 10_000);
    const shipyardPortId = w0.company.shipyard!.portId;
    const w = dockShipAt(w0, shipyardPortId);
    const running = applyCommand(w, { kind: "commissionRefit", shipId: w.company.ships[0].id });
    expect(applyCommand(running, { kind: "commissionRefit", shipId: running.company.ships[0].id })).toBe(running);

    // Override the purse directly to the exact broke value (the Shipyard's
    // own build cost via rush isn't a fixed constant) — the same technique
    // `richFounded`'s callers already use elsewhere in this file.
    const broke: World = {
      ...w0,
      company: { ...w0.company, thalers: REFIT_LABOR_FEE + CONSTRUCTION_RESERVE - 1 },
    };
    const brokeAtYard = dockShipAt(broke, broke.company.shipyard!.portId);
    expect(applyCommand(brokeAtYard, { kind: "commissionRefit", shipId: brokeAtYard.company.ships[0].id })).toBe(
      brokeAtYard,
    );
  });

  it("rejects a refit for a ship already at the ladder cap — a loud guard, not a silent zero-recipe order", () => {
    const w0 = richWithShipyard("refit-cap", HEADQUARTERS_COST + SHIPYARD_BUILD_BUDGET + 10_000);
    const shipyardPortId = w0.company.shipyard!.portId;
    const capped: Ship = { ...w0.company.ships[0], hold: 188 }; // at the ladder cap for baseHold 50
    const w = {
      ...dockShipAt(w0, shipyardPortId),
      company: { ...w0.company, ships: [capped] },
    };
    const next = applyCommand(w, { kind: "commissionRefit", shipId: capped.id });
    expect(next).toBe(w); // rejected outright
    expect(next.company.shipyard!.refitOrder).toBeUndefined();
  });

  it("auto-suspends an active Route assignment on start (existing manual-sailTo semantics)", () => {
    const w0 = richWithShipyard("refit-suspend", HEADQUARTERS_COST + SHIPYARD_BUILD_BUDGET + 10_000);
    const shipyardPortId = w0.company.shipyard!.portId;
    const otherPortId = w0.region.ports.find((p) => p.id !== shipyardPortId)!.id;
    const route: Route = {
      id: "r1",
      name: "loop",
      stops: [
        { portId: shipyardPortId, orders: [] },
        { portId: otherPortId, orders: [] },
      ],
    };
    let w: World = { ...w0, company: { ...w0.company, routes: [route] } };
    w = dockShipAt(w, shipyardPortId);
    const shipId = w.company.ships[0].id;
    w = applyCommand(w, { kind: "assignRoute", shipId, routeId: route.id });
    expect(isRouteActive(w.company.ships[0])).toBe(true);

    const refit = applyCommand(w, { kind: "commissionRefit", shipId });
    expect(refit.company.ships[0].assignment).toEqual({ routeId: route.id, nextStopIndex: 0, suspended: true });
  });

  it("leaves a ship with no assignment untouched (nothing to suspend)", () => {
    const w0 = richWithShipyard("refit-noassign", HEADQUARTERS_COST + SHIPYARD_BUILD_BUDGET + 10_000);
    const w = dockShipAt(w0, w0.company.shipyard!.portId);
    const shipId = w.company.ships[0].id;
    const refit = applyCommand(w, { kind: "commissionRefit", shipId });
    expect(refit.company.ships[0].assignment).toBeUndefined();
  });
});

describe("isUnderRefit (#275)", () => {
  it("is false with no Shipyard", () => {
    const w = createWorld("underrefit-none");
    expect(isUnderRefit(w, w.company.ships[0].id)).toBe(false);
  });

  it("is true only for the exact ship targeted by the active RefitOrder", () => {
    const w0 = richWithShipyard("underrefit-active", HEADQUARTERS_COST + SHIPYARD_BUILD_BUDGET + 10_000);
    const w = dockShipAt(w0, w0.company.shipyard!.portId);
    const shipId = w.company.ships[0].id;
    const refit = applyCommand(w, { kind: "commissionRefit", shipId });
    expect(isUnderRefit(refit, shipId)).toBe(true);
    expect(isUnderRefit(refit, "no-such-ship")).toBe(false);
  });

  it("is false once the RefitOrder is not active (Shipyard present, no refit)", () => {
    const w = richWithShipyard("underrefit-idle", HEADQUARTERS_COST + SHIPYARD_BUILD_BUDGET + 10_000);
    expect(isUnderRefit(w, w.company.ships[0].id)).toBe(false);
  });
});

/** Builds a world with a fully-activated Shipyard and an active RefitOrder
 *  on s0, ready for lock/fill tests. */
function refitInProgress(seedStr: string, thalers: number): World {
  const w0 = richWithShipyard(seedStr, thalers);
  const w = dockShipAt(w0, w0.company.shipyard!.portId);
  const shipId = w.company.ships[0].id;
  return applyCommand(w, { kind: "commissionRefit", shipId });
}

describe("refit lock enforcement (#275)", () => {
  it("rejects sailTo for the locked ship", () => {
    const w = refitInProgress("lock-sailto", HEADQUARTERS_COST + SHIPYARD_BUILD_BUDGET + 10_000);
    const shipId = w.company.ships[0].id;
    const other = w.region.ports.find((p) => p.id !== w.company.shipyard!.portId)!.id;
    expect(applyCommand(w, { kind: "sailTo", shipId, portId: other })).toBe(w);
  });

  it("rejects assignRoute for the locked ship", () => {
    const w0 = refitInProgress("lock-assign", HEADQUARTERS_COST + SHIPYARD_BUILD_BUDGET + 10_000);
    const shipId = w0.company.ships[0].id;
    const portA = w0.company.shipyard!.portId;
    const portB = w0.region.ports.find((p) => p.id !== portA)!.id;
    const route: Route = { id: "r1", name: "loop", stops: [{ portId: portA, orders: [] }, { portId: portB, orders: [] }] };
    const w = { ...w0, company: { ...w0.company, routes: [route] } };
    expect(applyCommand(w, { kind: "assignRoute", shipId, routeId: route.id })).toBe(w);
  });

  it("rejects resumeRoute for the locked ship — resume stays manual after completion", () => {
    const w0 = richWithShipyard("lock-resume", HEADQUARTERS_COST + SHIPYARD_BUILD_BUDGET + 10_000);
    const portA = w0.company.shipyard!.portId;
    const portB = w0.region.ports.find((p) => p.id !== portA)!.id;
    const route: Route = { id: "r1", name: "loop", stops: [{ portId: portA, orders: [] }, { portId: portB, orders: [] }] };
    let w: World = { ...w0, company: { ...w0.company, routes: [route] } };
    w = dockShipAt(w, portA);
    const shipId = w.company.ships[0].id;
    w = applyCommand(w, { kind: "assignRoute", shipId, routeId: route.id });
    w = applyCommand(w, { kind: "commissionRefit", shipId }); // auto-suspends

    const resumed = applyCommand(w, { kind: "resumeRoute", shipId });
    expect(resumed).toBe(w); // rejected: still locked
    expect(resumed.company.ships[0].assignment!.suspended).toBe(true);
  });

  it("rejects buy and sell for the locked ship's own cargo", () => {
    const w = refitInProgress("lock-trade", HEADQUARTERS_COST + SHIPYARD_BUILD_BUDGET + 10_000);
    const shipId = w.company.ships[0].id;
    expect(applyCommand(w, { kind: "buy", shipId, good: "grain", qty: 1 })).toBe(w);
    const laden = { ...w, company: { ...w.company, ships: [{ ...w.company.ships[0], cargo: { ...w.company.ships[0].cargo, grain: 5 } }] } };
    expect(applyCommand(laden, { kind: "sell", shipId, good: "grain", qty: 1 })).toBe(laden);
  });

  it("a suspended, locked ship never advances across ticks (route pass stays dormant)", () => {
    const w0 = richWithShipyard("lock-noadvance", HEADQUARTERS_COST + SHIPYARD_BUILD_BUDGET + 10_000);
    const portA = w0.company.shipyard!.portId;
    const portB = w0.region.ports.find((p) => p.id !== portA)!.id;
    const route: Route = { id: "r1", name: "loop", stops: [{ portId: portA, orders: [] }, { portId: portB, orders: [] }] };
    let w: World = { ...w0, company: { ...w0.company, routes: [route] } };
    w = dockShipAt(w, portA);
    const shipId = w.company.ships[0].id;
    w = applyCommand(w, { kind: "assignRoute", shipId, routeId: route.id });
    w = applyCommand(w, { kind: "commissionRefit", shipId });

    for (let i = 0; i < 50; i++) w = tick(w, []);
    expect(w.company.ships[0].location).toEqual({ kind: "docked", portId: portA });
  });
});

describe("deliver to the refit site (#275)", () => {
  it("falls through to the refit site when a same-port HQ build needs none of the good (#286 audit)", () => {
    const w0 = refitInProgress("deliver-colocation", HEADQUARTERS_COST + SHIPYARD_BUILD_BUDGET + 10_000);
    const shipyardPortId = w0.company.shipyard!.portId;
    // Active HQ build at the SAME port, already full on electronics (need 0)
    // but incomplete overall — the pre-fix code swallowed the delivery here.
    const hqSiteStore = { ...emptyCargo(), electronics: SHIP_RECIPE.electronics };
    const ferry: Ship = {
      id: "ferry",
      name: "Ferry",
      hold: 50,
      baseHold: 50,
      cargo: { ...emptyCargo(), electronics: 50 },
      location: { kind: "docked", portId: shipyardPortId },
    };
    const w: World = {
      ...w0,
      company: {
        ...w0.company,
        ships: [...w0.company.ships, ferry],
        headquarters: { portId: shipyardPortId, buildOrder: { siteStore: hqSiteStore } },
      },
    };
    const targetShip = w.company.ships.find((s) => s.id === w.company.shipyard!.refitOrder!.shipId)!;
    const need = refitRecipe(targetShip).electronics;

    const after = applyCommand(w, { kind: "deliver", shipId: "ferry", good: "electronics" });
    expect(after.company.shipyard!.refitOrder!.siteStore.electronics).toBe(need);
    expect(after.company.headquarters!.buildOrder!.siteStore.electronics).toBe(SHIP_RECIPE.electronics);
    expect(after.company.ships.find((s) => s.id === "ferry")!.cargo.electronics).toBe(50 - need);
  });

  it("moves min(cargo, remaining need) into the RefitOrder's siteStore from any Company ship", () => {
    const w0 = refitInProgress("deliver-refit", HEADQUARTERS_COST + SHIPYARD_BUILD_BUDGET + 10_000);
    const shipyardPortId = w0.company.shipyard!.portId;
    const targetShipId = w0.company.shipyard!.refitOrder!.shipId;
    // A second ship (not the one under refit) ferries materials in.
    const ferry: Ship = {
      id: "ferry",
      name: "Ferry",
      hold: 50,
      baseHold: 50,
      cargo: { ...emptyCargo(), electronics: 50 },
      location: { kind: "docked", portId: shipyardPortId },
    };
    const w = { ...w0, company: { ...w0.company, ships: [...w0.company.ships, ferry] } };
    const targetShip = w.company.ships.find((s) => s.id === targetShipId)!;
    const need = refitRecipe(targetShip).electronics;

    const after = applyCommand(w, { kind: "deliver", shipId: "ferry", good: "electronics" });
    expect(after.company.shipyard!.refitOrder!.siteStore.electronics).toBe(need);
    expect(after.company.ships.find((s) => s.id === "ferry")!.cargo.electronics).toBe(50 - need);
    expect(after.ledger[after.ledger.length - 1]).toEqual({
      kind: "delivery",
      tick: w.tick,
      shipId: "ferry",
      portId: shipyardPortId,
      good: "electronics",
      qty: need,
    });
    // The refit target ship's own cargo is untouched by a delivery from another ship.
    expect(after.company.ships.find((s) => s.id === targetShipId)!.cargo).toEqual(targetShip.cargo);
  });

  it("the refit-locked target ship can itself deliver cargo into the site (deliver is not lock-gated)", () => {
    const w0 = refitInProgress("deliver-self", HEADQUARTERS_COST + SHIPYARD_BUILD_BUDGET + 10_000);
    const shipId = w0.company.shipyard!.refitOrder!.shipId;
    const laden = {
      ...w0,
      company: {
        ...w0.company,
        ships: w0.company.ships.map((s) => (s.id === shipId ? { ...s, cargo: { ...s.cargo, timber: 20 } } : s)),
      },
    };
    const after = applyCommand(laden, { kind: "deliver", shipId, good: "timber" });
    expect(after.company.shipyard!.refitOrder!.siteStore.timber).toBeGreaterThan(0);
  });

  it("is a no-op away from the Shipyard port and with no active RefitOrder", () => {
    const w0 = richWithShipyard("deliver-noop", HEADQUARTERS_COST + SHIPYARD_BUILD_BUDGET + 10_000);
    const shipId = w0.company.ships[0].id; // docked at home port, not the Shipyard
    const laden = {
      ...w0,
      company: {
        ...w0.company,
        ships: w0.company.ships.map((s) => (s.id === shipId ? { ...s, cargo: { ...s.cargo, timber: 20 } } : s)),
      },
    };
    expect(applyCommand(laden, { kind: "deliver", shipId, good: "timber" })).toBe(laden);
  });
});

describe("Shipyard auto-draw (#275)", () => {
  it("fills the refit site over ticks, same cadence/cap as the HQ site, and stalls at the Reserve", () => {
    const w0 = refitInProgress("autodraw-refit", HEADQUARTERS_COST + SHIPYARD_BUILD_BUDGET + 1_000_000);
    let w = w0;
    for (let t = 0; t < 24; t++) w = tick(w, []);
    const store = w.company.shipyard!.refitOrder?.siteStore;
    expect(w.company.thalers).toBeGreaterThanOrEqual(CONSTRUCTION_RESERVE);
    // The recipe totals far more than 24 units across all goods, so the site
    // must still be under construction — assert it exists rather than a
    // guarded `if (store)`, which would pass vacuously (and silently stop
    // checking anything) if the site had already cleared (incident 0005).
    expect(store).toBeDefined();
    for (const good of GOOD_IDS) expect(store![good]).toBeLessThanOrEqual(24);
    expect(w.ledger.some((e) => e.kind === "autoDraw")).toBe(true);
  });

  it("stalls silently at the Reserve — no dip below it, no site growth", () => {
    const built = richWithShipyard("autodraw-stall", HEADQUARTERS_COST + SHIPYARD_BUILD_BUDGET + 10_000);
    const w0: World = {
      ...built,
      company: { ...built.company, thalers: REFIT_LABOR_FEE + CONSTRUCTION_RESERVE },
    };
    const docked = dockShipAt(w0, w0.company.shipyard!.portId);
    const shipId = docked.company.ships[0].id;
    const w = applyCommand(docked, { kind: "commissionRefit", shipId });
    expect(w.company.thalers).toBe(CONSTRUCTION_RESERVE);
    let stepped = w;
    for (let t = 0; t < 24; t++) stepped = tick(stepped, []);
    expect(stepped.company.thalers).toBe(CONSTRUCTION_RESERVE);
    for (const good of GOOD_IDS) expect(stepped.company.shipyard!.refitOrder!.siteStore[good]).toBe(0);
  });

  it("both HQ build and Shipyard refit auto-draw in the same tick, sharing (and respecting) the purse", () => {
    // Found HQ, place a build order, commission+build a Shipyard, and start
    // a refit — both sites active at once, both must stall at the same
    // Reserve.
    const w0 = createWorld("autodraw-both");
    let w: World = { ...w0, company: { ...w0.company, thalers: 1_000_000 } };
    w = applyCommand(w, { kind: "foundHeadquarters", portId: w.region.ports[0].id });
    w = applyCommand(w, { kind: "placeBuildOrder" });
    // A ship Build Order and the Shipyard's own site can't both be active at
    // once (scarcity, #286) — complete the ship build first via auto-draw.
    let guard = 0;
    while (w.company.headquarters?.buildOrder && guard++ < 5000) w = tick(w, []);
    expect(w.company.headquarters?.buildOrder).toBeUndefined();

    w = applyCommand(w, { kind: "commissionShipyard", portId: w.region.ports[1].id });
    guard = 0;
    while (w.company.shipyard?.site && guard++ < 5000) w = tick(w, []);
    expect(w.company.shipyard?.site).toBeUndefined();

    w = applyCommand(w, { kind: "placeBuildOrder" }); // a second hull, now that the Shipyard is built
    w = dockShipAt(w, w.region.ports[1].id);
    w = applyCommand(w, { kind: "commissionRefit", shipId: w.company.ships[0].id });

    for (let t = 0; t < 24; t++) {
      w = tick(w, []);
      expect(w.company.thalers).toBeGreaterThanOrEqual(CONSTRUCTION_RESERVE);
    }
    const hqDrawn = GOOD_IDS.some((g) => (w.company.headquarters?.buildOrder?.siteStore[g] ?? 0) > 0);
    const yardDrawn = GOOD_IDS.some((g) => (w.company.shipyard?.refitOrder?.siteStore[g] ?? 0) > 0);
    expect(hqDrawn).toBe(true);
    expect(yardDrawn).toBe(true);
  });
});

describe("rushRefit + computeRefitRushQuote (#275)", () => {
  it("computeRefitRushQuote previews exactly what rushRefit charges", () => {
    const w = refitInProgress("rush-refit", HEADQUARTERS_COST + SHIPYARD_BUILD_BUDGET + 1_000_000);
    const quote = computeRefitRushQuote(w);
    expect(quote.lines.length).toBeGreaterThan(0);
    const after = applyCommand(w, { kind: "rushRefit" });
    // Slice to events appended by *this* command only — richWithShipyard's
    // own construction already rushed the Shipyard building, leaving prior
    // "rush" events in the ledger (#286 fix: the Shipyard is no longer an
    // instant purchase).
    const rushEvents = after.ledger
      .slice(w.ledger.length)
      .filter((e) => e.kind === "rush")
      .map((e) => (e.kind === "rush" ? { good: e.good, qty: e.qty, thalers: e.thalers } : null));
    expect(quote.lines).toEqual(rushEvents);
    expect(w.company.thalers - after.company.thalers).toBe(quote.total);
  });

  it("is rejected with no active RefitOrder, and computeRefitRushQuote is empty", () => {
    const w = richWithShipyard("rush-refit-none", HEADQUARTERS_COST + SHIPYARD_BUILD_BUDGET + 10_000);
    expect(computeRefitRushQuote(w)).toEqual({ lines: [], total: 0 });
    expect(applyCommand(w, { kind: "rushRefit" })).toBe(w);
  });

  it("quotes and spends at most purse - Reserve; never dips below it", () => {
    const built = richWithShipyard("rush-refit-reserve", HEADQUARTERS_COST + SHIPYARD_BUILD_BUDGET + 10_000);
    const w0: World = {
      ...built,
      company: { ...built.company, thalers: REFIT_LABOR_FEE + CONSTRUCTION_RESERVE + 2000 },
    };
    const docked = dockShipAt(w0, w0.company.shipyard!.portId);
    const w = applyCommand(docked, { kind: "commissionRefit", shipId: docked.company.ships[0].id });
    const quote = computeRefitRushQuote(w);
    expect(quote.total).toBeLessThanOrEqual(2000);
    const after = applyCommand(w, { kind: "rushRefit" });
    expect(after.company.thalers).toBeGreaterThanOrEqual(CONSTRUCTION_RESERVE);
  });
});

describe("Refit completion (#275)", () => {
  it("sets hold to the exact target threshold, clears refitOrder, and lifts the lock when the recipe fills", () => {
    const w = refitInProgress("complete-refit", HEADQUARTERS_COST + SHIPYARD_BUILD_BUDGET + 1_000_000);
    const shipId = w.company.shipyard!.refitOrder!.shipId;
    const targetHold = w.company.shipyard!.refitOrder!.targetHold;

    let after = w;
    // Rush repeatedly (a fresh quote each time; the Reserve and stock cap
    // each single rush) until the site completes.
    let guard = 0;
    while (after.company.shipyard!.refitOrder && guard++ < 50) {
      after = applyCommand(after, { kind: "rushRefit" });
      if (after.company.shipyard!.refitOrder) after = tick(after, []); // let a day boundary/auto-draw plus stock replenish
    }
    expect(after.company.shipyard!.refitOrder).toBeUndefined();
    expect(after.company.ships.find((s) => s.id === shipId)!.hold).toBe(targetHold);
    expect(isUnderRefit(after, shipId)).toBe(false);
    expect(after.ledger.some((e) => e.kind === "refitComplete")).toBe(true);
  });

  it("appends exactly one refitComplete event with no thalers field", () => {
    const w = refitInProgress("complete-ledger", HEADQUARTERS_COST + SHIPYARD_BUILD_BUDGET + 1_000_000);
    const shipId = w.company.shipyard!.refitOrder!.shipId;
    const targetHold = w.company.shipyard!.refitOrder!.targetHold;
    const shipyardPortId = w.company.shipyard!.portId;

    let after = w;
    let guard = 0;
    while (after.company.shipyard!.refitOrder && guard++ < 50) {
      after = applyCommand(after, { kind: "rushRefit" });
      if (after.company.shipyard!.refitOrder) after = tick(after, []);
    }
    const completeEvents = after.ledger.filter((e) => e.kind === "refitComplete");
    expect(completeEvents).toEqual([
      { kind: "refitComplete", tick: expect.any(Number), shipId, portId: shipyardPortId, hold: targetHold },
    ]);
  });

  it("cargo aboard the refit target ship is untouched across completion", () => {
    const w0 = refitInProgress("complete-cargo", HEADQUARTERS_COST + SHIPYARD_BUILD_BUDGET + 1_000_000);
    const shipId = w0.company.shipyard!.refitOrder!.shipId;
    // Give the target ship some cargo unrelated to the refit materials.
    const w: World = {
      ...w0,
      company: {
        ...w0.company,
        ships: w0.company.ships.map((s) => (s.id === shipId ? { ...s, cargo: { ...s.cargo, grain: 3 } } : s)),
      },
    };
    let after = w;
    let guard = 0;
    while (after.company.shipyard!.refitOrder && guard++ < 50) {
      after = applyCommand(after, { kind: "rushRefit" });
      if (after.company.shipyard!.refitOrder) after = tick(after, []);
    }
    expect(after.company.ships.find((s) => s.id === shipId)!.cargo.grain).toBe(3);
  });
});

describe("determinism (#275/#286)", () => {
  it("same seed with an active Refit yields a deep-equal world after identical commands", () => {
    const run = (): World => {
      const w0 = createWorld(4242);
      let w: World = { ...w0, company: { ...w0.company, thalers: 1_000_000 } };
      w = applyCommand(w, { kind: "foundHeadquarters", portId: w.region.ports[0].id });
      w = applyCommand(w, { kind: "commissionShipyard", portId: w.region.ports[1].id });
      let guard = 0;
      while (w.company.shipyard?.site && guard++ < 500) {
        w = applyCommand(w, { kind: "rushShipyard" });
        if (w.company.shipyard?.site) w = tick(w, []);
      }
      w = dockShipAt(w, w.region.ports[1].id);
      w = applyCommand(w, { kind: "commissionRefit", shipId: w.company.ships[0].id });
      for (let t = 0; t < 30; t++) w = tick(w, []);
      return w;
    };
    expect(run()).toEqual(run());
  });

  it("same seed mid Shipyard-construction (before activation) yields a deep-equal world after identical commands", () => {
    const run = (): World => {
      const w0 = createWorld(777);
      let w: World = { ...w0, company: { ...w0.company, thalers: 1_000_000 } };
      w = applyCommand(w, { kind: "foundHeadquarters", portId: w.region.ports[0].id });
      w = applyCommand(w, { kind: "commissionShipyard", portId: w.region.ports[1].id });
      for (let t = 0; t < 20; t++) w = tick(w, []);
      return w;
    };
    expect(run()).toEqual(run());
  });
});
