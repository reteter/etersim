import { describe, expect, it } from "vitest";
import { createWorld, emptyCargo, refitRecipe, type Region, type Ship, type Shipyard } from "../sim";
import { refitBubbleData } from "./refitBubble";

function baseRegion(): Region {
  return createWorld("refit-bubble").region;
}

function ship(id: string, hold = 50, baseHold = 50): Ship {
  return {
    id,
    name: `Ship ${id}`,
    hold,
    baseHold,
    cargo: emptyCargo(),
    location: { kind: "docked", portId: "a" },
  };
}

describe("refitBubbleData", () => {
  it("is null with no Shipyard", () => {
    expect(refitBubbleData(undefined, [ship("s0")], baseRegion())).toBeNull();
  });

  it("is null with a Shipyard but no active RefitOrder", () => {
    const region = baseRegion();
    const shipyard: Shipyard = { portId: region.ports[0].id };
    expect(refitBubbleData(shipyard, [ship("s0")], region)).toBeNull();
  });

  it("is null when the RefitOrder's ship can't be found (defensive)", () => {
    const region = baseRegion();
    const shipyard: Shipyard = {
      portId: region.ports[0].id,
      refitOrder: { shipId: "missing", targetHold: 100, siteStore: {} as never },
    };
    expect(refitBubbleData(shipyard, [ship("s0")], region)).toBeNull();
  });

  it("computes aggregate progress and per-good remaining for a partially-filled site", () => {
    const region = baseRegion();
    const target = ship("s0");
    const recipe = refitRecipe(target); // baseHold 50 -> 100: recipe == SHIP_RECIPE
    const shipyard: Shipyard = {
      portId: region.ports[0].id,
      refitOrder: {
        shipId: target.id,
        targetHold: 100,
        // Half of grain, none of the rest.
        siteStore: { grain: Math.floor(recipe.grain / 2), textiles: 0, aetherSalt: 0, electronics: 0, timber: 0 },
      },
    };
    const data = refitBubbleData(shipyard, [target], region);
    expect(data).not.toBeNull();
    expect(data!.shipId).toBe("s0");
    expect(data!.targetHold).toBe(100);
    expect(data!.portId).toBe(region.ports[0].id);

    const required = Object.values(recipe).reduce((a, b) => a + b, 0);
    const filled = Math.floor(recipe.grain / 2);
    expect(data!.required).toBe(required);
    expect(data!.filled).toBe(filled);
    expect(data!.progress).toBeCloseTo(filled / required);

    // grain is short by ceil(recipe.grain / 2); the other four goods are
    // short by their full recipe amount — 5 goods total, none fully filled.
    expect(data!.remaining).toHaveLength(5);
    const grainRemaining = data!.remaining.find((r) => r.good === "grain")!;
    expect(grainRemaining.remaining).toBe(recipe.grain - Math.floor(recipe.grain / 2));
  });

  it("clamps progress at 1 and reports no remaining goods once the site fully covers the recipe", () => {
    const region = baseRegion();
    const target = ship("s0");
    const recipe = refitRecipe(target);
    const shipyard: Shipyard = {
      portId: region.ports[0].id,
      refitOrder: { shipId: target.id, targetHold: 100, siteStore: { ...recipe } },
    };
    const data = refitBubbleData(shipyard, [target], region);
    expect(data!.progress).toBe(1);
    expect(data!.remaining).toHaveLength(0);
  });
});
