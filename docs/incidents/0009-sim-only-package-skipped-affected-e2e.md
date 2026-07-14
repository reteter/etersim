# 0009 — "sim-only" wave package told the coder to skip e2e; a save-shape change broke an e2e fixture

- **Date:** 2026-07-14
- **Detected by:** CI (e2e job red on PR #170 after the coder-side and review gates were green)
- **Status:** Closed (fixture fixed + affected spec run locally in the same fix loop; WORKFLOW heuristic amended in this report's PR)

## What happened

E3 wave 1 batched #168 (dayBoundary refactor) + #92 (guilds/enrollment) to one coder.
The Orchestrator's task package stated "No UI changes in this wave → no Playwright
specs affected (sim-only; do not run e2e)". Implementing #92's save/load AC, the
coder — correctly — bumped `SAVE_VERSION` 5→6 (Company shape change, repo precedent),
and flagged the touch in its report. Nobody connected the bump to
`e2e/fixtures/ledger-scenario.json`, which carries `"version": 5`: persistence now
rejected the fixture and two `ledger.spec.ts` tests failed — but only on CI, because
the package had explicitly forbidden e2e runs. The tier-3 review also passed it: the
reviewer verified the bump as "correct and minimal" against persistence precedent,
not against fixture consumers.

(The same CI round also caught the #169 golden test pinning engine-dependent
`JSON.stringify` hashes — a separate testing lesson, fixed by rewriting to
platform-robust contracts, noted here for completeness.)

## Impact

- **Outcome:** Low — caught by CI pre-merge; one fix-loop round (fixture → v6 +
  `guilds: {}`, affected spec run locally, 7/7 green).
- **Failure-mode class:** Medium — with CI skipped under the flaky-runners merge
  policy, a merge would have landed a red e2e suite on `main` and the wave
  certification would have caught it only post-merge.
- **Rules broken/skipped:** coder minimum #3 (WORKFLOW §Verification gates —
  "affected Playwright specs") was overridden by the package's blanket "do not run
  e2e"; the affected-spec test was framed as "if UI changed", which a save-shape
  change never triggers.

## Recurrence

Medium — structural driver: the affected-e2e heuristic keyed on *UI paths*, but e2e
specs also depend on non-UI contracts (save fixtures, persistence shape, selectors
fed by sim state). Any future `World`/`Company` shape change repeats this unless the
heuristic keys on the whole diff.

## Recommendation

1. WORKFLOW coder minimum #3: key affected-e2e on the whole diff — UI paths **or**
   anything e2e artifacts depend on (`src/store/persistence.ts`, save/`World` shape,
   `e2e/fixtures/*`), and grep `e2e/` for fixtures, not just selectors. (Amended in
   this PR.)
2. Orchestrator package discipline: never phrase the e2e boundary as a blanket
   prohibition; state the heuristic and let the coder apply it to the diff it
   actually produced.
3. Reviewer packages for waves touching persistence: name fixture consumers
   explicitly as a check item.
