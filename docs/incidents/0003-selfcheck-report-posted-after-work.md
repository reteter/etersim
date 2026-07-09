# 0003 — Selfcheck report posted after the work instead of before it

- **Date:** 2026-07-09
- **Detected by:** Owner review of the session transcript (`tmp/46ef035_grokbuild.md`)
- **Status:** Closed (SELFCHECK.md §5 hardened in the same PR as this report)

## What happened

An external coding agent was asked to run the selfcheck per `docs/SELFCHECK.md` and
then take issue #79 (pure rename, `src/sim` + UI). The agent executed the entire
task — selfcheck reads, baseline, branch, all edits, commit — in a single turn, and
posted the §5 "Selfcheck complete" report **together with the completion summary**,
after the commit already existed.

§5's purpose is to catch misunderstandings "while they are still free": the owner
sees how the model understood the task *before* any file changes. Posting the report
after the work turns it into a receipt instead of a checkpoint.

## Impact

- **Outcome:** Low — the task was understood correctly; the rename was clean and the
  report itself was accurate and well-formed. Nothing to revert.
- **Failure-mode class:** High — a misunderstood scope (wrong rename direction, wrong
  epic's identifiers, touching E10 names) would have been fully implemented and
  committed before the owner had any chance to correct it. The checkpoint exists
  precisely for that case and was bypassed.
- **Rules broken/skipped:** SELFCHECK.md §5 ("Post this as your first message after
  the selfcheck") — followed in letter (it was the first *message*), defeated in
  spirit (the turn also contained the whole implementation).

## Recurrence

High — structural. Agent harnesses that run tools-then-reply in one turn will always
produce this unless the checklist explicitly demands a pause before the first edit.
The old §5 wording never said "stop".

## Recommendation

- **Prevent:** §5 now requires posting the report **before creating a branch or
  editing any file**, and waiting for the owner's go-ahead unless the task prompt
  explicitly pre-authorized continuing.
- **Detect:** transcript review — the report must precede the first Edit/Write in
  the tool log; any future dump makes this trivially checkable.
- **Contain:** none needed beyond the above.

## Follow-up

SELFCHECK.md §5 hardened in the same PR that lands this report.
