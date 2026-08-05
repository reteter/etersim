# Incident 0032 — a merge-gate decision was taken on a number derived from a proxy, not from the tool

- **Date:** 2026-07-30
- **Session:** E16 visual board — the 2026-07-30 directive, spec section and merge
- **Reporter:** session driver (Opus 5)
- **Severity:** Medium (near-miss on the decision, not on the code)

## What happened

The owner asked to merge `proto/e16-visual-board`.
Two gates stood in the way, and the driver named both before merging:
the branch's own merge gate (no merge without the spec's visual-contract section) and the state of
the Playwright suite.

For the second gate the driver reported **"14 wyłączonych speców e2e"**, and derived that number
from `grep -c "test.skip\|describe.skip\|it.skip" e2e/*.spec.ts` —
a count of suspended specs, which is *not* the same question as "what is the state of the gate".
The owner was then asked to choose between three merge paths and picked the most expensive one
("najpierw spec + review, potem merge"), reasonably, on that number.

The suite was run only after the spec section was written.
The real state was **32 failing plus those 14, across nine files** —
because the branch had moved surfaces that specs untouched by it still address (`ledger.spec.ts`'s
whole Księga path, `headquarters.spec.ts`'s Trasy describe, `route-qty-margin-gate.spec.ts`,
`storehouse.spec.ts`).
The driver had to return to the owner mid-task, restate the number, and have the same decision made
again —
this time landing on a different option (merge with the gate explicitly OPEN, four cluster issues).

## Impact

- **Outcome:** Medium — no bad code merged and no false claim reached `main`; the cost was one
  reversed owner decision and a second interruption in the same task. The owner's *first* choice was
  made on information that would not have supported it.
- **Failure-mode class:** High — the same slip with the gate *closed* instead of open is a merge
  certified against a suite nobody ran. The proxy under-reports by construction: a `.skip` count can
  only ever see the debts someone chose to declare, never the ones a diff created.
- **Rules broken/skipped:** none literally. `CLAUDE.md` §Before you start requires the baseline for
  `--kind=impl`, and `npm run selfcheck` ran green — **its baseline is `npm test`, typecheck and lint,
  and deliberately not Playwright** (e2e is minutes, not seconds). So the gate that would have caught
  this is not in the pre-work check, and nothing else obliged running it before quoting its state.

## Recurrence

**High** —
the structural driver is that the cheap proxy and the real answer live in different tools, and the
proxy is one grep away while the truth is a three-minute run.
The same shape recurs for anything expensive to verify:
a `.skip` count standing in for the suite, a `git log --oneline` standing in for a diff, an issue
title standing in for its acceptance criteria.
This repo has the pattern on record twice already —
incident 0031 (a tier claim made having run half the check) and incident 0030 (a detector that
encoded a law without being wired to anything that runs).

## Recommendation

- **Prevent:** **Quote a gate's state only from the gate's own tool.** If the number is going into a
  sentence the owner will decide on, the command that produces it runs first — or the sentence says
  "not run" instead of a number. A count of declared debts is never a report on a suite.
- **Detect:** cheap and specific: when a task's endgame is a merge, `npm run test:e2e` (dedicated
  `PLAYWRIGHT_PORT`) is part of *reading the situation*, not part of closing it. Three minutes spent
  before the owner is asked, rather than after they answered.
- **Contain:** the reversed decision was recoverable here only because the driver had not yet acted on
  it. The residual risk is the case where the expensive verification happens after the irreversible
  step — which is exactly the ordering `docs/workflows/verification.md` §PR timing already protects for
  PRs, and does not for numbers quoted in conversation.

## Follow-up

No standing change filed:
the fix is a habit, and the habit's home is this report plus the §Prevent line above.
The e2e work the real number exposed is tracked as #472–#475, with #472 flagged as the one carrying
a dark regression guard (#404).

**Discharged 2026-08-05.** #472–#475 landed as PRs #480 + #481;
the full Playwright run on `main` reads 121 passed / 8 skipped / 0 failed, and the #404 guards are
live again —
their detection power established by mutating the application rather than the assertion.
Residue tracked as #477, #478 and #479.
This report's §Prevent line was followed at the point it applies:
the suite was run *before* the merge decision, on a scratch worktree carrying both branches, and the
number quoted to the owner came from that run.
