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
 *
 * **Ratio and "within tolerance" are only meaningful against a strictly
 * positive baseline** (wave-check finding: a naive `a/b` misreads direction
 * once either median is zero or negative — `a=-5, b=-10` divides to `0.5`,
 * which *reads* as "a earns half of b" when `a` in fact outearns `b`, and a
 * zero baseline divides to `NaN`/`Infinity`). Both fields are `null`, with
 * `profitPerDayRatioNote` saying why, whenever `b`'s median is not strictly
 * positive — `profitPerDayDelta` (`a - b`, always well-defined regardless of
 * sign) is the field to read in that case, and the report prose says so.
 */
export interface PolicyComparison {
  readonly a: string;
  readonly b: string;
  readonly aProfitPerDayMedian: number;
  readonly bProfitPerDayMedian: number;
  /** `a`'s median minus `b`'s — unambiguous regardless of sign, always the
   *  right field to read when `profitPerDayRatio` is `null`. */
  readonly profitPerDayDelta: number;
  /** `a`'s profit/day median as a multiple of `b`'s, defined only when `b`'s
   *  median is strictly positive (see class doc). `null` otherwise. */
  readonly profitPerDayRatio: number | null;
  /** Set iff `profitPerDayRatio` is `null`, explaining why no ratio is
   *  reported (both zero, `b` zero, or `b` negative). */
  readonly profitPerDayRatioNote: string | null;
  /** True when `a`'s median profit/day does not exceed `b`'s by more than
   *  `tolerance` (default 1.05, the #60 suite's own 5% — a tuning constant,
   *  callers may override it; §Laws 7 keeps it out of `src/sim`). `null`,
   *  not a bare boolean, when `b`'s median is not strictly positive — the
   *  #60 guardrail's own precondition is a positive-earning baseline, and a
   *  "yes"/"no" against a zero or negative one would carry no information
   *  (wave-check finding: a bold "no" there reads as a balance alarm it
   *  isn't). */
  readonly aWithinTolerance: boolean | null;
  readonly tolerance: number;
}

export function compareBatches(a: PolicyBatchReport, b: PolicyBatchReport, tolerance = 1.05): PolicyComparison {
  const aMedian = a.aggregate.profitPerDay.median;
  const bMedian = b.aggregate.profitPerDay.median;
  const delta = aMedian - bMedian;

  let ratio: number | null = null;
  let ratioNote: string | null = null;
  let within: boolean | null = null;

  if (bMedian > 0) {
    ratio = aMedian / bMedian;
    within = aMedian <= bMedian * tolerance;
  } else if (bMedian === 0 && aMedian === 0) {
    ratioNote = "both medians are exactly 0 — no ratio to report; delta is 0 too";
  } else if (bMedian === 0) {
    ratioNote = `${b.policy}'s median is 0 — a ratio against a zero baseline is undefined; read the delta instead`;
  } else {
    ratioNote = `${b.policy}'s median is negative — a ratio would misread magnitude as direction; read the delta instead`;
  }

  return {
    a: a.policy,
    b: b.policy,
    aProfitPerDayMedian: aMedian,
    bProfitPerDayMedian: bMedian,
    profitPerDayDelta: delta,
    profitPerDayRatio: ratio,
    profitPerDayRatioNote: ratioNote,
    aWithinTolerance: within,
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
