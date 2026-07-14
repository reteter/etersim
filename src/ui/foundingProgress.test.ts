import { describe, expect, it } from "vitest";
import { CONSTRUCTION_RESERVE, HEADQUARTERS_COST } from "../sim";
import { FOUNDING_GOAL, foundingProgress, foundingSavings } from "./foundingProgress";

describe("FOUNDING_GOAL", () => {
  it("equals the real founding gate — cost + Reserve, never the bare cost (#157)", () => {
    // The commands.ts gate is `thalers < HEADQUARTERS_COST + CONSTRUCTION_RESERVE`;
    // a bar targeting anything else reads 100% while the button is still
    // disabled — the forbidden display-vs-gate drift.
    expect(FOUNDING_GOAL).toBe(HEADQUARTERS_COST + CONSTRUCTION_RESERVE);
    expect(FOUNDING_GOAL).toBeGreaterThan(HEADQUARTERS_COST);
  });
});

describe("foundingSavings", () => {
  it("passes a mid-goal purse through unchanged", () => {
    expect(foundingSavings(1500)).toBe(1500);
  });

  it("clamps into [0, FOUNDING_GOAL] — the single clamp every bar representation derives from", () => {
    expect(foundingSavings(FOUNDING_GOAL * 3)).toBe(FOUNDING_GOAL);
    expect(foundingSavings(-100)).toBe(0);
  });
});

describe("foundingProgress", () => {
  it("is 0 for an empty purse", () => {
    expect(foundingProgress(0)).toBe(0);
  });

  it("is proportional below the goal", () => {
    expect(foundingProgress(FOUNDING_GOAL / 2)).toBe(0.5);
  });

  it("reaches exactly 1 at the gate — the bar fills when the button enables", () => {
    expect(foundingProgress(FOUNDING_GOAL)).toBe(1);
  });

  it("clamps at 1 above the goal", () => {
    expect(foundingProgress(FOUNDING_GOAL * 3)).toBe(1);
  });

  it("clamps at 0 for a negative purse", () => {
    expect(foundingProgress(-100)).toBe(0);
  });
});
