# 0006 — Docs commit landed directly on local main; main drifted from origin under a coder wave

- **Date:** 2026-07-10
- **Detected by:** Self-report — orchestrator noticed a stale docs commit inside PR #112's commit list during the post-review verification of coder wave 1.
- **Status:** Closed (same session — main reconciled and pushed, both coder branches rebased, prevention landed in SELFCHECK §3)

## What happened

1. During an earlier analysis session the orchestrator wrote `docs/design-notes/semantic-code-search-tooling.md` and committed it **directly to local `main`** (`a4c0ee9`), skipping the branch + PR path required for docs-only changes. The commit was not pushed.
2. Meanwhile another session landed `27964b5` on `origin/main` via PR #111. Local and remote `main` silently diverged (ahead 1 / behind 1).
3. Coder wave 1 was dispatched with "branch from main HEAD (a4c0ee9)" — both coders (#82, #75) branched from a commit that existed only locally.
4. Coder B's PR #112 consequently carried the unrelated docs commit in its history/diff. Caught during `gh pr view` verification after review.
5. Fix: `git pull --rebase` + push (`a4c0ee9` → `4bf5262`), coder B rebased `fix/port-panel-price-alignment` onto the updated `origin/main` and force-pushed (with lease), coder A was instructed to rebase `feat/e9-ledger` before opening its PR.

## Impact

- **Outcome:** Low — docs-only content, nothing lost; one extra rebase round for each coder branch, PR #112 diff briefly polluted.
- **Failure-mode class:** Medium — the same slip with a *code* commit, or discovered *after* merging a polluted PR, means foreign changes riding into main inside an unrelated squash merge, and sessions building on history that later gets rewritten.
- **Rules broken/skipped:** SELFCHECK §1 ("Docs-only change: still branch + PR") and §4 law 5 (feature branch + PR); SELFCHECK §3 env check ("git log … matches origin/main's recent history?") was run but only against the local log, so the divergence went unnoticed at dispatch time.

## Recurrence

Medium — structural driver: multiple sessions (local Claude sessions, cloud/external agents) share one origin while the local checkout persists between sessions. Any unpushed local `main` commit makes drift the default, not the exception. A dispatch checklist that doesn't compare against the *remote* will keep missing it.

## Recommendation

- **Prevent:** Docs-only changes go through branch + PR like everything else — no "it's just a note" exception for the main session. Landed: SELFCHECK §3 now requires `git fetch origin --quiet && git status -sb` (ahead/behind check) before starting work; a diverged or ahead `main` blocks dispatching coders until reconciled.
- **Detect:** Orchestrator's post-wave verification already caught it (PR commit-list inspection) — keep verifying `gh pr view <n> --json commits` shows only the coder's commits.
- **Contain:** n/a — full fix was cheap.

## Follow-up

Prevention landed in this PR (SELFCHECK §3 line). None other — closed.
