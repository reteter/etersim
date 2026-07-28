# Harness — the proving grounds

Headless evaluation harness for the simulation (epic E11 —
[spec](../docs/specs/E11-proving-grounds.md), terms in
[CONTEXT.md](../CONTEXT.md) §Harness & evaluation). It plays the game without a
browser so an agent can run games, compare strategies and hunt bugs, with every
game reproducible from a Policy and a seed.

Read this as an outsider: the game is a trading simulation. A **Policy** is a
strategy written as code; a **Run** is one game (policy + seed + day horizon); a
**Batch** is many Runs aggregated into a report.

## Placement rule

`harness/` sits outside the Vite bundle and imports `src/sim` as a plain
consumer — the sim never imports the harness (ADR-0002). Nothing here reaches
`dist/`; the harness runs on Node via `tsx`, and has its own TypeScript project
(`tsconfig.harness.json`, referenced from the solution `tsconfig.json`, so
`npm run typecheck` covers it).

```
npm run harness -- run --policy <name[,name2,...]> [--params <json>] --seeds <n|list> --days <d> --out <dir>
npm run harness -- <script.ts>    # runs any harness entry point with tsx
```

`harness run --help` prints the flag reference and the known policy names.

## What exists today (slice 1 #232 + slice 2 #233)

- `policy.ts` — the `Policy<M>` contract (`name`, optional `diagnostic`,
  `init`, `act`), polled every tick, plus `runPolicy(world, policy, days)`.
- `policies/doNothing.ts` — the null baseline.
- `policies/gradientLoop.ts` — the reference trader: buy a good where it is
  cheapest, sell it where it is dearest, repeat. A contract exercise and a
  baseline, **not** a balance statement.
- `policies/registry.ts` — name → factory lookup the CLI's `--policy` resolves
  through.
- `policy.test.ts` — contract conformance and the determinism property (same
  policy + seed + days ⇒ deep-equal world and byte-equal Ledger).
- `ledgerKinds.ts` — the Ledger's 19 kinds grouped (Goods/Costs/Milestones/
  Guild standing/Daily snapshot, per the spec's own §Ledger schema grouping),
  with a compile-time exhaustiveness check tying the grouping to
  `LedgerEvent["kind"]`.
- `metrics.ts` — pure per-Run metric derivations over a Ledger + daily fleet
  snapshots: profit/day, the net-worth curve, named cost lines, per-good P&L,
  voyages, hold utilization (per ship + fleet), strategy churn, guild rank/
  points trajectories, settlement outcome counts, active-contract load, and a
  thaler reconciliation (Ledger sum vs. the Company's observed purse delta —
  the Value law, verified as a test, not assumed).
- `batch.ts` — the Batch runner: `runBatchRun` (a day-chunked, tick-for-tick
  equivalent of `advanceDays` that also samples the fleet daily), `runOne`
  (one Policy + one seed → a full `RunRecord`), `runPolicyBatch` (N seeds →
  per-seed medians/spreads).
- `compare.ts` — head-to-head policy comparison (`compareBatches`,
  `compareAllPairs`), generalizing the #60 dominance guardrail
  (`src/sim/economy.test.ts`) into a reusable function.
- `report.ts` — builds the rounded, JSON-serializable Batch report and
  renders its Markdown summary (spec §Portfolio note: legible to a reader who
  has never seen the game).
- `cli.ts` — the `harness run` entry point (`npm run harness -- run ...`),
  writing `runs/<policy>-seed<seed>.jsonl` (raw, unrounded Ledgers),
  `report.json` and `report.md` under `--out`.

Time is advanced through the sim's own seam, `advanceDays` (`src/sim/scenario.ts`),
which the sim's guardrail suites use as well — a Run and a Vitest scenario walk
identical code.

**Command-cadence note (ADR-0005):** a Run polls its Policy once per tick and
applies at most one command batch per tick — it does not model the UI's
paused-player command bursts. Every `report.md` states this next to its own
numbers.

## What is coming

- Runtime invariant assertions and the anomaly list (#234, on top of the
  anomaly-list plumbing this wave ships: every Run already carries its seed
  and a literal replay command, `report.json`'s `anomalies` array is typed
  and always empty until #234 fills in what counts as one).
- Direct play and script replay are deferred to v2 (owner lock, 2026-07-15).
