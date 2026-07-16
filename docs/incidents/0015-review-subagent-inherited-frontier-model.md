# 0015 — review subagent silently inherited the driver's frontier model

- **Date:** 2026-07-16
- **Detected by:** owner — Anthropic status page showed an asymmetric outage (Fable-only 529s while other model pools recovered), exposing which model the stuck reviewer was on
- **Status:** Closed (review re-dispatched on Opus and completed; casting rule added to CLAUDE.md §Git & worktrees)

## What happened

The #285 strong-tier two-axis review was dispatched as a `general-purpose` subagent
with no `model` parameter. Persona defs (coder, professor) pin their model; ad-hoc
types inherit the **driver's** — so the review ran on the frontier model (Fable).
Invisible while everything worked: no error signal, cost hidden in the shared limit.
A platform outage then hit the Fable pool specifically; six resume attempts burned
frontier budget on delegable work before the status page revealed the cause. First
occurrence, confirmed: earlier dispatches were cast correctly (the advisor's tier
distinction functioned, which only makes sense with real tier separation).

## Impact

- **Outcome:** Low — wasted frontier tokens and a delayed review; no repo damage.
- **Failure-mode class:** Med — silent frontier burn across many sessions had the
  default gone unnoticed; dispatches also couple to the driver pool's availability.
- **Rules broken/skipped:** none existed — that absence is the finding.

## Recurrence

Rule added (CLAUDE.md §Git & worktrees): every ad-hoc dispatch names `model`
explicitly per the ladder; inheriting the driver is an oversight, not a casting.
Bonus lesson: the model ladder doubles as outage resilience — when one pool is
down, recast the rung and keep the work.
