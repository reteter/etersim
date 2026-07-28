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
export const COST_KINDS = [
  "dockingFee",
  "upkeep",
  "laborFee",
  "enrollmentFee",
  "contractFee",
  "autoDraw",
  "rush",
] as const;
export const MILESTONE_KINDS = [
  "founding",
  "launch",
  "shipyardBuilt",
  "refitStart",
  "refitComplete",
  "completed",
] as const;
export const STANDING_KINDS = ["settlement"] as const;
export const SNAPSHOT_KINDS = ["netWorth"] as const;

export const ALL_LEDGER_KINDS = [
  ...GOODS_KINDS,
  ...COST_KINDS,
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
