# 0031 — tier 1 declared closed with half its check run

- **Date:** 2026-07-28
- **Detected by:** advisor consult before declaring the task done (PR already pushed, not yet merged)
- **Status:** Closed (second commit on the same branch, `320a447`, before owner merge)

## What happened

The #404 grill's docs PR (#420) carried a §Verification line reading
*"Docs-only, no code touched → **tier 1** (WORKFLOW §Verification gates)"*.
Tier 1 is two checks: **diff vs ACs *and* docs-sweep greps.**
Only the first had been run.

What stood in for the second was knowledge:
the driver had read `docs/specs/README.md` and the E16 spec during the grill, knew those were the
documents recording the decision, and synced them deliberately and thoroughly.
That felt like a sweep.
It was a *recall* of which documents matter, which is precisely what the sweep exists not to rely
on.

The actual command —
`grep -rn "#404\|gated by" docs/ CLAUDE.md` —
took one turn and found **two live falsehoods in `docs/HANDOFF.md`**:
the s24 header line and §Queue's *"#393 gated by the #404 decision"*, both now false (#393 is gated
on #419's *merge*).
Struck in place per the Documentation-law corollary.
A third hit (`coder-scorecard.md:433`) was correctly past-tense provenance and left alone —
so the grep also earned its keep by *not* generating a false edit.

## Impact

- **Outcome:** Low — caught before merge; the sweep's findings landed in the same PR.
- **Failure-mode class:** Med — HANDOFF is the cross-harness export. A stale "blocked on a decision"
  line survives into the next session's *first* read, on a machine or model with no other context,
  and the queue's head is exactly what a session-start reader acts on.
- **Rules broken/skipped:** `WORKFLOW.md` §Verification gates (tier 1 = diff vs ACs **+** docs-sweep
  greps); `SELFCHECK.md` §6 (a gate is closed *with evidence* or explicitly OPEN).

## Recurrence

**Medium**, with a structural driver: **tier 1 is the only tier whose check the driver runs itself.**
Tiers 2 and 3 dispatch a subagent, which either returns a report or visibly does not —
the gate has an artifact.
Tier 1's evidence is a command in a transcript, so "I know which docs those are" substitutes for it
silently and feels *more* diligent, not less.
The same substitution shape as incident 0030 (a detector that exists but is wired to nothing) and
the same as §Documentation law's own line: **unstated means unchecked**
—
here the driver stated the tier and left the check unstated.

## Recommendation

- **Prevent:** a tier-1 claim names the sweep command **and its output** (including "0 hits outside
  the files already edited"). Not new law — the existing law applied to the one tier that has no
  subagent to produce the artifact for it.
- **Detect:** the advisor-before-declaring-done habit caught this one; it is also exactly what
  `SELFCHECK.md` §6's "end your final report with each gate closed-with-evidence or OPEN" asks for,
  when *evidence* is read strictly as an artifact rather than an assertion.
- **Contain:** none needed — the check is one grep.

## Follow-up

Landed in the same PR (`320a447`):
both HANDOFF lines struck, sweep result recorded in the commit message.
No issue filed —
the prevention is applying a rule that already exists, not writing a new one.
