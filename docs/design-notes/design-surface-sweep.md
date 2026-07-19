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

### Pass A — referential integrity (mechanical, enumerable) — **COMPLETE (s13)**

Every claim of the form *"X lives in / is decided by / is triggered by Y"*, checked against Y.
This is the class that produced #304. All six rows worked; findings F4–F11.

| Class | Count | Check | Status |
| --- | --- | --- | --- |
| Relative `.md` links | 208 | target file exists | **CLEAN** (2026-07-19, scripted) |
| ADR references | 117 | citing text matches the ADR's actual decision | **worked s13** — F10 raised. Verified clean: ADR-0003's "1 tick = 1 world hour" agrees with `CONTEXT.md:718` and `src/sim/region.ts:5` (`TICKS_PER_DAY = 24`, comment cites the ADR); the ADR-0006 colour citations across `src/index.css` and e2e hold. |
| Issue references | 196 unique | citing text matches the issue's current state + newest AC comment | **worked s13** — scripted claim-direction check (says-pending vs IS-CLOSED, and the reverse) over the whole corpus: 39 candidates, **38 false positives**, F11 the only defect. The false-positive rate is what produced binding rule 6. |
| Bare `see <doc>` refs | 7 | resolves and says what the citer claims | **CLEAN** — all seven are generic pointers ("see CONTEXT.md", "see docs/WORKFLOW.md"); targets exist and none asserts specific content that could be wrong. (Earlier count of 10 double-counted root files.) |
| **Cross-epic triggers** (in `docs/`) | 11 statements | a re-evaluation trigger naming another epic is verified against that epic's spec **and against whether it has already fired** | **worked s13** — F4–F8 raised; #212's trigger verified NOT fired (`src/` at 19 201 of the ~30 000-line trigger) |
| Cross-epic triggers (inside issue bodies / AC comments) | 29 open issues, bodies + comments | same, **and against the newest comment rather than the body** | **worked s13** — F4 corrected and F9 raised from here; #212's three unpark triggers verified not fired (no occurrences logged, corpus not 2–3×). Closed issues not swept. |

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
5. **Every spec binds — HIST has no analogue in `docs/specs/`** (owner ruling, s13, closing F7).
   A design note is a *dated record* and may age without harm; a spec in this repo is an
   **as-built description that the spec-drift rule obliges us to keep true**. So a shipped
   epic's spec is not provenance: a disagreement between `E2-trade-loop.md` and today's
   `CONTEXT.md` is a live finding, not history. Consequence for sizing: all 12 specs
   (2 796 lines) are binding claim surface, making them the sweep's largest segment.
6. **A dated record is not a status claim.** Scorecard rows, playtest observations and grill
   minutes describe a moment and go on describing it correctly forever — *"deferred → #187"*
   written on 07-14 is a true sentence about 07-14, not a claim that #187 is open today. Only
   **forward-looking** text asserts the present: parking lots, triggers, briefs, queues,
   indexes, deferrals. **The test: would a reader act on this line today?** Earned the hard
   way — the scripted issue-reference check produced 39 candidates of which 38 were dated
   records, and without this rule every future pass regenerates the same 38.

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
| F2 | status | machine handoff | `docs/HANDOFF.md` §Watch items states "s12 was the last session on the brother's PC. From s13 the owner is back on their own machine — the `gh` switch dance no longer applies." s13 ran on the brother's PC and the dance applied. A **prediction** was written as settled state, and HANDOFF went misleading for the second consecutive session. | **resolved s13** (#313) — line struck in place with what actually happened, and the standing proposal became law: WORKFLOW §Documentation law now requires an immediate strike-through, plus "a prediction is recorded as a prediction". A strike is not a refresh, so HANDOFF's owner-request rule is untouched. |
| F3 | form | glossary convention | `CONTEXT.md` entries are headed `**Term** (PL: …):` at line start, but wrapped prose inside an entry can land a bold phrase at line start and imitate a header. Three do: `eterowy` (L148, inside *Aether ice*), `Margin Gate` (L335, inside *Stop*), `only by Company deliveries` (L417, inside *Processing*). Enumerating terms by the documented convention yields 84 where the truth is 81 — and `Margin Gate` looks like a duplicate entry, since a real one exists at L348. Not a contradiction; a legibility defect in the one document the whole sweep keys on. | open — cheap fix (reflow three lines); no behavior depends on it |
| F4 | stale copy | route events, phase 2 unpark | `route-events-2026-07-14.md:40` **and #131's body** both state *"Unpark trigger: E3 contracts shipped"*, and E3 is closed 8/8 — so on those two documents the grill is overdue. It is not. #131 carries a **2026-07-15 comment** from the farewell-roadmap grill: *"opt-in encounters belong to inter-region crossings… **Unpark trigger updated: revisit at the M6 grill**."* Newest comment wins (WORKFLOW §4), so both the note and the issue body carry a **superseded** trigger. Worked demonstration of the cost: this sweep's own first pass read the note, concluded the trigger had fired unswept, and recorded that as a finding — the issue comment refuted it one step later. | **resolved s13** (#313) — M6 trigger written back into the grill note as a blockquote (original kept for history) and struck in #131's body. First application of the propagation rule. |
| F5 | status | Professor UI/store review | `professor-review-ui-store-2026-07-14.md:85` says **"Findings 4, 5, 8 → parked in this note"** with unpark triggers `#174`/`#177` pickup, `#175` pickup, and a post-E3 hygiene pass. **#174 is closed and E3 is closed** — two of those fired. Yet the index marks this note **HIST**, while its own stated criterion makes a note with unshipped parked items **LIVE**. This one bites the sweep itself: binding rule 1 says HIST does not bind, so a mis-marked HIST note is invisible to every future reader **by design**. | open — flip to LIVE (or discharge findings 4/5/8 explicitly); then re-check the other HIST rows for the same defect |
| F6 | trigger fired | price board hotkey | `E8-living-economy.md:247` defers with "(reconcile configurability with #56 **when it lands**)". #56 landed 2026-07-13 — and its scope decision was **v1-lite: fixed bindings, remappable bindings explicitly deferred, "do not build them"**. So the pending reconciliation has an answer (nothing to configure), which nobody wrote back into the spec. | open — one-line spec amendment; no code implication |
| F7 | structural | specs have no staleness marker | `docs/design-notes/` and `docs/incidents/` both carry an indexed digest with a status column; **`docs/specs/` has neither an index nor a LIVE/HIST equivalent**, yet **7 of its 12 specs belong to closed milestones** (E2, E3, E8, E9, E9.1, E10, E12 — 13 files counting `TEMPLATE.md`; E1 shipped without a spec) and still read as normative prose. E14's spec makes a de-facto eighth, per F8. Some carry an implementation-status table, not all. Consequence for this sweep: binding rule 1 has **no defined analogue for specs**, so "does this shipped spec still bind?" currently has no answer. | **resolved s13** — owner ruling: every spec binds, no HIST analogue (binding rule 5). Remaining work — a one-line-per-spec index for `docs/specs/` — routed to **#309**. |
| F8 | status | E14 milestone | Milestone **E14 — Shipyard & Refit is open with 0 open / 8 closed** issues. The tracker contradicts itself about whether the epic is done. | open — close the milestone, or say what is still owed |
| F9 | structural | decisions revised in issue comments do not flow back | The repo's rule that **the newest AC comment supersedes** (WORKFLOW §4) makes an issue comment a legitimate place to change a decision — but nothing carries that change back to the **design note that originated it**. Two instances, one per direction: **#131** (trigger revised in a comment 2026-07-15; the originating grill note still says E3, F4) and **#304** (trigger premise found void; there the spec, HANDOFF and the note *were* updated in s12 — but only because a human happened to be reading them). The gap is not the comment, it is the absent return path. | **resolved s13** (#313) — landed as **WORKFLOW §Documentation law: "Decisions propagate at the moment they change"**, plus a `CLAUDE.md` line. Key design finding: **cross-references were never the missing piece** — #131 and the grill note cite each other and the trigger still diverged, so the obligation attaches to the moment of revision (walk the citations the edited document already carries; state which you checked — unstated means unchecked). |
| F10 | referential | PRD's hard-no scope list | `PRD.md:108` reads *"Out of scope (**hard no, see ADR-0004**): multiplayer, backend/accounts, mobile, Steam/desktop packaging, **3D, direct combat**"*, and `PRD.md:63` quotes **"ADR-0004's *no direct combat*"** as standing at every lens level. ADR-0004 is *Local persistence, no backend in v1*; it lists multiplayer, accounts, server sync, leaderboards, mobile, Steam — **no 3D, no combat, and no such phrase to quote**. The decision is presumably real and the owner's, but its cited authority is empty, and "no direct combat" is load-bearing: it governs the Events gradient and neighbours the M3 no-punishment lock that #131 phase 3 is parked behind. Anyone who checks the combat law at its stated source — as this sweep did — finds nothing. | open — either move the scope decision into an ADR that actually holds it, or cite whatever grill did decide it |
| F11 | stale copy | M4 grill brief's input list | `grill-brief-m4-workbench.md` names **#255** twice as a parked automation input — in question 6 (*"which of the parked inputs fold in, which stay parked?"*) and in §Inputs. **#255 is closed and shipped** ("route editor table — visible click affordance for empty order cells"). Grill briefs are LIVE by definition and exist to hand a future session the right questions, explicitly *"for whichever orchestrator leads the M4+ grills"* — so this one hands the M4 grill a question that no longer needs deciding. #173, #177 and #227 in the same lists are correctly open. | open — drop #255 from both lists |

## What the findings have in common (interpretation, not a finding)

Read as a system rather than as ten defects, nine of the first ten sit in the same two
places — and they are the places Donella Meadows ranks as high-leverage precisely because
they look like housekeeping:

- **Information flows** — *who learns what, and when.* F4, F5, F9 and F7 are all one shape:
  the fact was updated somewhere, and the place a future reader will actually look never
  heard about it. F5 is the sharpest, because there the rule *"HIST does not bind"* combines
  with one wrong label to make a live parking lot unreachable **by design**.
- **Feedback loops that report without measuring** — incident 0019 is the pure case: a guard
  that announced a deletion it had not performed. A loop whose signal is disconnected from
  the world has zero gain no matter how loudly it prints `OK`. F2 is the same defect slowed
  down: HANDOFF refreshes on request, so its drift rate exceeds its correction rate.

F10 is the exception and belongs elsewhere — not a broken flow but an **ungrounded rule**:
a real constraint citing a source that does not contain it.

The uncomfortable reading: this documentation system is **excellent at recording a decision
at the moment it is made, and has almost no machinery for keeping a recorded decision true
afterwards.** Those are different goals, and nearly every artifact here — ADRs, incidents,
grill records, indexes — is built for the first. The sweep itself is a manual compensating
loop for the second, which makes it slow, expensive, and dependent on somebody choosing to
run it. That is a weak place to intervene.

The stronger and cheaper move is one the repo has **already invented and only half-applied**:
*"adding a note means adding its row in the same commit"* is exactly a propagation rule. It
governs files. It does not yet govern decisions — which is all F9's candidate rule asks for.
Generalising a rule that already works here beats inventing a mechanism.

**Hold this loosely.** It is a model built from one session and a method that keyed on
subjects and cross-references — so of course it surfaced cross-reference defects. That nine
findings share a cause is a hypothesis the remaining passes can falsify, not a result.

### The hypothesis, trimmed by the issue-reference row (same session)

It got falsified in the useful direction almost immediately, and the correction is sharper
than the original. Closing Pass A over **196 issue citations produced exactly one defect**
(F11), and the scripted check's 39 candidates were **38 dated records**. So the citation
layer is not sick, and "information flows" was too broad a diagnosis.

The defects are not spread across documents-citing-each-other. They sit **exclusively in
text that faces forward**. And that follows from something structural rather than from
anyone's carelessness: **a record cannot go stale — it is a photograph.** A scorecard row
written on 07-14 states what was true on 07-14 and will state it correctly forever. Only
text that makes a promise about the future can rot, because the future then arrives and
checks it.

Sort the findings and it holds: F2 a prediction, F4 a trigger, F5 a parking lot under a
wrong label, F6 a deferral, F7 a spec's status, F11 a brief's input list — six for six,
all forward-facing. F1 (contradiction), F3 (form) and F10 (ungrounded citation) are other
classes entirely.

Operational payoff, and the reason this is written down rather than admired: **Pass B should
prioritise forward-looking text and can nearly skip records.** Binding rule 6 is that
insight made into a filter. It should make Pass B markedly cheaper than the 2 796-line
estimate implies — a claim the next session can check.

## Stop rule

The sweep is done when every Pass A row and every Pass B row reads CLEAN or carries findings.
It is explicitly **resumable**: this table is the state. A session picks the topmost pending
row, works it, updates the row, and stops wherever it stops.
