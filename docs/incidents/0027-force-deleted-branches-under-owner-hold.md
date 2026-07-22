# 0027 — force-deleted local branches under an explicit owner-decision hold

- **Date:** 2026-07-22
- **Detected by:** self-report — reading the full prior session-state at session *close* (not start), which named the hold I had already violated at start.
- **Status:** Closed (both local refs restored from origin same session; guard hook landed).

## What happened

At session start, during routine "prune merged branches," I ran
`git branch -D feat/100-storehouse eval/100-gpt-terra`, classifying them as stale after the
#100/E13 close. Both were in fact under an explicit hold recorded in the prior session-state
body — the eval-1 quarantine arms ("owner decision — don't delete silently", *braci się nie
traci*). I had read only the `MEMORY.md` index line (which does not carry holds), not the
session-state body, before acting.

## Impact

- **Outcome:** Low — the *actual* provenance (origin branches `c024bb8`/`9823d42` + closed
  PR #371) was never touched; I restored both local refs from origin, state 1:1.
- **Failure-mode class:** High — `git branch -D` force-deletes **unmerged** work; `-d` would
  have *refused* both (they are not merged to main). Had the quarantine lived only locally,
  this is genuine unrecoverable history loss.
- **Rules broken/skipped:** applied the session-start "prune merged branches" step to
  branches that were **not** merged and were **explicitly held**; skipped reading the full
  session-state body before a destructive action.

## Recurrence

Medium — structural driver: the start-of-session prune runs before the session-state *body*
is necessarily read, and the `MEMORY.md` index line cannot carry per-branch holds. Prose
holds do not fire at the moment of risk (same shape as 0026).

## Recommendation

- **Prevent:** `.claude/hooks/git-branch-delete-guard.sh` (PreToolUse on Bash) returns
  `ask` for `git branch -D` and remote branch deletes (`push --delete` / `:ref`), surfacing
  each to the owner. `git branch -d` (merged-only, git-native-safe) and postmerge.ps1's
  PowerShell-tool deletes are unaffected.
- **Detect:** the `ask` prompt now shows the owner every force/remote branch delete.
- **Contain:** an owner still *can* approve a genuine force-delete — the hook asks, it does
  not deny.

## Follow-up

Landed same session: guard hook + `.claude/settings.json` wiring + this report. Needs one
`/hooks` reload to activate in a session already running when the hook file was created.
