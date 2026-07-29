/**
 * Public surface of the E11 Harness (docs/specs/E11-proving-grounds.md).
 * The Harness imports `src/sim` as a plain consumer (ADR-0002); the sim never
 * imports anything from here.
 */
export { runPolicy, type Policy, type RunResult } from "./policy.ts";
export { doNothing } from "./policies/doNothing.ts";
export {
  gradientLoop,
  type GradientLoopMemory,
  type GradientLoopParams,
} from "./policies/gradientLoop.ts";
export { POLICY_NAMES, POLICY_REGISTRY, resolvePolicy, type PolicyFactory } from "./policies/registry.ts";
// #233: the Batch runner + `harness run` CLI. The CLI entry (`cli.ts`) is
// invoked via `npm run harness -- run ...`, not imported — these exports are
// for a script or a test that wants to run a Batch programmatically.
export {
  aggregateMilestones,
  runBatchRun,
  runOne,
  runPolicyBatch,
  type AggregateStat,
  type BatchAggregate,
  type MilestoneAggregate,
  type PolicyBatchReport,
  type RunRecord,
} from "./batch.ts";
export {
  computeActiveContractLoad,
  computeChurn,
  computeCostLines,
  computeGoodsPnL,
  computeGuildStandings,
  computeHoldUtilization,
  computeMilestoneTimings,
  computeNetWorthCurve,
  computeRunMetrics,
  computeSettlementCounts,
  computeVoyages,
  reconcileThalers,
  signedThalers,
  type ChurnStats,
  type ComputeRunMetricsArgs,
  type CostLine,
  type DaySnapshot,
  type GoodPnL,
  type GuildStanding,
  type MilestoneTiming,
  type NetWorthPoint,
  type RunMetrics,
  type SettlementCounts,
  type ShipHoldUtilization,
  type ThalerReconciliation,
} from "./metrics.ts";
export { MILESTONE_KINDS, type MilestoneKind } from "./ledgerKinds.ts";
export { compareAllPairs, compareBatches, type PolicyComparison } from "./compare.ts";
export { parseSeeds, printHelp, runCommand, type RunCommandResult } from "./runCommand.ts";
export {
  buildReport,
  renderMarkdown,
  round,
  ROUND_DP,
  CADENCE_NOTE,
  WORLD_DAYS_NOTE,
  type AnomalyEntry,
  type BatchReport,
  type PolicyReportEntry,
} from "./report.ts";
