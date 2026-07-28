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
digest, not file by file.

- **Adding a note means adding its row** in the same commit: what it is, what it concluded,
  LIVE or HIST.
- **Closing out a note's last open item means flipping it to HIST** in the commit that closes
  it.
- **`docs/specs/` has no LIVE/HIST axis** — every spec binds (owner ruling, s13 sweep binding
  rule 5). Add its row to [specs/README.md](../specs/README.md) — epic, milestone state,
  as-built digest — and update that row in the same commit that resolves any deferral it names
  (sweep F7, #309).

Volume in an indexed category is nearly free; volume in an unindexed one compounds until
nobody reads it (2026-07-19 retro).

## Decisions propagate at the moment they change

Revising a recorded decision — a trigger, a scope call, a lock, an acceptance criterion —
means updating every other document that records *the same decision*, **in the same commit**
(or the same batch of issue edits).

**Find them by walking the citations the document you are editing already carries:** a grill
note names its issue, an issue names its grill note, a spec names its ADR. Pointers were never
the missing piece — #131 and its design note cite each other, and their unpark trigger still
diverged for four days because nobody was obliged to walk the link (sweep F4/F9).

**The test:** the commit message or the issue comment names the documents you updated, or
states that no other document records the decision. **Unstated means unchecked.**

- **A falsified line is struck immediately** — in place, now, not at the next refresh
  (sweep F2).
- **A prediction is recorded as a prediction**, carrying its falsifier, never as settled state.

## A trigger is a promise, and promises live in the issue tracker

A design note may park the *reasoning* for something deferred; it may not be the only record of
the *obligation* (owner ruling 2026-07-19, sweep F5). If you write an unpark trigger — "revisit
at multiregion", "when #N is picked up", "post-E3 hygiene pass" — **file the issue that carries
it** and let the note point at the issue.

The asymmetry is structural: `gh issue list` is swept at every session start, while notes are
read one index line at a time and HIST rows are explicitly *"safe to skip"*. **A trigger
written in prose fires into a document nobody is obliged to open** — three such triggers once
went five days unnoticed while the file one of them meant to shrink grew 23% (→ #319–#321).

- **The detector:** `npm run check:triggers` (#332) — every unpark trigger in
  `docs/design-notes/` names an issue. It is red-since-birth and unwired: #412, incident 0030.
- **Before marking a note HIST:** if flipping it would hide an obligation, file the obligation
  *then* flip.
- **If you are unwilling to file an issue, do not write a trigger.** Record it as an idea with
  no commitment.

## Session-boundary docs exception

The session-close docs-only batch (scorecard rows, incident reports, memory exports) commits
**directly to `main`** and is pushed immediately (owner 2026-07-16). Before committing,
`git status -sb` must show `main` level with `origin/main` (incident 0006). Anything beyond
the close ritual takes branch + PR.

## Line breaks are semantic, not width-wrapped

A line breaks at a clause boundary — sentence end, semicolon, explanatory colon, em-dash — plus
a 100-character soft fallback for any segment between hard separators; never at an arbitrary
width (owner ruling 2026-07-21, #341).

**This is `npm run docs:normalize`'s job, never a hand-reflow.** Wrap position anchored to
meaning is what makes `^`-anchored greps against docs trustworthy, and every law above depends
on that. Enforced via `--check` against an allowlist of already-migrated files, not repo-wide;
#384 carries the owner's override of the segment-by-segment rollout.

## Docs sync sweep (before committing a spec or decision batch)

A spec is never the only file that changes. Before committing an approved spec — or any
decision session's output — sweep:

- **`CONTEXT.md`** — terms locked during the grill: new entries with PL names, updated
  implementation notes.
- **[PRD.md](../PRD.md)** — milestone/epic notes, sequencing changes, spec links.
- **Older specs** — sections the new spec supersedes get a pointer to it, never a silent
  contradiction; factual corrections are recorded where the wrong claim lives.
- **`docs/design-notes/`** — parked items the spec resolves get a "Resolved → spec" blockquote
  at the top of the item, keeping the original text; **the issue carrying that item is closed
  with the same pointer**, so both the reasoning and the obligation are discharged.
- **Issues** — retarget/retitle moved issues; post final acceptance criteria as comments
  ([pipeline.md](pipeline.md) step 4).

The spec's own §Docs sync section lists the expected targets; the sweep verifies nothing else
drifted. (Codified 2026-07-07 — the E10 sweep touched six files.)
