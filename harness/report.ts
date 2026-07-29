import { aggregateStat, type PolicyBatchReport, type RunRecord } from "./batch.ts";
import { compareAllPairs, type PolicyComparison } from "./compare.ts";
import { GOOD_IDS } from "../src/sim/index.ts";

/**
 * Batch report writer (docs/specs/E11-proving-grounds.md §CLI / §Portfolio
 * note): builds the aggregate JSON report and renders its Markdown summary.
 * "Report writers derive; the emitter stays the sim's" (§Ledger schema) —
 * nothing here computes a metric; it only rounds, shapes and prints what
 * `harness/batch.ts` already computed.
 *
 * Rounding (incidents 0023/0024 — never pin full float precision): every
 * number in `report.json`/`report.md` is rounded to `ROUND_DP` decimal
 * places, stated here and restated in the Markdown itself.
 *
 * **`report.json` and `report.md` round independently from the same raw
 * numbers — never round-then-aggregate** (wave-check finding). `buildReport`
 * rounds each already-final `PolicyBatchReport`/`RunRecord` value once for
 * `report.json`. `renderMarkdown` takes the *raw* `PolicyBatchReport[]`
 * (the same objects `buildReport` was given, unrounded) and computes every
 * median/aggregate itself before rounding at print time — reading the
 * already-rounded `BatchReport` for anything numeric would recompute a
 * median over pre-rounded inputs, which can disagree with the same median
 * computed once from raw values and rounded after. The per-Run Ledger JSONL
 * files stay unrounded raw sim output throughout — rounding there would
 * violate "the emitter stays the sim's".
 */
export const ROUND_DP = 2;

export function round(x: number, dp: number = ROUND_DP): number {
  if (!Number.isFinite(x)) return x; // NaN/Infinity pass through unrounded — never coerced
  const factor = 10 ** dp;
  return Math.round(x * factor) / factor;
}

/** Rounds every numeric leaf of a JSON-serializable value to `dp` places,
 *  recursing through arrays and plain objects. Key order is whatever the
 *  input object's own construction produced (always the same code path for
 *  a given report shape, so this stays deterministic run-to-run — the
 *  determinism AC is about repeatability, not about JSON key stability
 *  across different reports). */
function deepRound(value: unknown, dp: number): unknown {
  if (typeof value === "number") return round(value, dp);
  if (Array.isArray(value)) return value.map((v) => deepRound(v, dp));
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = deepRound(v, dp);
    return out;
  }
  return value;
}

/** The anomaly list's shape (#234 owns *what counts as one*; this wave ships
 *  the plumbing only — every Run already carries `seed` and `replayCommand`,
 *  so a future check has everything it needs to flag one). Always empty in
 *  this wave's reports. */
export interface AnomalyEntry {
  readonly policy: string;
  readonly seed: number;
  readonly reason: string;
  readonly replayCommand: string;
}

/** One policy's rounded, JSON-safe Batch summary — `runs` keeps every field
 *  of `RunRecord` except the raw Ledger (written to its own JSONL file by
 *  the CLI, never embedded in `report.json`). */
export interface PolicyReportEntry {
  readonly policy: string;
  readonly params: Readonly<Record<string, unknown>>;
  readonly seeds: readonly number[];
  readonly runs: readonly Omit<RunRecord, "ledger">[];
  readonly aggregate: PolicyBatchReport["aggregate"];
}

export interface BatchReport {
  readonly days: number;
  readonly roundedToDp: number;
  /** ADR-0005 cadence note, restated here (not only in code comments) —
   *  stated once in the report, next to the numbers it qualifies. */
  readonly cadenceNote: string;
  readonly policies: readonly PolicyReportEntry[];
  readonly comparisons: readonly PolicyComparison[];
  readonly anomalies: readonly AnomalyEntry[];
}

export const CADENCE_NOTE =
  "A Run applies at most one command batch per tick (the Policy contract is polled once per tick). " +
  "The UI lets a paused player queue several commands between ticks (ADR-0005); a Run cannot reproduce " +
  "that burst cadence. These numbers describe scripted, per-tick play, not human play cadence.";

export const VOYAGES_CAVEAT =
  "\"Voyages\" counts dockingFee events — an arrival is only counted if the Company's purse had " +
  "at least 1 ₸ left to charge (`chargeDockingFee`, `src/sim/tick.ts`, skips the event entirely at " +
  "0 ₸). A Company that goes broke mid-Run will show fewer voyages than it actually sailed. " +
  "(Incident 0020: never treat a count from an unverified path as the result.)";

export function buildReport(policyBatches: readonly PolicyBatchReport[], days: number): BatchReport {
  const policies: PolicyReportEntry[] = policyBatches.map((batch) => ({
    policy: batch.policy,
    params: batch.params,
    seeds: batch.seeds,
    runs: batch.runs.map((run) => {
      const { policy, params, seed, days: runDays, replayCommand, metrics } = run;
      return { policy, params, seed, days: runDays, replayCommand, metrics };
    }),
    aggregate: batch.aggregate,
  }));
  const rounded = deepRound(policies, ROUND_DP) as readonly PolicyReportEntry[];
  const comparisons = deepRound(compareAllPairs(policyBatches), ROUND_DP) as readonly PolicyComparison[];
  return {
    days,
    roundedToDp: ROUND_DP,
    cadenceNote: CADENCE_NOTE,
    policies: rounded,
    comparisons,
    anomalies: [],
  };
}

function pct(fraction: number): string {
  return `${round(fraction * 100, 1)}%`;
}

/**
 * Markdown summary (spec §Portfolio note): legible to a reader who has never
 * seen the game. Names the units, defines a Run/thaler in one sentence
 * each, and never assumes the glossary.
 *
 * Takes the **raw** `policyBatches` (the same unrounded objects `buildReport`
 * was given) — every median/aggregate here is computed from raw per-Run
 * values and rounded once at print time; `report` supplies only the
 * non-numeric parts (`days`, `roundedToDp`, `cadenceNote`, `anomalies`) plus
 * the JSON's own rounded `comparisons` is *not* read either — comparisons
 * are recomputed here from the raw Batches for the same round-once reason.
 */
export function renderMarkdown(policyBatches: readonly PolicyBatchReport[], report: BatchReport): string {
  const lines: string[] = [];
  lines.push("# Batch report");
  lines.push("");
  lines.push(
    "This is a **Batch**: several complete playthroughs (**Runs**) of the trading simulation, " +
      "each played automatically by a scripted strategy (**Policy**) instead of a human. " +
      "Money in the game is counted in **thalers** (₸). Every number below is rounded to " +
      `${report.roundedToDp} decimal place(s).`,
  );
  lines.push("");
  lines.push(`> **Cadence note:** ${report.cadenceNote}`);
  lines.push("");
  lines.push(`Run length: **${report.days} days** per Run.`);
  lines.push("");

  for (const batch of policyBatches) {
    lines.push(`## Policy: \`${batch.policy}\``);
    if (Object.keys(batch.params).length > 0) {
      lines.push("");
      lines.push(`Parameters: \`${JSON.stringify(batch.params)}\``);
    }
    lines.push("");
    lines.push(`Seeds run: ${batch.seeds.join(", ")} (${batch.seeds.length} Run(s)).`);
    lines.push("");
    lines.push("### Batch aggregate (median across seeds, min–max spread)");
    lines.push("");
    lines.push(`> **Voyages caveat:** ${VOYAGES_CAVEAT}`);
    lines.push("");
    lines.push("| Metric | Median | Min | Max |");
    lines.push("| --- | --- | --- | --- |");
    lines.push(
      `| Profit/day (₸) | ${round(batch.aggregate.profitPerDay.median)} | ${round(batch.aggregate.profitPerDay.min)} | ${round(batch.aggregate.profitPerDay.max)} |`,
    );
    lines.push(
      `| Voyages (arrivals charged a docking fee — see caveat above) | ${round(batch.aggregate.voyages.median)} | ${round(batch.aggregate.voyages.min)} | ${round(batch.aggregate.voyages.max)} |`,
    );
    lines.push(
      `| Fleet hold utilization | ${pct(batch.aggregate.fleetHoldUtilization.median)} | ${pct(batch.aggregate.fleetHoldUtilization.min)} | ${pct(batch.aggregate.fleetHoldUtilization.max)} |`,
    );
    lines.push(
      `| Net worth at Run end (₸) | ${round(batch.aggregate.netWorthEnd.median)} | ${round(batch.aggregate.netWorthEnd.min)} | ${round(batch.aggregate.netWorthEnd.max)} |`,
    );
    lines.push("");

    lines.push("### Per-Run detail");
    lines.push("");
    lines.push(
      "| Seed | Profit/day (₸) | Voyages | Fleet hold util. | Cost lines (₸, always ≤ 0) | Revenue lines (₸, always ≥ 0) |",
    );
    lines.push("| --- | --- | --- | --- | --- | --- |");
    for (const run of batch.runs) {
      const costSummary = run.metrics.costLines
        .filter((l) => l.count > 0)
        .map((l) => `${l.kind}: ${round(l.thalers)}`)
        .join(", ");
      const revenueSummary = run.metrics.revenueLines
        .filter((l) => l.count > 0)
        .map((l) => `${l.kind}: ${round(l.thalers)}`)
        .join(", ");
      lines.push(
        `| ${run.seed} | ${round(run.metrics.profitPerDay)} | ${run.metrics.voyages.total} | ${pct(run.metrics.holdUtilization.fleetMean)} | ${costSummary || "(none)"} | ${revenueSummary || "(none)"} |`,
      );
    }
    lines.push("");

    lines.push("### Per-good P&L (median net thalers across seeds, buy cost netted against sell revenue)");
    lines.push("");
    lines.push(
      "_Caveat: if a Policy trades a different good per seed (as `gradientLoop` does — it picks its " +
        "gradient once per seed), the median across seeds can read 0 for every good even though every " +
        "individual Run traded briskly, because most seeds contribute a 0 for any single good's row. " +
        "Read the per-Run detail table above, or `report.json`, for the real per-seed picture._",
    );
    lines.push("");
    lines.push("| Good | Median net (₸) | Median bought (units) | Median sold (units) |");
    lines.push("| --- | --- | --- | --- |");
    for (const good of GOOD_IDS) {
      const nets = batch.runs.map((r) => r.metrics.goodsPnL.find((g) => g.good === good)?.netThalers ?? 0);
      const bought = batch.runs.map((r) => r.metrics.goodsPnL.find((g) => g.good === good)?.boughtQty ?? 0);
      const sold = batch.runs.map((r) => r.metrics.goodsPnL.find((g) => g.good === good)?.soldQty ?? 0);
      if (nets.every((n) => n === 0) && bought.every((n) => n === 0) && sold.every((n) => n === 0)) continue;
      lines.push(
        `| ${good} | ${round(aggregateStat(nets).median)} | ${round(aggregateStat(bought).median)} | ${round(aggregateStat(sold).median)} |`,
      );
    }
    lines.push("");

    lines.push(
      "### Strategy churn (median count of carried-good switches across seeds — a pendulum policy " +
        "switches often, an opportunist rarely)",
    );
    lines.push("");
    const switches = batch.runs.map((r) => r.metrics.churn.switches);
    lines.push(
      `Median switches per Run: **${round(aggregateStat(switches).median)}** (min ${round(aggregateStat(switches).min)}, max ${round(aggregateStat(switches).max)}).`,
    );
    lines.push("");

    lines.push("### Hold utilization per ship (median across seeds)");
    lines.push("");
    const shipIds = [...new Set(batch.runs.flatMap((r) => r.metrics.holdUtilization.byShip.map((s) => s.shipId)))];
    lines.push("| Ship | Median utilization |");
    lines.push("| --- | --- |");
    for (const shipId of shipIds) {
      const utils = batch.runs.map(
        (r) => r.metrics.holdUtilization.byShip.find((s) => s.shipId === shipId)?.meanUtilization ?? 0,
      );
      lines.push(`| ${shipId} | ${pct(aggregateStat(utils).median)} |`);
    }
    lines.push("");

    lines.push("### Settlement outcomes (guild contracts, summed across all seeds)");
    lines.push("");
    const settled = batch.runs.reduce(
      (acc, r) => ({
        met: acc.met + r.metrics.settlementCounts.met,
        missed: acc.missed + r.metrics.settlementCounts.missed,
        breached: acc.breached + r.metrics.settlementCounts.breached,
        resigned: acc.resigned + r.metrics.settlementCounts.resigned,
      }),
      { met: 0, missed: 0, breached: 0, resigned: 0 },
    );
    lines.push(
      `Met: ${settled.met}, missed: ${settled.missed}, breached: ${settled.breached}, resigned: ${settled.resigned}.`,
    );
    lines.push("");

    lines.push("### Guild rank/points at Run end (median final points across seeds, only guilds ever engaged)");
    lines.push("");
    const guildIds = [...new Set(batch.runs.flatMap((r) => r.metrics.guildStandings.map((g) => g.guildId)))];
    if (guildIds.length === 0) {
      lines.push("No guild ever enrolled or settled a contract in this Batch.");
    } else {
      lines.push("| Guild | Median final points | Median final rank |");
      lines.push("| --- | --- | --- |");
      for (const guildId of guildIds) {
        const points = batch.runs.map(
          (r) => r.metrics.guildStandings.find((g) => g.guildId === guildId)?.finalPoints ?? 0,
        );
        const ranks = batch.runs.map(
          (r) => r.metrics.guildStandings.find((g) => g.guildId === guildId)?.finalRank ?? 1,
        );
        lines.push(`| ${guildId} | ${round(aggregateStat(points).median)} | ${round(aggregateStat(ranks).median)} |`);
      }
    }
    lines.push("");

    lines.push("### Active-contract load (median count of contracts held at once, across all daily samples and seeds)");
    lines.push("");
    const loads = batch.runs.flatMap((r) => r.metrics.activeContractLoad.map((p) => p.count));
    lines.push(
      loads.length > 0
        ? `Median ${round(aggregateStat(loads).median)}, min ${round(aggregateStat(loads).min)}, max ${round(aggregateStat(loads).max)}.`
        : "No daily samples (a zero-day Run).",
    );
    lines.push("");

    lines.push("Replay any single Run with the command printed in its own record in `report.json`.");
    lines.push("");
  }

  const comparisons = compareAllPairs(policyBatches);
  if (comparisons.length > 0) {
    lines.push("## Head-to-head comparisons");
    lines.push("");
    lines.push(
      "Generalizes the game's own dominance guardrail (`src/sim/economy.test.ts`): a more effortful " +
        "strategy should not out-earn a simpler one by more than the stated tolerance, or the balance " +
        "goal it encodes is not holding. **Ratio and tolerance are only meaningful against a strictly " +
        "positive baseline (column B)** — against a zero or negative B, a raw ratio would misread " +
        "magnitude as direction, so those cells read \"n/a\" and the **delta** column (A − B, always " +
        "well-defined regardless of sign) is the one to trust instead.",
    );
    lines.push("");
    lines.push("| A | B | A median (₸/day) | B median (₸/day) | Delta A−B | Ratio A/B | A within tolerance? |");
    lines.push("| --- | --- | --- | --- | --- | --- | --- |");
    for (const c of comparisons) {
      const ratioCell = c.profitPerDayRatio === null ? `n/a (${c.profitPerDayRatioNote})` : `${round(c.profitPerDayRatio)}`;
      const withinCell = c.aWithinTolerance === null ? "n/a" : c.aWithinTolerance ? "yes" : "**no**";
      lines.push(
        `| ${c.a} | ${c.b} | ${round(c.aProfitPerDayMedian)} | ${round(c.bProfitPerDayMedian)} | ${round(c.profitPerDayDelta)} | ${ratioCell} | ${withinCell} |`,
      );
    }
    lines.push("");
  }

  lines.push("## Anomalies");
  lines.push("");
  if (report.anomalies.length === 0) {
    lines.push(
      "None flagged. This Batch does not run the invariant-assertion checks that decide what counts " +
        "as an anomaly (that check lands with #234); every Run's seed and replay command are still " +
        "recorded above for manual replay.",
    );
  } else {
    lines.push("| Policy | Seed | Reason | Replay |");
    lines.push("| --- | --- | --- | --- |");
    for (const a of report.anomalies) {
      lines.push(`| ${a.policy} | ${a.seed} | ${a.reason} | \`${a.replayCommand}\` |`);
    }
  }
  lines.push("");

  return lines.join("\n");
}
