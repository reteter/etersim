import { describe, expect, it } from "vitest";
import { emptyCargo, type Ship } from "./ship";
import {
  holdLadder,
  nextHoldStep,
  refitRecipe,
  HOLD_LADDER,
  REFIT_MATERIAL_FACTOR,
  REFIT_LABOR_FEE,
} from "./shipyard";

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
});
