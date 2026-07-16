# 0011 — Certification run over live worktrees: false RED

- **Date:** 2026-07-15
- **Detected by:** self-report + investigation — a post-merge certification looked RED; investigated before reporting it, found it environmental.
- **Status:** Closed (root cause identified; prevention = certify only after worktree cleanup; since the 2026-07-16 ceremony slim it lives in `CLAUDE.md` §Git & worktrees and WORKFLOW §E2E certification points).

## What happened

After the #217 + #221 drobiazgi wave merged, the Orchestrator launched a background
certification on `main` (`npm test && npm run typecheck && npm run lint && … test:e2e`)
and only in the **next** step removed the two coder worktrees
(`.claude/worktrees/agent-*`). Because the cert ran while the worktrees still existed,
two things went wrong at once:

- `eslint .` from the repo root recursed into the worktrees' own `src/` copies — this
  repo keeps worktrees **inside** the tree (`CLAUDE.md` §Git & worktrees) — and reported
  **326 spurious errors** that do not exist in the main checkout.
- The full Playwright run (8 workers) flaked **4 timing-sensitive `fleet.spec.ts` tests**
  (save-load, blur-commit) under resource contention with the still-present worktrees.

The combined output looked like a RED certification on freshly-merged `main`.
Investigation showed otherwise: standalone `npm run lint` → clean; `fleet.spec.ts` re-run
→ 8/8; full e2e re-run in a clean tree → **84/84**. `main` was green the whole time; the
failures were purely environmental.

## Impact

- **Outcome:** Low — no wrong result reached anyone; `main` was green; caught by
  investigation before any false report to the owner.
- **Failure-mode class:** Medium — a driver who trusted the first output would either
  report a false RED and block a good merge, or (worse) learn to wave away cert noise as
  "just the worktree flake" and miss a *real* regression next time. Noise around a
  certification gate erodes the gate.
- **Rules broken/skipped:** none written — no doctrine ordered cert-after-cleanup. This is
  a newly discovered hazard, not a violation.

## Recurrence

Medium — **structural driver:** this repo's worktrees live *inside* the repo tree
(`.claude/worktrees/*`, `CLAUDE.md` §Git & worktrees), so any root-glob tool (`eslint .`,
and potentially others) scans them whenever they coexist with a cert run. Recurs until the
ordering is habitual or the tooling ignores the path.

## Recommendation

- **Prevent:** certification runs go **after** worktree removal, never concurrently.
  Wave-close order: owner merges → verify content on `origin/main` (0010) →
  `git worktree remove` + branch cleanup → **then** certify with the pwd/branch/SHA guard
  (0008). A clean `git worktree list` (only `main`) is the go-signal.
- **Detect:** the pwd/branch/SHA guard already prints at cert start (0008); fold
  "worktrees removed?" into that same pre-cert check.
- **Contain:** optionally add `.claude/worktrees/**` to `eslint.config.js` ignores so a
  stray cert can't over-scan — a cheap belt for the lint half (does not address the
  Playwright contention half; the ordering discipline covers both).

## Follow-up

Prevention landed 2026-07-15 in the session-state note; moved 2026-07-16 to
`CLAUDE.md` §Git & worktrees + WORKFLOW §E2E certification points (durable homes).
Optional hardening not taken: the `eslint.config.js` ignore for `.claude/worktrees/**`
— file a chore issue if we want the belt in addition to the ordering discipline.
