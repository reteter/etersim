import { describe, expect, it } from "vitest";
import type { PolicyBatchReport } from "./batch.ts";
import { compareAllPairs, compareBatches } from "./compare.ts";

/** A minimal, synthetic PolicyBatchReport fixture — only `policy` and
 *  `aggregate.profitPerDay.median` are read by `compareBatches`, so the rest
 *  is filled with harmless placeholders rather than a real Batch run. */
function fixture(policy: string, profitPerDayMedian: number): PolicyBatchReport {
  return {
    policy,
    params: {},
    seeds: [1],
    days: 1,
    runs: [],
    aggregate: {
      profitPerDay: { median: profitPerDayMedian, min: profitPerDayMedian, max: profitPerDayMedian },
      voyages: { median: 0, min: 0, max: 0 },
      fleetHoldUtilization: { median: 0, min: 0, max: 0 },
      netWorthEnd: { median: 0, min: 0, max: 0 },
    },
  };
}

describe("compareBatches — the #60 dominance guardrail, generalized", () => {
  it("a dominant policy (earns clearly more) is not within b's tolerance the other direction", () => {
    const camp = fixture("camp", 10);
    const loop = fixture("loop", 12);
    const result = compareBatches(camp, loop);
    expect(result.profitPerDayRatio).toBeCloseTo(10 / 12, 10);
    expect(result.aWithinTolerance).toBe(true); // 10 <= 12*1.05
  });

  it("flags a violation when a earns more than tolerance allows over b (mirrors the #60 assertion)", () => {
    const camp = fixture("camp", 13);
    const loop = fixture("loop", 10);
    const result = compareBatches(camp, loop);
    expect(result.aWithinTolerance).toBe(false); // 13 > 10*1.05
  });

  it("a custom tolerance is honored", () => {
    const a = fixture("a", 11);
    const b = fixture("b", 10);
    // 11 <= 10*1.2 (12) -> true; 11 <= 10*1.05 (10.5) -> false.
    expect(compareBatches(a, b, 1.2).aWithinTolerance).toBe(true);
    expect(compareBatches(a, b, 1.05).aWithinTolerance).toBe(false);
  });

  it("b's median at exactly zero reports NaN rather than Infinity or a silent 0", () => {
    const a = fixture("a", 5);
    const b = fixture("b", 0);
    const result = compareBatches(a, b);
    expect(Number.isNaN(result.profitPerDayRatio)).toBe(true);
  });
});

describe("compareAllPairs", () => {
  it("produces no comparisons for fewer than two policies", () => {
    expect(compareAllPairs([])).toEqual([]);
    expect(compareAllPairs([fixture("solo", 1)])).toEqual([]);
  });

  it("produces exactly one comparison per unordered pair, in input order, no reverse duplicates", () => {
    const reports = [fixture("p1", 1), fixture("p2", 2), fixture("p3", 3)];
    const pairs = compareAllPairs(reports).map((c) => [c.a, c.b]);
    expect(pairs).toEqual([
      ["p1", "p2"],
      ["p1", "p3"],
      ["p2", "p3"],
    ]);
  });
});
