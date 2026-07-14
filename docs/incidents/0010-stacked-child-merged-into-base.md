# 0010 — stacked child PR squash-merged into its already-merged base, not main

- **Date:** 2026-07-14
- **Detected by:** Orchestrator's post-merge verification (`ls` of the expected file on main + `git log` — the #190 commit was absent from main; `origin/feat/94-contract-settlement` had advanced instead)
- **Status:** Closed (content relanded via cherry-pick, PR referenced below)

## What happened

E3 wave 3 shipped a stacked pair: PR #189 (`feat/94-contract-settlement` → main) and
PR #190 (`feat/98-e3-guardrails` → `feat/94-contract-settlement`). Both PR bodies
carried the WORKFLOW §6 stacked-merge instructions (merge base first, retarget the
child to main, then delete the base branch). The owner squash-merged all open PRs in
one sitting; #190 was merged while its base still pointed at the feature branch, so
GitHub landed its squash commit (`f609fef`) on `feat/94-contract-settlement` — a
branch that was already merged and about to be deleted. Main showed #190 as "merged"
while containing none of its content (`src/sim/e3-guardrails.test.ts` missing).

## Impact

- **Outcome:** Low — caught minutes later by post-merge verification; content
  recovered with a single clean cherry-pick of `f609fef` onto a main-based branch.
- **Failure-mode class:** High — if the base branch had been deleted before anyone
  looked, the "merged" #190 would have quietly pointed at an unreachable commit;
  the guardrail tests (two M3 success criteria) would be absent from main while the
  issue tracker showed them shipped. Silent coverage loss is exactly the kind of gap
  incident 0005 warns about.
- **Rules broken/skipped:** WORKFLOW §6 stacked-merge procedure (retarget before
  merging the child) — skipped on the merging side; the procedure lived only in PR
  body text, which is easy to miss when batch-merging.

## Recurrence

Medium — structural driver: GitHub's merge button happily merges a child into a
stale base, and batch-merging a queue of green PRs invites exactly that. The
procedure existing in docs does not surface at the moment of click.

## Recommendation

- **Prevent:** don't hand the owner a stacked child while its base is unmerged.
  New rule (WORKFLOW §Batching): the Orchestrator opens a stacked child's PR only
  **after** the base has merged, already retargeted to main. A child that is a thin
  increment (single test file) costs nothing to hold back.
- **Detect:** post-merge verification stays mandatory: after any merge batch,
  confirm each PR's content is reachable from `origin/main` (spot-check one landed
  file per PR), before deleting branches.
- **Contain:** the squash commit survives on the base branch until branch deletion —
  never delete a stacked base until the child's content is verified on main.

## Follow-up

Relanded in the same session (cherry-pick `f609fef` → `test/98-reland-guardrails`);
prevention rule added to WORKFLOW §Batching in the same PR.
