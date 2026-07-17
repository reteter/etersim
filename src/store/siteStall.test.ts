import { describe, expect, it } from "vitest";
import {
  applyCommand,
  createWorld,
  SHIPYARD_RECIPE,
  tick,
  type ConstructionSite,
  type World,
} from "../sim";
import { deriveSiteStallReason } from "./siteStall";

/** A funded World with a Headquarters founded and a Shipyard commissioned
 *  (its own construction site still active — mirrors shipyard.test.ts's
 *  `richFounded`, kept local since this test only needs the site, not a
 *  fully built Shipyard). */
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
        shipyard: { portId: shipyard.portId, site: { siteStore: { ...SHIPYARD_RECIPE } } },
      },
    };
    expect(deriveSiteStallReason(w, shipyardSite(w))).toBeNull();
  });

  it("is null once a full day's ticks run and the port can't be found for the site (defensive)", () => {
    const w = commissionedShipyard("site-stall-noport", 1_000_000);
    const bogusSite: ConstructionSite = {
      recipe: SHIPYARD_RECIPE,
      siteStore: { grain: 0, textiles: 0, aetherSalt: 0, electronics: 0, timber: 0 },
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
