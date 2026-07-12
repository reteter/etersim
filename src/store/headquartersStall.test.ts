import { describe, expect, it } from "vitest";
import { applyCommand, CONSTRUCTION_RESERVE, HEADQUARTERS_COST, LABOR_FEE, SHIP_RECIPE, type World } from "../sim";
import { createWorld } from "../sim";
import { deriveStallReason } from "./headquartersStall";

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
    const full = { ...SHIP_RECIPE };
    w = {
      ...w,
      tick: 0,
      company: { ...w.company, headquarters: { portId: headquarters.portId, buildOrder: { siteStore: full } } },
    };
    expect(deriveStallReason(w, w.company.headquarters!)).toBeNull();
  });
});
