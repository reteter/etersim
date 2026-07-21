# Parked-item audit — trigger-is-a-promise backlog (#326), 2026-07-21

Run in parallel with the #307 coder wave. Closes #326: the pre-law backlog check for the
trigger-is-a-promise law adopted 2026-07-19 (`WORKFLOW.md` §Documentation law, sweep F5) —
every unpark trigger written in `docs/design-notes/` before the law existed, checked
against it.

## Method (anchored, per incident 0020)

`grep -rn "unpark\|parked\|revisit at\|when .* lands\|when .* is picked up"
docs/design-notes/*.md` → **79 hits across 20 files.** Not all 79 are live orphaned
triggers — the bulk are `design-surface-sweep.md`'s own findings table (already-resolved
history) and HIST notes' resolution commentary (e.g. `professor-review-ui-store-2026-07-14.md`
narrating how findings 4/5/8 were unparked into #319/#320/#321). Each hit was read in
context and classified: already carries an issue, points at an already-tracked PRD/epic
slot, or is a genuine orphan.

## The rule this audit had to decide once, not per-item

**A grill tied to a named PRD milestone slot needs no issue of its own; a grill with no
milestone slot does.** The four `grill-brief-m4/m5/m6-*.md` notes are LIVE-by-definition,
sit at a well-known path the design-notes index points readers at, and their trigger is
structural — "when M4/M5/M6 starts" is read directly off `docs/PRD.md`'s roadmap and swept
every session (`CLAUDE.md` §Rules: session start reads `HANDOFF.md` then `gh issue list`).
Filing "have the M4 grill" as an issue would duplicate a fact the roadmap already encodes,
and — worse — would front-run the pipeline (`WORKFLOW.md`: grill → spec → approval →
issues; an issue for a grill that hasn't happened yet has no scope to attach acceptance
criteria to).

`route-conditionals.md` and `playtest-2026-07-14-routes-fleet-ux.md`'s two grill clusters
are the sharper case: each explicitly says **"no grill scheduled yet — owner's call on
timing"** — there is no milestone number the roadmap sweep would ever surface. That is
the gap the law targets, and it's what separates them from the M4/M5/M6 briefs rather than
just "is this a grill" being the deciding question.

## Findings and disposition

| Item | Where | Had an issue? | Disposition |
| --- | --- | --- | --- |
| Grill briefs M4-workbench, M4-events-and-ice, M5-great-work, M6-zoom-out | 4 notes | No | **Exempt** (rule above) — milestone-scheduled, no issue needed. |
| Route conditionals / "Grill cluster A" (route automation, E9 frozen-bet lock relitigation) | `route-conditionals.md`, `playtest-2026-07-14-routes-fleet-ux.md` §Cluster A | No — "owner's call on timing," no milestone | **#357** filed; both notes updated with the pointer. |
| "Grill cluster B" (region's economic surface vs the route editor) | `playtest-2026-07-14-routes-fleet-ux.md` §Cluster B | No — cross-referenced by #227's own trigger, but nothing tracked the grill itself | **#358** filed; note updated. Not folded into #357 — the source note itself keeps these as two named clusters on two different questions (route-automation semantics vs. economic-surface UI), and merging them would erase that split. |
| Worldgen guarantee for sole-producer rims (conditional watch item) | `e8-followups.md` §1, duplicated verbatim in `playtest-2026-07-09-living.md:61` | No, and duplicated with no shared tracker | **#359** filed; both notes updated, duplication noted explicitly so a future reader doesn't re-file it. |
| "Company running costs" hook | `PRD.md:411` (§Horizon), cited from three notes/specs | Yes — PRD Horizon slot, not a design-note orphan | No action — already tracked at its real home. |
| `#134` company investment policy | `founding-progress-bar-2026-07-14.md` | Yes — #134, open | No action. |
| Route events phases 2/3 | `route-events-2026-07-14.md` | Yes — #131, open | No action. |
| Semantic code search | `semantic-code-search-tooling.md` | Yes — #212, open | No action. |
| `pickSource` memoization | `professor-review-sim-guilds-contracts-2026-07-14.md` | Yes — #322 (moved out during the s14 sweep) | No action — already handled, per #326's own "do not re-file" list. |
| E5/E6-parked mechanics (orbital motion, information fog) named across several playtest notes | multiple | Yes — named PRD epic slots (E5, E6) | No action, same reasoning as the grill-brief exemption: a future-epic slot in the roadmap is its own tracker. |

## `docs/HANDOFF.md` §Watch

#326's body quoted a "parked-in-a-lot-with-no-exit" line from `HANDOFF.md` §Watch as the
symptom that motivated filing this audit. **That line no longer exists** — `grep -n
"parked-in-a-lot" docs/HANDOFF.md` returns nothing; it was removed in the #331 tsunami
HANDOFF rewrite (§State deleted, PR #340) before this audit started. Checked, not assumed:
the AC to "update or strike" it is satisfied vacuously, and this note is that record —
nothing left to touch, per the owner-request rule on `HANDOFF.md` edits (a strike of a
now-false line would have been fine without the ceremony gate per `CLAUDE.md`'s "a line
you learn is false gets struck immediately," but there was no line to strike).

## Detector check (does the law still hold, after this audit)

"Every unpark trigger in `docs/design-notes/` names an issue" — re-verified true for every
non-exempt trigger found. The four grill briefs are the one deliberate, *named* exception
(milestone-scheduled), consistent with the rule stated above rather than a silent gap.
