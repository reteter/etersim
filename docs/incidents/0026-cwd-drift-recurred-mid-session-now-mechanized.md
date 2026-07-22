# 0026 — cwd-drift git mutation recurred mid-session (3rd time); mechanized instead of re-documented

- **Date:** 2026-07-22
- **Detected by:** owner, mid-session, immediately after the Orchestrator had cited incident-0008 by name.
- **Status:** Closed (stray artifacts cleaned up; guard hook landed same session).

## What happened

Same session as 0025: after `cd`-ing into `fix-375-buy-cap-hint` to mutation-test a fix, the Orchestrator moved on to an unrelated docs task and ran a bare `git checkout -b docs/378-...` without re-verifying location. It landed inside the stale worktree, and the subsequent `git add`/`commit`/`push` created a real, empty-content branch on origin under a misleading name. Caught by the `git add` pathspec error, not by any check — recovered (branch deleted locally and on origin, worktree switched back, redone correctly with `git -C`). Same class as 0008 (cwd persists across an implicit task boundary) and 0021 (task-switch, not budget pressure, is the trigger) — third occurrence, despite 0008 having been read and cited in this very session shortly before.

## Impact

- **Outcome:** Low — no data lost, stray branch deleted before any confusion downstream.
- **Failure-mode class:** Medium — same as 0008: a less-attentive follow-through could have left the stray branch live, or worse, could have mutated a *worktree with uncommitted work* instead of an empty one.
- **Rules broken/skipped:** CLAUDE.md's "print pwd + branch" convention — present in prose, not followed.

## Recurrence

High until mechanized — this is the third instance of the identical structural driver (soft, prose-only precondition that must be re-applied at every git call, forgotten under task-switching). Prose incidents don't fire at the moment of risk; only a mechanism does.

## Recommendation

- **Prevent:** `.claude/hooks/git-worktree-guard.sh` (PreToolUse on Bash, `.claude/settings.json`) now blocks any bare, state-mutating `git` command (`checkout`, `commit`, `push`, `merge`, `reset`, `rebase`, `add`, `restore`, `clean`, `cherry-pick`, `stash apply/pop/drop`, `branch -d/-D/-m`) whose resolved `git rev-parse --show-toplevel` isn't the main repo root — unless the command already carries `-C` or is a self-contained `cd <abs> && git ...`. Verified via 9 pipe-tests (main-root/worktree × mutating/read-only/explicit-`-C`/self-contained-`cd`) — all correct.
- **Detect:** the denial message names the resolved wrong path and points at `-C` as the one-line fix, so a real mismatch self-corrects immediately instead of requiring a manual `pwd` check.
- **Contain:** the hook is project-level (`.claude/settings.json`, checked in) so it applies to every session, not just this one; it needs one `/hooks` reload or restart to activate in a session already running when the file was created (this session included — owner to trigger).

## Follow-up

Hook + script committed. Needs `/hooks` (owner-only UI action) before it's live in the current session; verified correct via direct pipe-testing, not yet via a real harness-fired block (that check is pending the reload).
