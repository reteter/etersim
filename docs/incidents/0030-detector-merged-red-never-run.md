# 0030 — a detector was merged red and nobody ran it for a week

- **Date:** 2026-07-28 (discovered); originated 2026-07-21
- **Detected by:** the s26 pre-work selfcheck, running the detector set against a clean baseline
- **Status:** Closed 2026-07-28 — resolved through #412 by the **Contain** path below: the owner
  chose reclassification over narrow-and-gate, so `check:triggers` is now a surfacer that exits 0
  and gates nothing, and both `docs/workflows/documentation.md` and its own `--help` say so.
  The recommended narrow-the-scan work was **not** done and is not owed: a surfacer has no
  green to reach.

## What happened

`scripts/check-unpark-triggers.mjs` (#332, merged in PR #364 on 2026-07-21) automates the "a trigger
is a promise" law:
every unpark trigger in `docs/design-notes/` must name an issue.
The decision record `design-notes/s14-law-automation-decision-2026-07-21.md` calls it "the most
automatable of the four" s14 laws, and `WORKFLOW.md` §Documentation law states the law is "checked
by `npm run check:triggers`".

It has **never exited 0.** Running it against historical trees
(`git archive <sha> scripts docs/design-notes` into a scratch dir) returns exactly **27 violations at every commit from the one that introduced it onward**
—
`8690469` (the adding commit), through the 07-22 batch, to `0669d86` (the s25 close).
The count never moved because nothing ever ran it.

It went unnoticed because it is wired into nothing:
`.github/workflows/ci.yml` runs typecheck, lint, test, build and e2e —
not `check:triggers`, not `check:glossary`, not `docs:normalize --check`.
It is absent from `SELFCHECK.md` §3's baseline command block and from the E2E certification points.
So "main is clean" was **true throughout** —
the certified gate set was green —
while a command claiming to enforce a documented law sat outside every gate anyone runs.

On inspection the red is also mostly noise:
the pattern `/unpark|parked|revisit at|…/i` matches the bare **word**, so 25 of 27 hits are prose
*about* parking —
a heading ("parked design inputs"), a retrospective ("all three unpark triggers had fired"),
cross-references to hooks parked in `PRD.md`, and the sentence stating the law itself.
Two are genuine.

## Impact

- **Outcome:** Low — no obligation is known to have been lost. The law's manual pass (#326) had
  already swept the backlog, and the two genuine hits are old parked items, not live promises.
- **Failure-mode class:** Med — the repo believed a law was mechanically enforced for a week
  while it was not. The next unpark trigger written without an issue would have gone uncaught,
  which is precisely the failure #327/#332 were built to prevent, with the added cost that
  everyone had stopped watching for it manually.
- **Rules broken/skipped:** none at the time. No rule said a new detector must be green or wired
  to a gate — that gap is the finding.

## Recurrence

**Medium** —
structural, and it generalizes beyond this script.
Two sibling detectors landed in the same programme:
`check:glossary` (currently exit 0) and `check-behavior-preserving` (invoked by hand at a documented
decision point).
The pattern that bit here —
*a tool that encodes a law is treated as the law being enforced* —
applies to any of them, and to any future one.
Writing the detector is the visible work;
wiring it to something that runs is the work that actually changes outcomes, and it is easy to skip
because the PR looks complete without it.

The deeper driver is the one #332's own decision record named and declined to answer:
whether the repo produces laws faster than it can enforce them.

## Recommendation

- **Prevent:** a detector merges **green or with its expected non-zero baseline recorded in the
  PR**, and lands wired into something that runs (CI, or `SELFCHECK.md` §3's command block) in
  the same PR. A red that ships alongside the tool trains readers to ignore red — which is how
  this one survived a week in plain sight.
- **Detect:** the cheapest catch is that the baseline command block in `SELFCHECK.md` §3 *is* the
  detector inventory. Anything not in it is, by construction, a command nobody runs.
- **Contain:** if a detector honestly cannot reach green (a prose heuristic often cannot), it is
  a **surfacer, not a verdict** — say so in `WORKFLOW.md` and in its own `--help`, the way
  `check-behavior-preserving.mjs` already does, and stop implying the law is automated.

## Follow-up

**#412** carries the finding, the historical evidence, the classification of all 27 hits, and a
recommended fix ordered so it cannot go wrong:
scope the scan to **LIVE** notes first (27 → 6, because HIST is already the certified
no-open-obligations state per `WORKFLOW.md`'s own "file it, *then* flip" test), *then* narrow the
vocabulary —
and only in that order, because dropping the bare word `parked` first would silently delete one of
the two genuine findings (`semantic-code-search-tooling.md:3` matches on that word alone; the
pattern has `revisit at` but not `revisit when`).
Add an opt-out marker for the law's own escape hatch, and wire it to a gate **after** it is green,
not before.

Bycatch, also in #412:
`design-notes/README.md`'s row for `s14-law-automation-decision-2026-07-21` still reads **LIVE (until implementation PR lands)**
—
that PR landed as `8690469` on 2026-07-21.
*(Already corrected to HIST by an earlier session; noted here so the record is not read as owing it twice.)*

**How it actually resolved (2026-07-28).** The owner took the **Contain** option rather than the
ordered fix above, on the argument this incident itself makes:
a red nobody trusts teaches the team to scroll past a red line.
Of the 27 hits, exactly one was a live promise with no tracker —
`semantic-code-search-tooling.md:3`, now filed as **#437** and cited in the note.
The other genuine hit (`playtest-2026-07-14-pricebar-shipinfo.md:50`, "Parked here; no issue") is
the law's own escape hatch and needs no change.
The lesson stands unchanged and generalised: **a tool that encodes a law is not the law being enforced**
—
either wire it to a gate green, or say plainly that a human enforces it.
