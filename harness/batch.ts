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
export interface BatchAggregate {
  readonly profitPerDay: AggregateStat;
  readonly voyages: AggregateStat;
  readonly fleetHoldUtilization: AggregateStat;
  readonly netWorthEnd: AggregateStat;
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
  };
  return { policy: policyName, params, seeds, days, runs, aggregate };
}
