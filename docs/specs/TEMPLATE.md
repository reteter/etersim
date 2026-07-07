# E<n> — <Epic name>

<!-- Feature spec template — codified 2026-07-07 from the E10 spec's proven structure.
Copy to docs/specs/E<n>-<slug>.md, replace every <placeholder>, delete the guidance
comments. Keep the section order. Terms per CONTEXT.md — a new concept means adding
the glossary entry first (Documentation law, WORKFLOW.md). -->

Feature spec for epic E<n> (milestone <M?> — <name>, [PRD](../PRD.md)). Terms per
[CONTEXT.md](../../CONTEXT.md). Grilled and decided with the owner on <date>.
Status: **draft** | **approved (<date>)**.

Grill inputs: <issues, design notes, playtest observations that fed the grill — link them>.

Scope in one line: <what ships>. Explicit non-goals: <what does NOT ship, and where
each deferred item is parked (epic / design note)>.

## Design

<!-- Designer hat: mechanics, UX flows, formulas — the *what* and *why*. One
subsection per grill branch. Write decisions as settled ("X is Y", not "X could be Y").
If a decision corrects an earlier claim (issue text, playtest note), name the wrong
claim and the correction explicitly — silent contradictions rot the doc trail.
Mark cheap polish that is deliberately out of scope, so it is a decision, not an
omission. -->

### <Principle / core decision>

### <One subsection per grill branch>

## Tech

<!-- Engineer hat: data structures, module APIs, file layout — the *how*. One
subsection per module/area touched. Name concrete files, functions, template fields
and constants with values (calibrations belong here, with the reasoning). Record
owner scope calls (e.g. compat waivers) with a date. -->

### <Module (src/path)>

### Docs sync

<!-- Every other document this spec touches: CONTEXT.md entries (with PL names),
older specs it supersedes (they get pointers, not silent contradictions), new ADRs,
PRD updates. This section is the input for the pre-commit sweep
(WORKFLOW.md §Docs sync sweep). -->

## Testing

<!-- Sim: Vitest, TDD — name the properties to test, determinism first (same seed ⇒
deep-equal). UI: Playwright E2E scenarios. Manual playtest: what to eyeball or tune
that automation can't judge. -->

## Issue cut

<!-- Filed after approval; milestone = epic; one row per issue: track (sim/ui/docs),
one-line scope, blocked-by. Prefer parallel tracks of file-disjoint packages
(ORCHESTRATOR.md heuristic). Fill real issue numbers after `gh issue create`.
Final acceptance criteria live in each issue's newest criteria comment
(WORKFLOW.md §Issues). -->

Milestone **E<n> — <name>** (filed <date>).

| Issue | Track | Scope | Depends on |
| --- | --- | --- | --- |
| #<n> | sim/ui/docs | `feat(<area>)`: <one-line scope> | <#deps or —> |

Sequencing note: <where this epic sits relative to neighboring epics and why — owner
call with date>.
