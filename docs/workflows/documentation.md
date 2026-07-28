# Documentation law

- **`CONTEXT.md` is the ubiquitous language.** Identifiers in code use its terms; introducing
  a concept means adding the glossary entry first.
- **ADRs** ([adr/](../adr/), sequential numbering) record decisions that are hard to reverse,
  surprising without context, and the result of a real trade-off. One paragraph is enough.
- **PRD** ([PRD.md](../PRD.md)) owns vision, pillars, scope and roadmap; epics beyond the
  current milestone are drafts.
- Decisions recorded in these documents are settled — link to them instead of reopening,
  unless new facts appear.

## Indexed categories carry their index in the same commit

`docs/incidents/`, `docs/design-notes/` and `docs/specs/` are read through their `README.md`
digest, not file by file. Adding a note means adding its row (one line: what it is, what it
concluded, LIVE or HIST); closing out a note's last open item means flipping it to HIST.

**The obligation is the whole mechanism.** An index no one is *obliged* to update decays into
a second thing to distrust, and the category silently reverts to unreadable-in-bulk. Volume in
an indexed category is nearly free; volume in an unindexed one compounds until nobody reads it
— the 2026-07-19 retro found `design-notes` at 36 files and 2358 lines with no digest, while
`incidents` stayed absorbable at ~10:1 compression because filing one always included its log
line.

`docs/specs/` has **no** LIVE/HIST axis — every spec binds (owner ruling, s13 sweep binding
rule 5). Adding a spec means adding its row to [specs/README.md](../specs/README.md) (epic,
milestone state, as-built digest) in the same commit; resolving a deferral or open item a row
names means updating that row in the commit that resolves it (sweep F7, #309).

## Decisions propagate at the moment they change

Revising a recorded decision — a trigger, a scope call, a lock, an acceptance criterion —
means updating every other document that records *the same decision*, **in the same commit**
(or the same batch of issue edits).

Finding them is not a search problem: **walk the citations the document you are editing
already carries.** A grill note names its issue, an issue names its grill note, a spec names
its ADR. Pointers were never the missing piece — #131 and
[route-events-2026-07-14](../design-notes/route-events-2026-07-14.md) cite each other, and
their phase-2 unpark trigger still diverged for four days across two sessions, because a
comment revised one side and nobody was obliged to walk the link (sweep F4/F9).

**The test:** the commit message or the issue comment names the documents you updated, or
states that no other document records the decision. **Unstated means unchecked.**

- **Corollary — a falsified line is struck immediately.** On learning a recorded statement is
  false, strike it in place *now* rather than waiting for a full rewrite; a one-line strike is
  always affordable, and "the next refresh will fix it" is how HANDOFF went actively
  misleading in two consecutive sessions (sweep F2). Since 2026-07-28 HANDOFF is rewritten
  whole at both session boundaries, so this bites hardest on documents that are *not*
  refreshed on a schedule — specs, PROCESS, the indexes.
- **Corollary — a prediction is recorded as a prediction.** Forecasts about future sessions
  are written as expectations carrying their falsifier, never as settled state.

## A trigger is a promise, and promises live in the issue tracker

Owner ruling 2026-07-19 (sweep F5). A design note may park the *reasoning* for something
deferred; it may not be the only record of the *obligation*. If you write an unpark trigger —
"revisit at multiregion", "when #N is picked up", "post-E3 hygiene pass" — **file the issue
that carries it** and let the note point at the issue.

The asymmetry forcing this is structural, not a matter of diligence: `gh issue list` is swept
at every session start, while notes are read one index line at a time and HIST rows are
explicitly *"safe to skip"*. **A trigger written in prose fires into a document nobody is
obliged to open.**

- **The detector:** every unpark trigger in `docs/design-notes/` names an issue, checked by
  `npm run check:triggers` (#332). It is how sweep F5 found the four that did not — and it is
  itself red-since-birth and unwired, which is #412 and incident 0030.
- **The test before marking a note HIST:** if flipping it would hide an obligation, the
  obligation is in the wrong place — file it, *then* flip.
- **What this cost once:** `professor-review-ui-store-2026-07-14` parked three findings behind
  prose triggers. All three fired and nobody noticed for five days; one was a hygiene cleave
  for `HeadquartersPanel.tsx`, which **grew 23% while parked** (→ #319–#321). The remedy was
  already written in #304 and the symptom already logged in HANDOFF — the knowledge was
  present twice over; what was missing was the obligation.
- **If you are unwilling to file an issue, do not write a trigger.** Record it as an idea with
  no commitment — honest, and cheaper than a promise nothing keeps.

## Session-boundary docs exception

Owner 2026-07-16, widened 2026-07-28. The session-close docs-only batch (HANDOFF, scorecard
rows, incident reports, memory exports) commits **directly to `main`** and is pushed
immediately. Before committing, `git status -sb` must show `main` level with `origin/main` —
the incident-0006 guard was the unpushed local commit, not the missing PR. Anything beyond the
close ritual still takes branch + PR. `docs/HANDOFF.md` alone may also go straight to `main`
at either boundary ([session.md](session.md)).

## Line breaks are semantic, not width-wrapped

Owner ruling 2026-07-21 (#341 grill:
[markdown-normalizer-grill-2026-07-21](../design-notes/markdown-normalizer-grill-2026-07-21.md)).
A line breaks at a clause boundary — sentence end, semicolon, explanatory colon, em-dash —
plus a 100-character soft fallback for any segment between hard separators; never at an
arbitrary width.

This is a script's job (`npm run docs:normalize`), never a hand-reflow: wrap position anchored
to meaning is what makes `^`-anchored greps against docs trustworthy, and every law above
depends on that. Enforced via `--check` against an allowlist of already-migrated files, not
repo-wide; migration reaches full coverage through several segment-scoped docs-only PRs rather
than one pass, because a single corpus-wide reflow would become the `git blame` origin for
every line in every doc (#384 holds the owner's override of that, accepted knowingly).

## Docs sync sweep (before committing a spec or decision batch)

A spec is never the only file that changes. Before committing an approved spec — or any
decision session's output — sweep:

- **`CONTEXT.md`** — terms locked during the grill: new entries with PL names, updated
  implementation notes.
- **[PRD.md](../PRD.md)** — milestone/epic notes, sequencing changes, spec links.
- **Older specs** — sections the new spec supersedes get a pointer to it, never a silent
  contradiction; factual corrections are recorded where the wrong claim lives.
- **`docs/design-notes/`** — parked items the spec resolves get a "Resolved → spec"
  blockquote at the top of the item (keep the original text for history), **and the issue
  carrying that item is closed with the same pointer** — the note holds the reasoning, the
  issue holds the obligation, so both are discharged.
- **Issues** — retarget/retitle moved issues; post final acceptance criteria as comments
  ([pipeline.md](pipeline.md) step 4).

The spec's own §Docs sync section lists the expected targets; the sweep verifies nothing else
drifted. (Codified 2026-07-07 — the E10 sweep touched six files.)
