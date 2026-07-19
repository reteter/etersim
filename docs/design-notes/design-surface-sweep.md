# Design-surface sweep — method and ledger

A standing, multi-session pass that reads the project's documents **against each other**.
Opened 2026-07-19 (s13) at the owner's call, with the corpus set to the **whole design
surface** rather than the load-bearing path.

## Why this exists

Neither of s12's two decisive findings was catchable by any gate we run. Both were
documents that were individually coherent and jointly false:

- **#304's re-evaluation trigger** named a premise that the E15 spec contradicts — the
  trigger was void from the day it was written.
- A **chain recipe collided with a building's goods filter** across two specs.

Every gate we own reads a *diff*: review, tests, E2E, the docs sync sweep. A contradiction
between two documents that nobody is currently editing has no diff to appear in, so it is
invisible to all of them. It surfaces only when someone reads both — which, before s12,
happened by luck.

**Note the difference from `WORKFLOW.md` §Docs sync sweep, which has a confusingly similar
name.** That one is narrow and one-directional: it starts from a freshly approved spec and
asks "did anything else drift?", against a target list the spec itself supplies. Both s12
findings passed through it unharmed, because neither was drift from a spec. This sweep has
no privileged starting document.

## Corpus

98 files, ~8.5k lines, plus the issue tracker.

| Segment | Files | Lines |
| --- | --- | --- |
| `docs/specs` | 13 | 2796 |
| `docs/design-notes` | 38 | 2540 |
| `docs/*` (PRD, WORKFLOW, HANDOFF, PROCESS, SELFCHECK, agent-memory, INTERVIEW-NOTES) | 7 | 1068 |
| `docs/incidents` | 19 | 784 |
| root (AGENTS.md, CLAUDE.md, CONTEXT.md, README.md) | 4 | 742 |
| `docs/personas` | 6 | 242 |
| `docs/adr` | 8 | 236 |
| `.claude/agents` (coder, professor — cited by CLAUDE.md as contracts) | 2 | 107 |
| `.github/pull_request_template.md` (the gate list) | 1 | 12 |
| **GitHub issues** — 29 open + 112 closed; **196 unique numbers cited** by the docs | — | — |

**Out of corpus:** `.claude/skills/**` (~1.9k lines) — harness tooling, not project design.

Issues are corpus, not an appendix: #304's void trigger lived in an acceptance-criteria
comment, not in the repo.

## Method: subject-keyed, not pairwise

Pairwise is not an option — 98 documents is 4 753 pairs. Instead:

**Extract nothing; key on subjects and let contradictions collide.** For each subject, grep
the corpus, read the hits together, adjudicate. This is O(N) reading instead of O(N²)
comparisons, and it works *here specifically* because `CONTEXT.md` is enforced law: the same
concept carries the same name everywhere, so a grep on the term genuinely gathers everything
that speaks about it. In a repo without an enforced ubiquitous language this method would
leak badly — the same idea would hide under five names and never collide.

The subject list is therefore closed and known: **81 glossary terms**, plus the process
subjects below that have no glossary entry.

### Pass A — referential integrity (mechanical, enumerable)

Every claim of the form *"X lives in / is decided by / is triggered by Y"*, checked against Y.
This is the class that produced #304.

| Class | Count | Check | Status |
| --- | --- | --- | --- |
| Relative `.md` links | 208 | target file exists | **CLEAN** (2026-07-19, scripted) |
| ADR references | 117 | citing text matches the ADR's actual decision | pending |
| Issue references | 196 unique | citing text matches the issue's current state + newest AC comment | pending |
| Bare `see <doc>` refs | 10 | resolves and says what the citer claims | pending |
| **Cross-epic triggers** (in `docs/`) | 11 statements | a re-evaluation trigger naming another epic is verified against that epic's spec **and against whether it has already fired** | **worked s13** — F4–F8 raised; #212's trigger verified NOT fired (`src/` at 19 201 of the ~30 000-line trigger) |
| Cross-epic triggers (inside issue bodies / AC comments) | not yet enumerated | same | pending |

### Pass B — subject adjudication

Per `CONTEXT.md` section; each term greped across the corpus and its claims read together.

| Section | Terms | Status |
| --- | --- | --- |
| World & setting | 17 | pending |
| Trade & economy | 16 | pending |
| Player & ships | 11 | pending |
| Buildings & construction | 11 | pending |
| Guilds & contracts | 12 | pending |
| Harness & evaluation | 8 | pending |
| Simulation | 6 | pending |
| **Process subjects** (no glossary entry): verification gates, merge/wave ritual, session ritual, model ladder, review depth, documentation law | — | pending — **F1 came from here** |

## Binding rules

Without these the archive drowns the signal:

1. **HIST does not bind.** A HIST design note disagreeing with a LIVE document is
   provenance, not a finding — that is what HIST *means*.
2. **But a LIVE document citing a HIST one as current IS a finding.** Same for a doc citing
   a closed issue as open work.
3. **Newest acceptance-criteria comment wins** for issue scope (WORKFLOW §4); a doc quoting
   a superseded AC is a finding against the doc.
4. **Tuning constants are exempt** — they may drift from specs by design (SELFCHECK §4.7).

## Finding policy (owner decision, s13)

**Read-only plus routing.** A finding is recorded here and routed; it is *not* fixed in the
same pass. Rationale: s12 showed one finding can escalate into a sub-epic, an ADR and rewritten
acceptance criteria. Fixing in flight means the sweep gets swallowed by its first serious
finding and never completes.

**One exception:** a finding that blocks the next queued work (#306 → #307) is fixed
immediately.

Findings needing work get issues; the rest stay as rows below until routed.

## Findings

| # | Class | Subject | Finding | Routing |
| --- | --- | --- | --- | --- |
| F1 | process | selfcheck obligation | `CLAUDE.md` §Rules makes the selfcheck **unconditional** ("Before starting any task, run the pre-work checklist … and post its report"); `docs/SELFCHECK.md` line 3 makes it **on request** ("Run this before starting work **when the owner says so**", with a sample owner prompt). A model reading only SELFCHECK skips it by default; a model reading CLAUDE.md never skips. Both were followed at s13 open — by reading both. | **resolved s13** — owner ruling: `CLAUDE.md` is law (selfcheck before any task). `SELFCHECK.md` amended in this PR so the owner prompt reads as an *alternative* trigger rather than the condition. |
| F3 | form | glossary convention | `CONTEXT.md` entries are headed `**Term** (PL: …):` at line start, but wrapped prose inside an entry can land a bold phrase at line start and imitate a header. Three do: `eterowy` (L148, inside *Aether ice*), `Margin Gate` (L335, inside *Stop*), `only by Company deliveries` (L417, inside *Processing*). Enumerating terms by the documented convention yields 84 where the truth is 81 — and `Margin Gate` looks like a duplicate entry, since a real one exists at L348. Not a contradiction; a legibility defect in the one document the whole sweep keys on. | open — cheap fix (reflow three lines); no behavior depends on it |
| F2 | status | machine handoff | `docs/HANDOFF.md` §Watch items states "s12 was the last session on the brother's PC. From s13 the owner is back on their own machine — the `gh` switch dance no longer applies." s13 ran on the brother's PC and the dance applied. A **prediction** was written as settled state, and HANDOFF went misleading for the second consecutive session. | open — feeds the standing proposal that a falsified HANDOFF line gets an immediate strike-through |
| F4 | trigger fired | route events, phase 2 | `route-events-2026-07-14.md:40` parks opt-in encounter offers (#131) with **"Unpark trigger: E3 contracts shipped"** and "own grill at unpark". The **E3 milestone is closed, 8/8**. The trigger fired and nobody swept it: #131 is still titled "parked hooks with unpark triggers", and HANDOFF's *Parked-in-a-lot-with-no-exit* watch item lists `route-conditionals`, `e8-followups` and the four grill briefs — **but not #131**. Phase 3's trigger (real multiregion) correctly has not fired. | open — owner: run the grill, or re-park with a new trigger the way #304 was |
| F5 | status | Professor UI/store review | `professor-review-ui-store-2026-07-14.md:85` says **"Findings 4, 5, 8 → parked in this note"** with unpark triggers `#174`/`#177` pickup, `#175` pickup, and a post-E3 hygiene pass. **#174 is closed and E3 is closed** — two of those fired. Yet the index marks this note **HIST**, while its own stated criterion makes a note with unshipped parked items **LIVE**. This one bites the sweep itself: binding rule 1 says HIST does not bind, so a mis-marked HIST note is invisible to every future reader **by design**. | open — flip to LIVE (or discharge findings 4/5/8 explicitly); then re-check the other HIST rows for the same defect |
| F6 | trigger fired | price board hotkey | `E8-living-economy.md:247` defers with "(reconcile configurability with #56 **when it lands**)". #56 landed 2026-07-13 — and its scope decision was **v1-lite: fixed bindings, remappable bindings explicitly deferred, "do not build them"**. So the pending reconciliation has an answer (nothing to configure), which nobody wrote back into the spec. | open — one-line spec amendment; no code implication |
| F7 | structural | specs have no staleness marker | `docs/design-notes/` and `docs/incidents/` both carry an indexed digest with a status column; **`docs/specs/` has neither an index nor a LIVE/HIST equivalent**, yet **7 of its 12 specs belong to closed milestones** (E2, E3, E8, E9, E9.1, E10, E12 — 13 files counting `TEMPLATE.md`; E1 shipped without a spec) and still read as normative prose. E14's spec makes a de-facto eighth, per F8. Some carry an implementation-status table, not all. Consequence for this sweep: binding rule 1 has **no defined analogue for specs**, so "does this shipped spec still bind?" currently has no answer. | open — **decide before Pass B starts**, it changes how every spec hit is adjudicated |
| F8 | status | E14 milestone | Milestone **E14 — Shipyard & Refit is open with 0 open / 8 closed** issues. The tracker contradicts itself about whether the epic is done. | open — close the milestone, or say what is still owed |

## Stop rule

The sweep is done when every Pass A row and every Pass B row reads CLEAN or carries findings.
It is explicitly **resumable**: this table is the state. A session picks the topmost pending
row, works it, updates the row, and stops wherever it stops.
