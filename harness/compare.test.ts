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

  it("b's median at exactly zero: no ratio, no tolerance verdict, an explanatory note, but a well-defined delta", () => {
    const a = fixture("a", 5);
    const b = fixture("b", 0);
    const result = compareBatches(a, b);
    expect(result.profitPerDayRatio).toBeNull();
    expect(result.aWithinTolerance).toBeNull();
    expect(result.profitPerDayRatioNote).toMatch(/b's median is 0/);
    expect(result.profitPerDayDelta).toBe(5);
  });

  it("both medians exactly zero: still no ratio, delta is 0, and the note says so", () => {
    const a = fixture("a", 0);
    const b = fixture("b", 0);
    const result = compareBatches(a, b);
    expect(result.profitPerDayRatio).toBeNull();
    expect(result.aWithinTolerance).toBeNull();
    expect(result.profitPerDayRatioNote).toMatch(/both medians are exactly 0/);
    expect(result.profitPerDayDelta).toBe(0);
  });

  it("a negative baseline: no ratio (a naive a/b would misread magnitude as direction), but the delta correctly shows a outearning b", () => {
    const a = fixture("a", -5);
    const b = fixture("b", -10);
    const result = compareBatches(a, b);
    expect(result.profitPerDayRatio).toBeNull();
    expect(result.aWithinTolerance).toBeNull();
    expect(result.profitPerDayRatioNote).toMatch(/negative/);
    // a=-5 outearns b=-10 by 5/day — the delta says so unambiguously.
    expect(result.profitPerDayDelta).toBe(5);
  });

  it("a strictly positive baseline still yields a ratio and a delta that agree in sign", () => {
    const a = fixture("a", 12);
    const b = fixture("b", 10);
    const result = compareBatches(a, b);
    expect(result.profitPerDayRatio).toBeCloseTo(1.2, 10);
    expect(result.profitPerDayRatioNote).toBeNull();
    expect(result.profitPerDayDelta).toBe(2);
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
