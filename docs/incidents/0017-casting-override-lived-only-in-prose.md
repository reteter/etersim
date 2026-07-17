# 0017 — coder casting override lived only in prose; dispatch silently followed the def

- **Date:** 2026-07-17
- **Detected by:** Orchestrator self-report while preparing the A/B casting read-out
- **Status:** Closed (owner ratified Sonnet as the coder default the same session)

## What happened

The s4 owner decision "coder = Opus for 5 sessions" was recorded in the HANDOFF
watch list and per-machine memory but never in `.claude/agents/coder.md` — its
frontmatter has said `model: sonnet` since 2026-07-13. On 2026-07-17 (s9) the
#290/#292 wave was dispatched with no conscious casting check; the def won
silently and both coders ran on Sonnet, contradicting the standing decision.

## Impact

- **Outcome:** Low — the owner closed the Opus override the same session (A/B
  read-out, 2/2 for Sonnet), retroactively matching what actually ran; both tasks
  are the exact profile the series favors Sonnet for.
- **Failure-mode class:** Medium — an override recorded only in prose can lapse
  silently in either direction, incl. keeping an expensive model past its window.
- **Rules broken/skipped:** CLAUDE.md §Git & worktrees "every subagent dispatch
  names its casting" — the def-carried model contradicted the owner decision.

## Recurrence

Medium — structural: casting decisions land in HANDOFF/memory prose while
dispatch reads the def; two sources of truth.

## Recommendation

- **Prevent:** a casting override is real only when the def frontmatter (or the
  dispatch's explicit `model:`) carries it — prose records are pointers, not
  sources. Line added to WORKFLOW §Casting.
- **Detect:** name the effective model in the dispatch report (selfcheck line).

## Follow-up

Owner decision 2026-07-17: coder default = Sonnet (def already correct),
advisor = Opus; s4 override closed. WORKFLOW §Casting prevention line landed in
the same PR (#296).
