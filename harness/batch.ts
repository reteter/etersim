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
 *  nothing about which ticks run or in what order. */
export function runBatchRun<M>(
  world: World,
  policy: Policy<M>,
  days: number,
): { readonly world: World; readonly memory: M; readonly daily: readonly DaySnapshot[] } {
  let memory = policy.init(world);
  let current = world;
  const daily: DaySnapshot[] = [];
  for (let day = 1; day <= days; day++) {
    current = advanceDays(current, 1, (w) => {
      const step = policy.act(w, memory);
      memory = step.memory;
      return step.commands;
    });
    daily.push({
      day,
      tick: current.tick,
      ships: current.company.ships.map((s) => ({ shipId: s.id, hold: s.hold, used: cargoUsed(s) })),
      activeContracts: current.company.contracts.length,
    });
  }
  return { world: current, memory, daily };
}

/** One Run's full record: enough to reproduce it (`policy` + `seed` + `days`
 *  + `params`, per the Policy+seed=identical-game guarantee) and to write
 *  its Ledger and read its metrics. `ledger` is written to its own JSONL
 *  file by the CLI — kept off `report.json` so a Batch's aggregate report
 *  stays small regardless of Run count. */
export interface RunRecord {
  readonly policy: string;
  readonly params: Readonly<Record<string, unknown>>;
  readonly seed: number;
  readonly days: number;
  /** A literal, copy-pasteable command reproducing this Run alone. */
  readonly replayCommand: string;
  readonly metrics: RunMetrics;
  readonly ledger: readonly LedgerEvent[];
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

/** Runs one Policy over one seed, returning its full record. */
export function runOne(
  policyName: string,
  params: Readonly<Record<string, unknown>>,
  seed: number,
  days: number,
): RunRecord {
  const world0 = createWorld(seed);
  const policy = resolvePolicy(policyName, params);
  const { world, daily } = runBatchRun(world0, policy, days);
  const metrics = computeRunMetrics({
    ledger: world.ledger,
    daily,
    days,
    netWorthStart: computeNetWorth(world0),
    netWorthEnd: computeNetWorth(world),
    finalGuilds: world.company.guilds,
  });
  return {
    policy: policyName,
    params,
    seed,
    days,
    replayCommand: replayCommandFor(policyName, params, seed, days),
    metrics,
    ledger: world.ledger,
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

/** Per-seed medians/spreads across a Batch, over the metrics an agent reads
 *  first (spec §Evaluation model / §Portfolio note): profit/day, voyages,
 *  fleet hold utilization, final net worth. Every other per-Run metric stays
 *  reachable in `runs[].metrics` for a deeper read. */
/** One milestone kind's cross-seed distribution (#446 — "how long until the
 *  first ship launches, across N seeds" as a distribution instead of an
 *  anecdote). `worldDays` medians/spreads **only over the seeds that
 *  actually reached this milestone** — reading it without `reachedSeeds` is
 *  a category error (e.g. `reachedSeeds: 0` reports `{median:0,min:0,max:0}`
 *  by `aggregateStat`'s own empty-input convention, which means "no seed
 *  reached it", not "reached at world-day 0"). Units are **world-days, not
 *  wall-clock hours** — see `computeMilestoneTimings` (`harness/metrics.ts`)
 *  and PRD §Where 1.0 ends. */
export interface MilestoneAggregate {
  readonly kind: MilestoneKind;
  readonly reachedSeeds: number;
  readonly totalSeeds: number;
  readonly worldDays: AggregateStat;
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
      worldDays: aggregateStat(worldDaysValues),
    };
  });
}

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
): PolicyBatchReport {
  const runs = seeds.map((seed) => runOne(policyName, params, seed, days));
  const aggregate: BatchAggregate = {
    profitPerDay: aggregateStat(runs.map((r) => r.metrics.profitPerDay)),
    voyages: aggregateStat(runs.map((r) => r.metrics.voyages.total)),
    fleetHoldUtilization: aggregateStat(runs.map((r) => r.metrics.holdUtilization.fleetMean)),
    netWorthEnd: aggregateStat(runs.map((r) => r.metrics.netWorthEnd.total)),
    milestoneDays: aggregateMilestones(runs),
  };
  return { policy: policyName, params, seeds, days, runs, aggregate };
}
