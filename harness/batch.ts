import {
  advanceDays,
  cargoUsed,
  computeNetWorth,
  createWorld,
  type LedgerEvent,
  type World,
} from "../src/sim/index.ts";
import { computeRunMetrics, type DaySnapshot, type RunMetrics } from "./metrics.ts";
import type { Policy } from "./policy.ts";
import { resolvePolicy } from "./policies/registry.ts";
import { MILESTONE_KINDS, type MilestoneKind } from "./ledgerKinds.ts";
import { checkInvariants, dedupeViolationsByDay, type ViolationOccurrence } from "./invariants.ts";

/** Anomaly entry for the report (#234 — world-model implications). */
export interface AnomalyEntry {
  readonly policy: string;
  readonly seed: number;
  readonly reason: string;
  readonly replayCommand: string;
}

/**
 * Batch runner (#233, docs/specs/E11-proving-grounds.md §Evaluation model /
 * §CLI). Runs one Policy over one seed ("a Run"), or many seeds ("a Batch"),
 * sampling the fleet at every day boundary so hold utilization and
 * active-contract load — neither on the Ledger — are still reportable
 * (spec: "hold utilization (per ship + fleet rollup)", "active-contract load
 * over time").
 *
 * **ADR-0005 cadence note**: a Run applies at most one command batch per
 * tick, the same cadence the sim itself enforces inside `tick()`. The UI
 * lets a paused player queue several `applyCommand` calls between ticks —
 * this runner cannot reproduce that burst cadence, because a Policy is
 * polled once per tick by design (docs/specs/E11-proving-grounds.md §Policy
 * contract). Numbers from a Batch describe *scripted* play, not human
 * cadence — stated again in the Markdown report, where the reader meets the
 * numbers (task package, "Command-cadence fidelity").
 *
 * **Thaler reconciliation coverage (#449).** `runOne`'s Run is checked against
 * `reconcileThalers` (`harness/metrics.ts`, where the reconciliation itself
 * lives — `harness/batch.test.ts`'s "reconciles every thaler movement..."
 * test is the real-Run guard) over all ten `THALER_MOVEMENT_KINDS`
 * (`harness/ledgerKinds.ts`). But **a real Run over the reference policies
 * (`doNothing`, `gradientLoop`) exercises only three of them**: `trade`,
 * `dockingFee` and `upkeep` — neither policy founds a Headquarters, builds,
 * enrolls in a guild or refits, so `laborFee`, `enrollmentFee`, `contractFee`,
 * `autoDraw`, `rush`, `founding` and `refitStart` never appear in a real
 * seed's Ledger. Those seven are guarded **only** by the synthetic Ledger
 * fixture in `harness/metrics.test.ts` ("reconcileThalers over a synthetic
 * fixture covering all ten THALER_MOVEMENT_KINDS") — a green reconciliation
 * over N real seeds proves the Value law for the three kinds a Run actually
 * moves, nothing about the other seven. A builder/contractor reference
 * policy would close that gap for real Runs (out of scope here, #449).
 */

/** Advances `world` one day at a time rather than in one `advanceDays(world,
 *  days, decide)` call, purely so the fleet can be sampled at each day
 *  boundary — tick-for-tick identical to the one-shot call (guarded by
 *  `batch.test.ts`'s equivalence property), since chunking by day changes
 *  nothing about which ticks run or in what order.
 *
 *  **Invariant assertions (#234)**: toggleable runtime checks at each day
 *  boundary. When `options.enableAssertions` is set, `checkInvariants` is
 *  called at every day boundary and violations are collected (deduped by
 *  reason, `dedupeViolationsByDay`). Disabled by default — `harness run
 *  --enable-assertions` (`runCommand.ts`) is the CLI path that turns this on
 *  for an explicit bug-hunt run; a plain `harness run` never pays the extra
 *  per-day check cost. */
export function runBatchRun<M>(
  world: World,
  policy: Policy<M>,
  days: number,
  options: { enableAssertions?: boolean } = {},
): {
  readonly world: World;
  readonly memory: M;
  readonly daily: readonly DaySnapshot[];
  readonly anomalyReasons: readonly string[];
} {
  let memory = policy.init(world);
  let current = world;
  const daily: DaySnapshot[] = [];
  const occurrences: ViolationOccurrence[] = [];

  for (let day = 1; day <= days; day++) {
    current = advanceDays(current, 1, (w) => {
      const step = policy.act(w, memory);
      memory = step.memory;
      return step.commands;
    });

    // Collect invariant violations at the day boundary if assertions are
    // enabled. Dedup happens once, after the loop (dedupeViolationsByDay) —
    // not here — so a persistent violation across many days is recorded
    // once, at the day it first appeared, not once per day.
    if (options.enableAssertions) {
      for (const reason of checkInvariants(current)) {
        occurrences.push({ day, reason });
      }
    }

    daily.push({
      day,
      tick: current.tick,
      ships: current.company.ships.map((s) => ({ shipId: s.id, hold: s.hold, used: cargoUsed(s) })),
      activeContracts: current.company.contracts.length,
    });
  }
  return { world: current, memory, daily, anomalyReasons: dedupeViolationsByDay(occurrences) };
}

/** One Run's full record: enough to reproduce it (`policy` + `seed` + `days`
 *  + `params`, per the Policy+seed=identical-game guarantee) and to write
 *  its Ledger and read its metrics. `ledger` is written to its own JSONL
 *  file by the CLI — kept off `report.json` so a Batch's aggregate report
 *  stays small regardless of Run count. Anomalies (#234) list invariant
 *  violations caught at day boundaries. */
export interface RunRecord {
  readonly policy: string;
  readonly params: Readonly<Record<string, unknown>>;
  readonly seed: number;
  readonly days: number;
  /** A literal, copy-pasteable command reproducing this Run alone. */
  readonly replayCommand: string;
  readonly metrics: RunMetrics;
  readonly ledger: readonly LedgerEvent[];
  /** Invariant violations caught during this Run (#234). Empty if assertions
   *  were disabled or no violations occurred. */
  readonly anomalies: readonly AnomalyEntry[];
}

/** Builds a literal, copy-pasteable command that reproduces exactly this one
 *  Run. `--seeds ${seed},` (a trailing comma) is deliberate, not a typo — it
 *  is what `parseSeeds` (`harness/runCommand.ts`) requires to read a single
 *  seed as an explicit one-element list rather than as "seeds 1..N"; a bare
 *  `--seeds ${seed}` would replay N Runs starting at seed 1, not this Run. */
function replayCommandFor(policy: string, params: Readonly<Record<string, unknown>>, seed: number, days: number): string {
  const paramsFlag = Object.keys(params).length > 0 ? ` --params '${JSON.stringify(params)}'` : "";
  return `npm run harness -- run --policy ${policy}${paramsFlag} --seeds ${seed}, --days ${days} --out <dir>`;
}

/** Runs one Policy over one seed, returning its full record.
 *
 *  `options.world0` overrides the seed-derived starting World —
 *  a test-only seam (never used by the CLI, which always starts from
 *  `createWorld(seed)`) that lets a test drive a deliberately-broken World
 *  fixture through the real `runOne` → `buildReport` wiring instead of
 *  exercising `checkInvariants` in isolation. */
export function runOne(
  policyName: string,
  params: Readonly<Record<string, unknown>>,
  seed: number,
  days: number,
  options: { enableAssertions?: boolean; world0?: World } = {},
): RunRecord {
  const world0 = options.world0 ?? createWorld(seed);
  const policy = resolvePolicy(policyName, params);
  const { world, daily, anomalyReasons } = runBatchRun(world0, policy, days, options);
  const replayCmd = replayCommandFor(policyName, params, seed, days);
  const metrics = computeRunMetrics({
    ledger: world.ledger,
    daily,
    days,
    netWorthStart: computeNetWorth(world0),
    netWorthEnd: computeNetWorth(world),
    finalGuilds: world.company.guilds,
  });

  // Build AnomalyEntry objects from violation reasons.
  const anomalies: AnomalyEntry[] = anomalyReasons.map((reason) => ({
    policy: policyName,
    seed,
    reason,
    replayCommand: replayCmd,
  }));

  return {
    policy: policyName,
    params,
    seed,
    days,
    replayCommand: replayCmd,
    metrics,
    ledger: world.ledger,
    anomalies,
  };
}

export interface AggregateStat {
  readonly median: number;
  readonly min: number;
  readonly max: number;
}

function median(sorted: readonly number[]): number {
  const n = sorted.length;
  if (n === 0) return 0;
  const mid = Math.floor(n / 2);
  return n % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export function aggregateStat(values: readonly number[]): AggregateStat {
  if (values.length === 0) return { median: 0, min: 0, max: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  return { median: median(sorted), min: sorted[0], max: sorted[sorted.length - 1] };
}

/** One milestone kind's cross-seed distribution (#446 — "how long until the
 *  first ship launches, across N seeds" as a distribution instead of an
 *  anecdote). `worldDays` is `null` when `reachedSeeds === 0` — a milestone
 *  no seed reached is **unrepresentable** as a number rather than encoded as
 *  `{median:0,min:0,max:0}` (wave-check finding, B1: `aggregateStat([])`'s
 *  empty-input convention, read by a consumer that never checks
 *  `reachedSeeds`, silently reads as "reached at world-day 0" — the same
 *  "confidently wrong number, no crash" class #449 exists to close, one
 *  level up). Mirrors the per-Run shape one level down
 *  (`MilestoneTiming.worldDays: number | null`, `harness/metrics.ts`) —
 *  one encoding for "unreached", not two. Units are **world-days, not
 *  wall-clock hours** — see `computeMilestoneTimings` and PRD §Where 1.0
 *  ends. */
export interface MilestoneAggregate {
  readonly kind: MilestoneKind;
  readonly reachedSeeds: number;
  readonly totalSeeds: number;
  readonly worldDays: AggregateStat | null;
}

/** Per-kind medians/spreads over `MILESTONE_KINDS`, in that array's canonical
 *  order, across every Run in a Batch — the batch-aggregate half of #446. */
export function aggregateMilestones(runs: readonly RunRecord[]): readonly MilestoneAggregate[] {
  return MILESTONE_KINDS.map((kind) => {
    const reached = runs
      .map((r) => r.metrics.milestoneTimings.find((m) => m.kind === kind))
      .filter((m) => m !== undefined && m.reached && m.worldDays !== null);
    const worldDaysValues = reached.map((m) => m!.worldDays!);
    return {
      kind,
      reachedSeeds: reached.length,
      totalSeeds: runs.length,
      worldDays: reached.length > 0 ? aggregateStat(worldDaysValues) : null,
    };
  });
}

/** Per-seed medians/spreads across a Batch, over the metrics an agent reads
 *  first (spec §Evaluation model / §Portfolio note): profit/day, voyages,
 *  fleet hold utilization, final net worth, world-days to milestone
 *  (`milestoneDays`, #446). Every other per-Run metric stays reachable in
 *  `runs[].metrics` for a deeper read. */
export interface BatchAggregate {
  readonly profitPerDay: AggregateStat;
  readonly voyages: AggregateStat;
  readonly fleetHoldUtilization: AggregateStat;
  readonly netWorthEnd: AggregateStat;
  readonly milestoneDays: readonly MilestoneAggregate[];
}

export interface PolicyBatchReport {
  readonly policy: string;
  readonly params: Readonly<Record<string, unknown>>;
  readonly seeds: readonly number[];
  readonly days: number;
  readonly runs: readonly RunRecord[];
  readonly aggregate: BatchAggregate;
}

/** Runs one Policy over every seed in the grid — the Batch (CONTEXT.md:
 *  "N Runs over a seed/parameter grid, aggregated into one report"). */
export function runPolicyBatch(
  policyName: string,
  params: Readonly<Record<string, unknown>>,
  seeds: readonly number[],
  days: number,
  options: { enableAssertions?: boolean } = {},
): PolicyBatchReport {
  const runs = seeds.map((seed) => runOne(policyName, params, seed, days, options));
  const aggregate: BatchAggregate = {
    profitPerDay: aggregateStat(runs.map((r) => r.metrics.profitPerDay)),
    voyages: aggregateStat(runs.map((r) => r.metrics.voyages.total)),
    fleetHoldUtilization: aggregateStat(runs.map((r) => r.metrics.holdUtilization.fleetMean)),
    netWorthEnd: aggregateStat(runs.map((r) => r.metrics.netWorthEnd.total)),
    milestoneDays: aggregateMilestones(runs),
  };
  return { policy: policyName, params, seeds, days, runs, aggregate };
}
