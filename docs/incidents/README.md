# Incidents

A blameless log of times work deviated from the project's rules, docs, or intent —
including **near-misses** where nothing broke but easily could have. The point is
learning, not blame: we work in **report → fix → don't repeat**, never in punishment.
A near-miss reported is a free lesson; a near-miss hidden is a future outage.

## When to file

File a short report whenever:

- A rule in `CLAUDE.md`, an ADR, or a spec was broken or skipped (even if reverted).
- A command touched the wrong repo/branch/file, or did something hard to undo.
- Something surprised you in a way the next person should be warned about.

Cheap is the point. A report should take a few minutes. If it takes an hour, the
template is wrong — trim it.

## How

1. Copy the template below into `docs/incidents/NNNN-short-slug.md` (next free number).
2. Fill it in. Be specific about *what* and *how*, not *who* — names add nothing.
3. Land the recommended prevention in the same session if it's cheap; otherwise file
   an issue and link it under Follow-up.

## Severity

Rate two things separately — they often differ:

- **Outcome** — what actually happened this time (Low = reverted / no data loss …
  Critical = data or history lost, hard to recover).
- **Failure-mode class** — how bad the *same action* could be if it landed a step
  later or went uncaught. A benign outcome from a dangerous class is still a signal.

## Recurrence

Low / Medium / High, with the **structural driver** if there is one — a hazard baked
into the setup recurs; a one-off slip usually doesn't.

## Template

```markdown
# NNNN — <short title>

- **Date:** YYYY-MM-DD
- **Detected by:** <how it surfaced — self-report, verification step, CI, …>
- **Status:** Open | Closed (<how/when resolved>)

## What happened

<What and when. The sequence of actions, plainly. No blame.>

## Impact

- **Outcome:** <Low/Med/High/Critical> — <what actually resulted>
- **Failure-mode class:** <Low/Med/High/Critical> — <worst plausible version of the same slip>
- **Rules broken/skipped:** <cite CLAUDE.md § / ADR / spec, or "none">

## Recurrence

<Low/Medium/High> — <structural driver, if any>

## Recommendation

- **Prevent:** <cheap standing fix, if any>
- **Detect:** <how we'd catch it — already in place or proposed>
- **Contain:** <accepted residual risk, when a full fix isn't worth it>

## Follow-up

<Landed change, or linked issue, or "none — accepted">
```
