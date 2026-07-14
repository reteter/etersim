# 0008 — wave close: certification ran in the wrong directory; rescue WIP message landed on main

(0007 is reserved for the cp1250 shell-encoding incident, issue #136.)

- **Date:** 2026-07-14
- **Detected by:** self — `git status` showed `main` behind origin by 1 right after a
  "certification on main" had supposedly passed
- **Status:** Closed (same session: certification re-run on the real `main`, worktree
  removed; message on `main` accepted as residual)

## What happened

Two intertwined slips during the #130+#161 wave close, one root: the Orchestrator's
persistent shell had `cd`'d into the coder's worktree for the #165 conflict
resolution and stayed there.

1. **Certification ran in the worktree, reported as "on main".** The wave's full-E2E
   certification command chained `git pull && npm run test:e2e` — in the worktree, on
   the feature branch. The tree happened to be identical to post-merge `main` (single
   rebased commit, clean squash), so the results were valid for the *content*, but
   the report to the owner said "on main" while local `main` had never pulled the
   squash commit. Caught minutes later; certification re-run from the verified main
   checkout (`pwd` + branch in the observed output), all green.
2. **A rescue WIP commit message became a permanent `main` commit message.** At an
   earlier session-limit scare the Orchestrator had committed the running coder's
   tree as `wip(ui): … secured by orchestrator …` and pushed. The coder finished the
   work *inside that same commit's content* and opened PR #165 with exactly one
   commit — and GitHub's single-commit squash default uses the commit's message, not
   the PR title. `gh pr merge 165 --squash` therefore stamped the wip message onto
   `main` (d1c1b4c). Functionally harmless; not fixable without rewriting `main`.

## Impact

- **Outcome:** Low — certification results were content-valid and were re-obtained
  properly; the `main` history carries one unconventional commit message.
- **Failure-mode class:** High — a wrong-directory verification can certify a stale
  tree as green (the same class as the 5173 foreign-dev-server trap), and a
  wrong-directory *write* would have been incident 0001 all over again, this time by
  the Orchestrator itself.
- **Rules broken/skipped:** CLAUDE.md §Git & worktrees (trust `pwd` only after
  verification); conventional-commits rule on `main` (via the squash default).

## Recurrence

Medium — both drivers are structural: persistent shell `cwd` survives between
commands and is invisible in each next command's text; GitHub's single-commit squash
default will fire for every one-commit PR.

## Recommendation

- **Prevent:** (a) certification and any repo-level gate runs start by printing
  `pwd` + `git branch --show-current` and treating a mismatch as a stop (landed in
  WORKFLOW §Verification gates with this report); (b) before handing a PR to the
  owner for squash-merge, make the branch's final commit message merge-worthy —
  amend rescue/wip messages, or pass an explicit subject.
- **Detect:** `git status -sb` after any merge — `behind N` right after "certified on
  main" is the tell that fired here.
- **Contain:** the wip message on `main` stays — rewriting pushed `main` history is
  worse than the blemish.

## Follow-up

WORKFLOW §Verification gates amended (same PR as this report). Residual accepted for
the d1c1b4c message.
