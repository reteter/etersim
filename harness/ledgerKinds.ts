import type { LedgerEvent } from "../src/sim/index.ts";

/**
 * Ledger kind classification (docs/specs/E11-proving-grounds.md §Ledger
 * schema, the #203 grammar law): the harness reads `src/sim/ledger.ts`'s
 * union and groups it — it never defines its own shape ("Report writers
 * derive; the emitter stays the sim's").
 *
 * The five groups below are the schema's own grouping (spec §Ledger schema,
 * "Kinds as built (2026-07-28)"), copied here as canonical order arrays
 * rather than iterated via `Object.keys` — determinism (§Laws 1): iteration
 * order must never depend on object key insertion order for anything that
 * reaches a report (mirrors `GOOD_IDS`/`ECONOMIC_ARCHETYPES` in `src/sim`).
 *
 * The `LEDGER_KIND_CHECK` switch below is a compile-time exhaustiveness
 * check: a 20th `LedgerEvent` kind added to the sim and left unclassified
 * here fails to typecheck, the same guarantee `ledger.test.ts` gives the
 * grammar law itself.
 */
export const GOODS_KINDS = ["trade", "delivery", "store", "withdraw"] as const;
/** Every kind here is a debit against the Company's purse, verified by
 *  `metrics.test.ts`'s invariant test (every `CostLine.thalers <= 0` over a
 *  fixture covering all of them). `contractFee` is deliberately **not**
 *  here, even though the spec's own §Ledger schema "Costs" grouping lists
 *  it — `contract.ts:337,341` (`settleOne`) pays `feePerPeriod` *to* the
 *  Company on a met settlement, so it is a credit, not a sink. That spec
 *  wording is a misnomer against as-built (tracked as its own finding,
 *  outside this wave's scope — §Laws 7/8: not something to quietly patch
 *  here). See `REVENUE_KINDS` below for where `contractFee` lives instead. */
export const COST_KINDS = ["dockingFee", "upkeep", "laborFee", "enrollmentFee", "autoDraw", "rush"] as const;
/** Thaler-carrying kinds that are credits to the Company's purse, `trade`
 *  (on the `sell` side) aside — today just the met-contract fee. */
export const REVENUE_KINDS = ["contractFee"] as const;
export const MILESTONE_KINDS = [
  "founding",
  "launch",
  "shipyardBuilt",
  "refitStart",
  "refitComplete",
  "completed",
] as const;
export type MilestoneKind = (typeof MILESTONE_KINDS)[number];
export const STANDING_KINDS = ["settlement"] as const;
export const SNAPSHOT_KINDS = ["netWorth"] as const;

export const ALL_LEDGER_KINDS = [
  ...GOODS_KINDS,
  ...COST_KINDS,
  ...REVENUE_KINDS,
  ...MILESTONE_KINDS,
  ...STANDING_KINDS,
  ...SNAPSHOT_KINDS,
] as const;

export type LedgerKind = LedgerEvent["kind"];

/** Kinds that carry a `thalers` movement of the Company's own purse, i.e.
 *  every thaler-carrying kind *except* `netWorth` (a snapshot of the total,
 *  not a movement — including it in a reconciliation sum would double-count).
 *  Used by the batch reconciliation check (harness/metrics.ts) and by the
 *  per-kind cost-line aggregation (spec §Evaluation model, "net of the money
 *  sinks"). */
export const THALER_MOVEMENT_KINDS = [
  "trade",
  "dockingFee",
  "upkeep",
  "laborFee",
  "enrollmentFee",
  "contractFee",
  "autoDraw",
  "rush",
  "founding",
  "refitStart",
] as const;

/** Compile-time-only: a switch over every `LedgerEvent["kind"]` that must
 *  stay exhaustive. If `src/sim/ledger.ts` grows a 20th kind, this function
 *  fails to typecheck until it is added to one of the arrays above. Never
 *  called at runtime. */
function assertLedgerKindClassified(kind: LedgerKind): true {
  switch (kind) {
    case "trade":
    case "delivery":
    case "store":
    case "withdraw":
    case "dockingFee":
    case "upkeep":
    case "laborFee":
    case "enrollmentFee":
    case "contractFee":
    case "autoDraw":
    case "rush":
    case "founding":
    case "launch":
    case "shipyardBuilt":
    case "refitStart":
    case "refitComplete":
    case "completed":
    case "settlement":
    case "netWorth":
      return true;
  }
}
// Referenced so the exhaustiveness check is not dead-code-eliminated away
// by a stricter bundler/linter in the future; never invoked meaningfully.
void assertLedgerKindClassified;
