import type { PolicyBatchReport } from "./batch.ts";

/**
 * Head-to-head policy comparison (docs/specs/E11-proving-grounds.md §Evaluation
 * model: "the #60 dominance guardrail generalized into a reusable
 * comparison"). `src/sim/economy.test.ts`'s dominance suite compares two
 * scripted bots' profit/day with a fixed tolerance ("camping earns no more
 * than a simple loop, within 5%") — this is that same comparison, lifted out
 * of one hand-written test into a function two Batches' medians can call.
 *
 * A pure function over two already-computed `PolicyBatchReport`s (never over
 * `World`), so #234 (the anomaly-checking issue) or a future comparison
 * mode can reuse it without re-running anything.
 */
export interface PolicyComparison {
  readonly a: string;
  readonly b: string;
  /** `a`'s profit/day median as a fraction of `b`'s (>1 means `a` outearns
   *  `b`). `NaN` when `b`'s median is exactly 0 — reported as such, never
   *  silently coerced to 0 or Infinity. */
  readonly profitPerDayRatio: number;
  readonly aProfitPerDayMedian: number;
  readonly bProfitPerDayMedian: number;
  /** True when `a`'s median profit/day does not exceed `b`'s by more than
   *  `tolerance` (default 1.05, the #60 suite's own 5% — a tuning constant,
   *  callers may override it; §Laws 7 keeps it out of `src/sim`). */
  readonly aWithinTolerance: boolean;
  readonly tolerance: number;
}

export function compareBatches(a: PolicyBatchReport, b: PolicyBatchReport, tolerance = 1.05): PolicyComparison {
  const aMedian = a.aggregate.profitPerDay.median;
  const bMedian = b.aggregate.profitPerDay.median;
  return {
    a: a.policy,
    b: b.policy,
    profitPerDayRatio: bMedian === 0 ? NaN : aMedian / bMedian,
    aProfitPerDayMedian: aMedian,
    bProfitPerDayMedian: bMedian,
    aWithinTolerance: aMedian <= bMedian * tolerance,
    tolerance,
  };
}

/** All pairwise comparisons across `reports`, in the input order (a Batch
 *  with policies `[p1, p2, p3]` yields `p1×p2, p1×p3, p2×p3` — no reverse
 *  duplicates, since `compareBatches(a, b)` and `compareBatches(b, a)` carry
 *  the same two medians). Empty for fewer than two policies — a
 *  single-policy Batch has nothing to compare against (the CLI does not
 *  inject a baseline it wasn't asked to run). */
export function compareAllPairs(reports: readonly PolicyBatchReport[]): readonly PolicyComparison[] {
  const comparisons: PolicyComparison[] = [];
  for (let i = 0; i < reports.length; i++) {
    for (let j = i + 1; j < reports.length; j++) {
      comparisons.push(compareBatches(reports[i], reports[j]));
    }
  }
  return comparisons;
}
