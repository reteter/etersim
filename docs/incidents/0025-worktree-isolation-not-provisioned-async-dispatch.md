# 0025 — `isolation: "worktree"` not provisioned for two async coder dispatches, unreproduced

- **Date:** 2026-07-22
- **Detected by:** both coders self-reported the missing worktree in their completion reports (s20); confirmed against `git worktree list` (s21).
- **Status:** Closed (near-miss contained; root cause unresolved, mechanism re-verified sound).

## What happened

Two coders were dispatched async/background with `isolation: "worktree"` (s20, #375 and #302/#303). Both found no dedicated worktree pre-provisioned — `git worktree list` showed only the main checkout — and each improvised a manual `git worktree add` (the exact incident-0012 anti-pattern), landing at `.claude/worktrees/fix-375-buy-cap-hint` and `.claude/worktrees/test-302-303`. Both addressed git as `git -C <worktree>` throughout and never touched the main checkout; `main` was verified clean twice. A same-session repro (s21) — identical shape: `coder` type, `isolation: "worktree"`, async/background, trivial task — did **not** reproduce the failure: a dedicated worktree + branch were provisioned before the repro agent took any action.

## Impact

- **Outcome:** Low — no work lost, main stayed clean, both branches merged cleanly.
- **Failure-mode class:** Medium — same as 0012: a coder that didn't verify main-vs-worktree before improvising could commit to the wrong place. We were saved by coder discipline, not the mechanism.
- **Rules broken/skipped:** CLAUDE.md §Git & worktrees ("no manual `git worktree add`") — broken by necessity, not carelessness, after the harness omitted the provisioning step.

## Recurrence

Unknown — the repro attempt refutes "async dispatch never honors isolation" as a general rule (this session's async repro worked correctly), so the s20 failure looks like a one-off rather than a structural driver. No access to the exact s20 dispatch call shape to rule out a call-site difference.

## Recommendation

- **Prevent:** `.claude/agents/coder.md` §Git discipline gained an explicit stop-condition mirroring the existing main-checkout rule: a missing dedicated worktree under `isolation: "worktree"` is now a stop-and-report, never a self-provisioned `git worktree add`. Both s20 coders improvised instead of stopping — the contract didn't name this case before.
- **Detect:** coders already self-report after the fact (both did); the new stop-condition moves that report earlier, before any improvisation.
- **Contain:** if this recurs, capture the exact dispatch call (background vs foreground, exact params) at failure time, so a future investigation has the call shape to compare.

## Follow-up

Two leftover manual worktrees cleaned up post-merge (#380, #381). `coder.md` stop-condition landed same session. Watch for recurrence.
