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
npm run harness -- <script.ts>    # runs any harness entry point with tsx
```

**Slice 1 ships no entry point** — there is no file to put after `--` yet. The
script exists so the `run` CLI (#233) has a home; until then the harness is
exercised through its Vitest suite (`npm test`) or through a throwaway script
of your own.

## What exists today (slice 1, #232)

- `policy.ts` — the `Policy<M>` contract (`name`, optional `diagnostic`,
  `init`, `act`), polled every tick, plus `runPolicy(world, policy, days)`.
- `policies/doNothing.ts` — the null baseline.
- `policies/gradientLoop.ts` — the reference trader: buy a good where it is
  cheapest, sell it where it is dearest, repeat. A contract exercise and a
  baseline, **not** a balance statement.
- `policy.test.ts` — contract conformance and the determinism property (same
  policy + seed + days ⇒ deep-equal world and byte-equal Ledger).

Time is advanced through the sim's own seam, `advanceDays` (`src/sim/scenario.ts`),
which the sim's guardrail suites use as well — a Run and a Vitest scenario walk
identical code.

## What is coming

- `harness run` CLI, per-Run metrics, Batch reports (#233).
- Runtime invariant assertions and the anomaly list (#234).
- Direct play and script replay are deferred to v2 (owner lock, 2026-07-15).
