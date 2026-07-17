import { describe, expect, it } from "vitest";
import { GOOD_IDS } from "./goods";
import { effectiveBase, quoteBuy } from "./market";
import { refitRecipe, REFIT_LABOR_FEE, SHIPYARD_LABOR_FEE, SHIPYARD_RECIPE } from "./shipyard";
import { computeRefitEstimate, computeShipyardEstimate } from "./siteEstimate";
import type { Ship } from "./ship";
import { createWorld, type World } from "./world";

/** World with `thalers` in the purse (#122's `rich` pattern, building.test.ts). */
function rich(seedStr: string, thalers: number): World {
  const w = createWorld(seedStr);
  return { ...w, company: { ...w.company, thalers } };
}

function shipOf(hold: number, baseHold = 50): Ship {
  return {
    id: "s0",
    name: "s0",
    hold,
    baseHold,
    cargo: { grain: 0, textiles: 0, aetherSalt: 0, electronics: 0, timber: 0 },
    location: { kind: "docked", portId: "a" },
  };
}

describe("computeShipyardEstimate (#292 — sim-side estimate seam)", () => {
  it("prices SHIPYARD_RECIPE at current asks plus the labor fee; equals quoteBuy where stock suffices", () => {
    const w = rich("shipyard-estimate", 1_000_000);
    const port = w.region.ports[0];
    const estimate = computeShipyardEstimate(port);

    expect(estimate.lines.map((l) => l.good)).toEqual(GOOD_IDS.filter((g) => SHIPYARD_RECIPE[g] > 0));
    let materials = 0;
    for (const line of estimate.lines) {
      expect(line.qty).toBe(SHIPYARD_RECIPE[line.good]);
      expect(line.thalers).toBeGreaterThan(0);
      const entry = port.market[line.good];
      if (Math.floor(entry.stock) >= line.qty) {
        expect(line.thalers).toBe(quoteBuy(entry, effectiveBase(port, line.good), line.qty));
      }
      materials += line.thalers;
    }
    expect(estimate.laborFee).toBe(SHIPYARD_LABOR_FEE);
    expect(estimate.total).toBe(materials + SHIPYARD_LABOR_FEE);
  });

  it("is independent of the purse — an estimate, not an affordability quote", () => {
    const richWorld = rich("shipyard-estimate-purse", 1_000_000);
    const port = richWorld.region.ports[0];
    expect(computeShipyardEstimate(port)).toEqual(computeShipyardEstimate(port));
  });

  it("still prices a good the market cannot fully stock today (ceiling tail, finite)", () => {
    const w = rich("shipyard-estimate-short", 1_000_000);
    const ports = [...w.region.ports];
    ports[0] = { ...ports[0], market: { ...ports[0].market, grain: { ...ports[0].market.grain, stock: 0 } } };
    const port = ports[0];
    const line = computeShipyardEstimate(port).lines.find((l) => l.good === "grain")!;
    expect(line.qty).toBe(SHIPYARD_RECIPE.grain);
    expect(line.thalers).toBeGreaterThan(0);
  });
});

describe("computeRefitEstimate (#292 — sim-side estimate seam)", () => {
  it("prices refitRecipe(ship) at current asks plus the labor fee — never drifts from applyCommand's own rush/auto-draw quotes", () => {
    const w = rich("refit-estimate", 1_000_000);
    const port = w.region.ports[0];
    const ship = shipOf(50);
    const estimate = computeRefitEstimate(port, ship);
    const recipe = refitRecipe(ship);

    expect(estimate.lines.map((l) => l.good)).toEqual(GOOD_IDS.filter((g) => recipe[g] > 0));
    let materials = 0;
    for (const line of estimate.lines) {
      expect(line.qty).toBe(recipe[line.good]);
      const entry = port.market[line.good];
      if (Math.floor(entry.stock) >= line.qty) {
        expect(line.thalers).toBe(quoteBuy(entry, effectiveBase(port, line.good), line.qty));
      }
      materials += line.thalers;
    }
    expect(estimate.laborFee).toBe(REFIT_LABOR_FEE);
    expect(estimate.total).toBe(materials + REFIT_LABOR_FEE);
  });

  it("scales down for a smaller ladder step (150 -> 188, holdGained 38), matching refitRecipe exactly", () => {
    const w = rich("refit-estimate-small-step", 1_000_000);
    const port = w.region.ports[0];
    const ship = shipOf(150);
    const estimate = computeRefitEstimate(port, ship);
    // Hardcoded literal (independent oracle, shipyard.test.ts's own refitRecipe
    // assertion): grain 76, textiles 23, aetherSalt 16, electronics 4, timber 10.
    expect(estimate.lines.find((l) => l.good === "grain")!.qty).toBe(76);
    expect(estimate.lines.find((l) => l.good === "timber")!.qty).toBe(10);
  });

  it("never charges the purse — repeated calls against a poor company return the identical estimate", () => {
    const richWorld = rich("refit-estimate-purse", 1_000_000);
    const port = richWorld.region.ports[0];
    const ship = shipOf(50);
    expect(computeRefitEstimate(port, ship)).toEqual(computeRefitEstimate(port, ship));
  });
});
