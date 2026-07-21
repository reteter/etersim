import { describe, expect, it } from "vitest";
import {
  applyCommand,
  createWorld,
  CONSTRUCTION_RESERVE,
  effectiveBase,
  emptyStore,
  GOOD_IDS,
  HEADQUARTERS_COST,
  LABOR_FEE,
  quoteBuy,
  SHIP_RECIPE,
  SHIPYARD_RECIPE,
  storeOf,
  tick,
  type ConstructionSite,
  type World,
} from "../sim";
import { deriveSiteStallReason, deriveStallReason } from "./headquartersStall";

function foundedAndPlaced(seedStr: string, thalers: number): World {
  const w0 = createWorld(seedStr);
  const rich: World = { ...w0, company: { ...w0.company, thalers } };
  const portId = rich.region.ports[0].id;
  let w = applyCommand(rich, { kind: "foundHeadquarters", portId });
  w = applyCommand(w, { kind: "placeBuildOrder" });
  return w;
}

describe("deriveStallReason", () => {
  it("is null with no active build order", () => {
    const w0 = createWorld("stall-none");
    const rich: World = { ...w0, company: { ...w0.company, thalers: HEADQUARTERS_COST + CONSTRUCTION_RESERVE + 100 } };
    const w = applyCommand(rich, { kind: "foundHeadquarters", portId: rich.region.ports[0].id });
    expect(deriveStallReason(w, w.company.headquarters!)).toBeNull();
  });

  it("is null (waiting for tomorrow) once today's auto-draw window is spent, even at the Reserve", () => {
    let w = foundedAndPlaced("stall-window", HEADQUARTERS_COST + LABOR_FEE + CONSTRUCTION_RESERVE);
    // Fast-forward past AUTO_DRAW_PER_DAY ticks within the same day.
    w = { ...w, tick: 15 };
    expect(deriveStallReason(w, w.company.headquarters!)).toBeNull();
  });

  it("reports 'reserve' when every needed good would dip below the Reserve, within the draw window (#122)", () => {
    // Purse exactly at the floor: any purchase would cross it.
    const w = foundedAndPlaced("stall-reserve", HEADQUARTERS_COST + LABOR_FEE + CONSTRUCTION_RESERVE);
    expect(w.company.thalers).toBe(CONSTRUCTION_RESERVE);
    expect(deriveStallReason({ ...w, tick: 0 }, w.company.headquarters!)).toBe("reserve");
  });

  it("reports 'goods' when the port is out of stock for every needed good, within the draw window", () => {
    let w = foundedAndPlaced("stall-goods", 1_000_000);
    const headquarters = w.company.headquarters!;
    const portIdx = w.region.ports.findIndex((p) => p.id === headquarters.portId);
    const port = w.region.ports[portIdx];
    const zeroedMarket = { ...port.market };
    for (const good of Object.keys(SHIP_RECIPE) as (keyof typeof SHIP_RECIPE)[]) {
      zeroedMarket[good] = { ...zeroedMarket[good], stock: 0 };
    }
    const ports = [...w.region.ports];
    ports[portIdx] = { ...port, market: zeroedMarket };
    w = { ...w, tick: 0, region: { ...w.region, ports } };
    expect(deriveStallReason(w, headquarters)).toBe("goods");
  });

  it("is null once the site store fully covers the recipe (no remaining need)", () => {
    let w = foundedAndPlaced("stall-complete", 1_000_000);
    const headquarters = w.company.headquarters!;
    const full = storeOf(SHIP_RECIPE);
    w = {
      ...w,
      tick: 0,
      company: { ...w.company, headquarters: { portId: headquarters.portId, buildOrder: { siteStore: full } } },
    };
    expect(deriveStallReason(w, w.company.headquarters!)).toBeNull();
  });
});

/** A funded World with a Headquarters founded and a Shipyard commissioned
 *  (its own construction site still active — mirrors shipyard.test.ts's
 *  `richFounded`, kept local since this test only needs the site, not a
 *  fully built Shipyard). Retargeted from the former `src/store/siteStall.ts`
 *  (#292 — the stall-walk collapse: `deriveSiteStallReason` now lives here,
 *  generalized in place alongside `deriveStallReason`). */
function commissionedShipyard(seedStr: string, thalers: number): World {
  const w0 = createWorld(seedStr);
  const funded: World = { ...w0, company: { ...w0.company, thalers } };
  const hqPortId = funded.region.ports[0].id;
  const founded = applyCommand(funded, { kind: "foundHeadquarters", portId: hqPortId });
  const shipyardPortId = founded.region.ports[1].id;
  return applyCommand(founded, { kind: "commissionShipyard", portId: shipyardPortId });
}

/** The Shipyard's own construction site as a `ConstructionSite` — the exact
 *  shape `deriveSiteStallReason` consumes, mirroring the `activeShipyardSite`
 *  helper internal to `src/sim/shipyard.ts`. */
function shipyardSite(w: World): ConstructionSite {
  const shipyard = w.company.shipyard!;
  return { recipe: SHIPYARD_RECIPE, siteStore: shipyard.site!.siteStore, portId: shipyard.portId };
}

describe("deriveSiteStallReason", () => {
  it("is null (waiting for tomorrow) once today's auto-draw window is spent, even at the Reserve", () => {
    // HEADQUARTERS_COST (2,500) + SHIPYARD_LABOR_FEE (700) + CONSTRUCTION_RESERVE (500).
    let w = commissionedShipyard("site-stall-window", 2_500 + 700 + 500);
    w = { ...w, tick: 15 };
    expect(deriveSiteStallReason(w, shipyardSite(w))).toBeNull();
  });

  it("reports 'reserve' when every needed good would dip below the Reserve, within the draw window", () => {
    let w = commissionedShipyard("site-stall-reserve", 2_500 + 700 + 500);
    w = { ...w, tick: 0 };
    expect(w.company.thalers).toBe(500);
    expect(deriveSiteStallReason(w, shipyardSite(w))).toBe("reserve");
  });

  it("reports 'goods' when the port is out of stock for every needed good, within the draw window", () => {
    let w = commissionedShipyard("site-stall-goods", 1_000_000);
    const shipyard = w.company.shipyard!;
    const portIdx = w.region.ports.findIndex((p) => p.id === shipyard.portId);
    const port = w.region.ports[portIdx];
    const zeroedMarket = { ...port.market };
    for (const good of Object.keys(SHIPYARD_RECIPE) as (keyof typeof SHIPYARD_RECIPE)[]) {
      zeroedMarket[good] = { ...zeroedMarket[good], stock: 0 };
    }
    const ports = [...w.region.ports];
    ports[portIdx] = { ...port, market: zeroedMarket };
    w = { ...w, tick: 0, region: { ...w.region, ports } };
    expect(deriveSiteStallReason(w, shipyardSite(w))).toBe("goods");
  });

  it("is null once the site store fully covers the recipe (no remaining need)", () => {
    let w = commissionedShipyard("site-stall-complete", 1_000_000);
    const shipyard = w.company.shipyard!;
    w = {
      ...w,
      tick: 0,
      company: {
        ...w.company,
        shipyard: { portId: shipyard.portId, site: { siteStore: storeOf(SHIPYARD_RECIPE) } },
      },
    };
    expect(deriveSiteStallReason(w, shipyardSite(w))).toBeNull();
  });

  it("is null once a full day's ticks run and the port can't be found for the site (defensive)", () => {
    const w = commissionedShipyard("site-stall-noport", 1_000_000);
    const bogusSite: ConstructionSite = {
      recipe: SHIPYARD_RECIPE,
      siteStore: emptyStore(),
      portId: "nope" as never,
    };
    expect(deriveSiteStallReason({ ...w, tick: 0 }, bogusSite)).toBeNull();
  });

  it("real tick(): a thin purse at a Shipyard site eventually stalls at the Reserve", () => {
    let w = commissionedShipyard("site-stall-real-tick", 2_500 + 700 + 500);
    for (let i = 0; i < 5 && w.company.shipyard?.site; i++) w = tick(w, []);
    expect(deriveSiteStallReason(w, shipyardSite(w))).toBe("reserve");
  });
});

/**
 * Professor review (#292, F3): a later-in-order site's readout must fold in
 * an earlier site's own same-tick draw from the shared purse — HQ, Shipyard
 * construction, Refit, in that fixed order (src/sim/tick.ts:452-461).
 * Concurrency check (src/sim/commands.ts): `commissionShipyard`/
 * `placeBuildOrder` are mutually exclusive (the E13 scarcity law — one active
 * Build Order per Company), but `commissionRefit` has no such HQ gate, so an
 * HQ Build Order and an active Refit *can* run concurrently — the scenario
 * this test builds.
 */
describe("deriveSiteStallReason — concurrent sites (#292, Professor F3)", () => {
  function shipyardWithConcurrentBuildAndRefit(seedStr: string): World {
    const w0 = createWorld(seedStr);
    let w: World = { ...w0, company: { ...w0.company, thalers: 10_000_000 } };
    const hqPortId = w.region.ports[0].id;
    const shipyardPortId = w.region.ports[1].id;
    w = applyCommand(w, { kind: "foundHeadquarters", portId: hqPortId });
    w = applyCommand(w, { kind: "commissionShipyard", portId: shipyardPortId });
    // Rush the Shipyard's own construction to completion (site clears) so a
    // Refit becomes available — mirrors shipyard.test.ts's `richWithShipyard`.
    let guard = 0;
    while (w.company.shipyard?.site && guard++ < 500) {
      w = applyCommand(w, { kind: "rushShipyard" });
      if (w.company.shipyard?.site) w = tick(w, []);
    }
    expect(w.company.shipyard?.site).toBeUndefined();

    // Dock s0 at the Shipyard port and start a Refit (hold 50 -> 100:
    // refitRecipe(ship(50)) === SHIP_RECIPE exactly, shipyard.test.ts).
    const shipId = w.company.ships[0].id;
    w = {
      ...w,
      company: {
        ...w.company,
        ships: w.company.ships.map((s) => (s.id === shipId ? { ...s, location: { kind: "docked", portId: shipyardPortId } } : s)),
      },
    };
    w = applyCommand(w, { kind: "commissionRefit", shipId });
    expect(w.company.shipyard?.refitOrder).toBeDefined();

    // Now open a fresh HQ Build Order — allowed: the scarcity law only gates
    // against the Shipyard's own (not-yet-built) construction site, not an
    // active Refit.
    w = applyCommand(w, { kind: "placeBuildOrder" });
    expect(w.company.headquarters?.buildOrder).toBeDefined();
    return w;
  }

  it("the Refit's readout must account for the HQ site's same-tick draw, not just the raw pre-tick purse", () => {
    let w = shipyardWithConcurrentBuildAndRefit("stall-concurrent");
    const hqPort = w.region.ports.find((p) => p.id === w.company.headquarters!.portId)!;

    // What one tick's HQ auto-draw would spend on 1 unit of every SHIP_RECIPE
    // good (fresh, empty siteStore — every good's need > 0), computed from
    // the same untouched market entries `drawConstructionSite` itself reads
    // (each good's own stock/price is independent of another good's
    // purchase, so summing per-good `quoteBuy(...,1)` here is exact, not an
    // approximation of what the real draw charges).
    let hqDrawTotal = 0;
    for (const good of GOOD_IDS) {
      hqDrawTotal += quoteBuy(hqPort.market[good], effectiveBase(hqPort, good), 1)!;
    }

    // Purse set so the HQ draw leaves the purse at *exactly* the Reserve
    // floor (margin 0) — any further purchase, of any good, is unaffordable.
    w = { ...w, tick: 0, company: { ...w.company, thalers: hqDrawTotal + CONSTRUCTION_RESERVE } };

    const hqSite: ConstructionSite = {
      recipe: SHIP_RECIPE,
      siteStore: w.company.headquarters!.buildOrder!.siteStore,
      portId: w.company.headquarters!.portId,
    };
    const refitSite: ConstructionSite = {
      recipe: SHIP_RECIPE, // refitRecipe(ship(50)) === SHIP_RECIPE
      siteStore: w.company.shipyard!.refitOrder!.siteStore,
      portId: w.company.shipyard!.portId,
    };

    // Naive (no precedingSites): tests the Refit's own goods against the raw
    // purse, before the HQ's own same-tick draw (first in tick.ts's fixed
    // order) is folded in — reads "no stall" even though the HQ draw will
    // floor the purse before the Refit ever gets a turn this tick.
    expect(deriveSiteStallReason(w, refitSite)).toBeNull();

    // Accounted: HQ drew first (simulated dry, no World mutation), the purse
    // is now exactly at the Reserve floor (margin 0) — the Refit correctly
    // reads "reserve" instead.
    expect(deriveSiteStallReason(w, refitSite, [hqSite])).toBe("reserve");

    // Grounded in the real tick(): running it confirms the Refit's siteStore
    // stays untouched this tick (HQ drew first and floored the purse) while
    // company.thalers lands exactly at the Reserve, matching the accounted
    // readout above rather than the naive one.
    const after = tick(w, []);
    expect(after.company.thalers).toBe(CONSTRUCTION_RESERVE);
    expect(after.company.shipyard!.refitOrder!.siteStore).toEqual(w.company.shipyard!.refitOrder!.siteStore);
  });
});
