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

~~The subject list is therefore closed and known: **81 glossary terms**, plus the process
subjects below that have no glossary entry.~~ **False — struck s14, see F13.** The 81
enumerable entries are a *subset* of the vocabulary, not the whole of it: `CONTEXT.md`
also glosses terms **inline inside other entries** (`mandate`, `starved`, `labor fee` —
each with a `(PL: …)` name, none reachable by enumerating line-start entries), and uses
load-bearing domain words with **no gloss at all** (`elasticity`, `storability`). So the
subject list is *open*, and anything outside the 81 is invisible to Pass B by construction.
Pass B therefore carries a second obligation beyond the term list: when a term's entry
names a neighbouring concept, check whether that concept has an entry of its own.

**Counts are anchored before they are trusted** (incident 0020). Any corpus-wide
measurement is validated against one term whose answer is known in advance — a
measurement with no anchor cannot report its own failure, and one silently lossy grep
turns this whole sweep into a false CLEAN.

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

**Row order is by adjudicability, not by `CONTEXT.md` order** (owner decision, s14). The
sections differ in one way that dominates cost: whether a *third arbiter* exists. Where a
term is implemented, `src/sim` and its 611 tests settle a CONTEXT-vs-spec disagreement
mechanically. Where it is lore, nothing settles it but judgement — and nobody implements
against lore, so the yield is lower too. So the code-backed sections go first and
`World & setting` (the topmost row under the old rule, and the most expensive one without
an arbiter) goes last.

The mention counts below are the corrected s14 measurement (6 023 total). Read them as an
**upper bound on reading, not as cost**: a mention is usually a *use* ("the Ship sails to
the Port"), and only a *claim* — a definition, a rule, a number — can contradict anything.

| Order | Section | Terms | Mentions | Arbiter | Status |
| --- | --- | --- | --- | --- | --- |
| 1 | Trade & economy | 16 | 906 | `src/sim` | **worked s14** — `_Implementation_` claims verified against code (below); **F13 raised** |
| 2 | Simulation | 6 | 648 | `src/sim` (4 terms) / ADR-0008 + E13.0 spec (2 terms) | **worked s15 — CLEAN** (below); no finding |
| 3 | Buildings & construction | 10 | 683 | `src/sim` (8 built) / E15 spec (2 unbuilt) | **worked s15 — CLEAN** (below); no finding. *Term count corrected 11→10 — see below.* |
| 4 | Player & ships | 11 | 1557 | `src/sim` | pending |
| 5 | Guilds & contracts | 12 | 587 | `src/sim` | pending |
| 6 | World & setting | 17 | 1046 | none (lore) | pending |
| 7 | Harness & evaluation | 8 | 596 | none (unbuilt) | pending |
| — | **Process subjects** (no glossary entry): verification gates, merge/wave ritual, session ritual, model ladder, review depth, documentation law | — | — | — | pending — **F1 came from here** |

**Trade & economy, verified clean (s14).** Every `_Implementation_` line in the section
makes a checkable claim about the code, and all of them hold: `SPREAD = 0.025`
(`market.ts:19`), `quoteBuy`/`quoteSell` (`market.ts`), `effectiveBase` + `ARCHETYPE_BIAS`
× per-port jitter (`market.ts:40`, `region.ts:104`, worldgen), `Port.priceBias`,
`World.flowDrift` stepped at the day boundary with bounds `[0.7, 1.3]` (`tick.ts:32-33`,
`driftPhase`), `World.osmosisPulse` + `osmosisTick` (`world.ts:65`, `osmosis.ts:38`).
The section's defect is not in these claims but in a word they all lean on — F13.

**Simulation, verified clean (s15).** Six terms, and the row's real lesson is about *which
arbiter answers*. Four are built and `src/sim` settles them: **Speed** (`speed.ts:7`
`SPEEDS = ["paused", 1, 10, 100]`, "Pure time arithmetic only" ↔ "purely presentational"),
**World** (`world.ts:46` carries the entry's exact phrase, "deterministic given seed and
player commands"), **Command** (`commands.ts:45` — the entry's examples buy/sell/assignRoute
all exist as `kind`s), and **Tick** (already settled in Pass A against ADR-0003,
`TICKS_PER_DAY = 24` — not re-litigated). The other two, **Goods store** and **Transfer**, are
**not in `src/sim` and must not be checked against it** — they are the approved-but-unbuilt
E13.0 concepts, and the repo's own *glossary-first* law (`CLAUDE.md`: new concept ⇒ entry
first) makes a present-tense entry ahead of code the intended sequence, not drift. Their
arbiter is **ADR-0008 + `E13.0-goods-store.md`**, and against it every claim holds: one opaque
type reachable only through `amountOf`/`withAdded`/`withRemoved`, the receiving store owns the
policy, capacity is never a store field (it is `Ship.hold`), Transfer is value-neutral because
only a booked Ledger event moves company value, and "distinct from a trade" is exact precisely
because unifying `market↔hold` with the primitive is **deferred** (ADR-0008 §Not decided here).
The neighbour-concept check (the F13 obligation) is clean: Storehouse, Hold, Cargo, Building,
Refit, Ledger, Company and Good each carry their own entry. **Recorded for the next session so
it does not repeat the trap this one nearly did:** "unbuilt in `src/sim`" is a false finding
when the glossary is mandated to lead.

**Buildings & construction, verified clean (s15).** Ten terms (the table's "11" was a
miscount — below), same arbiter split as row 2. **Eight are built and settle against
`src/sim`:** Reserve (`building.ts:33` `CONSTRUCTION_RESERVE = 500`, enforced at the four
points the entry names — found/place gates, auto-draw skip `:342`, rush purse cap `:166`),
Docking fee (`region.ts:87` `DOCKING_FEE` per archetype, `ledger.ts:40` `dockingFee` kind),
Refit (`shipyard.ts:31` `HOLD_LADDER = [2, 1.5, 1.25]`, "rounded once from base, baseHold 50:
[100,150,188]" matches the code comment, three rungs = the "hard cap after three"), Build
Order / Recipe (`SHIP_RECIPE`, labor fee up front), Headquarters, Shipyard, Building
(roadmap claims match the milestone map: E14 closed, E13/E15 open). **Two are unbuilt —
Processing and Processing plant (E15) — and their arbiter is the E15 spec, not `src/sim`**,
the same glossary-first case as row 2: every claim (chain fixed at construction, finite
in/out stores, one conversion per world day, fed only by deliveries / drained only by
withdraw, one plant per port, upkeep under the Reserve clamp, the two stalls starved /
backlogged) holds against `E15-processing.md`. Neighbour-concept check clean: Great Work,
Guild, Guildhouse, Building permit, Upkeep, Expedition each carry their own entry.

*Count correction, not a finding.* The table said 11; the section holds **10** entries. The
overcount came from **this pass's own first grep**, not the document: `**processed goods**`
(L427) is an inline gloss inside the Processing entry that wrapping pushed to line-start, and
a loose `^\*\*…\*\* \(PL:` pattern counted it as a header. Anchored to the actual convention
— which ends `):`, and the gloss ends in a comma — it falls out cleanly, and F3's "81 by the
documented convention" holds at both `e8b6ff4` and HEAD. This is not a new legibility defect;
it is the exact bold-at-line-start-by-wrap artifact the s15 markdown-normalizer discussion is
aimed at, and a concrete motivating instance for that issue (now filed as #341) — **not** an F3
reopening and not a hand-reflow (wrap position is a script's job, owner direction s15).

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

**Amended at s13 close.** The policy did its job — it kept the sweep from being swallowed by
its first serious finding — but a ledger of recorded-and-unfixed findings is itself
forward-looking text, the one kind that rots (see the trimmed hypothesis below). So: **a
finding whose fix needs no design judgement is discharged as soon as its pass closes**, not
left standing. F3, F6, F8 and F11 were discharged this way at s13 close. Findings that need
an owner call (F5, F10) stay open by design, not by inertia.

## Findings

| # | Class | Subject | Finding | Routing |
| --- | --- | --- | --- | --- |
| F1 | process | selfcheck obligation | `CLAUDE.md` §Rules makes the selfcheck **unconditional** ("Before starting any task, run the pre-work checklist … and post its report"); `docs/SELFCHECK.md` line 3 makes it **on request** ("Run this before starting work **when the owner says so**", with a sample owner prompt). A model reading only SELFCHECK skips it by default; a model reading CLAUDE.md never skips. Both were followed at s13 open — by reading both. | **resolved s13** — owner ruling: `CLAUDE.md` is law (selfcheck before any task). `SELFCHECK.md` amended in this PR so the owner prompt reads as an *alternative* trigger rather than the condition. |
| F2 | status | machine handoff | `docs/HANDOFF.md` §Watch items states "s12 was the last session on the brother's PC. From s13 the owner is back on their own machine — the `gh` switch dance no longer applies." s13 ran on the brother's PC and the dance applied. A **prediction** was written as settled state, and HANDOFF went misleading for the second consecutive session. | **resolved s13** (#313) — line struck in place with what actually happened, and the standing proposal became law: WORKFLOW §Documentation law now requires an immediate strike-through, plus "a prediction is recorded as a prediction". A strike is not a refresh, so HANDOFF's owner-request rule is untouched. |
| F3 | form | glossary convention | `CONTEXT.md` entries are headed `**Term** (PL: …):` at line start, but wrapped prose inside an entry can land a bold phrase at line start and imitate a header. Three do: `eterowy` (L148, inside *Aether ice*), `Margin Gate` (L335, inside *Stop*), `only by Company deliveries` (L417, inside *Processing*). Enumerating terms by the documented convention yields 84 where the truth is 81 — and `Margin Gate` looks like a duplicate entry, since a real one exists at L348. Not a contradiction; a legibility defect in the one document the whole sweep keys on. | **resolved s13** — all three lines reflowed. Verified: enumerating by the documented convention now yields exactly 81, matching the count of `(PL: …)` entries. |
| F4 | stale copy | route events, phase 2 unpark | `route-events-2026-07-14.md:40` **and #131's body** both state *"Unpark trigger: E3 contracts shipped"*, and E3 is closed 8/8 — so on those two documents the grill is overdue. It is not. #131 carries a **2026-07-15 comment** from the farewell-roadmap grill: *"opt-in encounters belong to inter-region crossings… **Unpark trigger updated: revisit at the M6 grill**."* Newest comment wins (WORKFLOW §4), so both the note and the issue body carry a **superseded** trigger. Worked demonstration of the cost: this sweep's own first pass read the note, concluded the trigger had fired unswept, and recorded that as a finding — the issue comment refuted it one step later. | **resolved s13** (#313) — M6 trigger written back into the grill note as a blockquote (original kept for history) and struck in #131's body. First application of the propagation rule. |
| F5 | status | Professor UI/store review | `professor-review-ui-store-2026-07-14.md:85` says **"Findings 4, 5, 8 → parked in this note"** with unpark triggers `#174`/`#177` pickup, `#175` pickup, and a post-E3 hygiene pass. ~~**#174 is closed and E3 is closed** — two of those fired.~~ **Struck s14 — three fired**, and the third is the sharpest: besides #174 (closed 2026-07-15) and E3, the **Finding-2 refactor named inside finding 5's own trigger shipped** (`src/ui/OverlayShell.tsx` + `Tabs.tsx` exist; all three overlays use them) and went past it. Verified s14 at `main @ c62bb27`: all three findings still live in code — `PortPanel.tsx:837` / `gameStore.ts:139`, `TopBar.tsx:49,58,59`, and `HeadquartersPanel.tsx` at **605 lines** against the 493 the note recorded. Yet the index marks this note **HIST**, while its own stated criterion makes a note with unshipped parked items **LIVE**. This one bites the sweep itself: binding rule 1 says HIST does not bind, so a mis-marked HIST note is invisible to every future reader **by design**. | **resolved s14** — owner ruling: neither LIVE nor discharge, **take them out of the note**. Findings 4/5/8 → **#319/#320/#321**, each citing its finding; the note then *is* historical and HIST becomes true rather than a mislabel. Rationale beyond this instance: **a parking inside a note is a stock with no outflow** — an issue is met via `gh issue list` whether or not the reader opens the right file, a prose trigger is met only by luck. Finding 8 priced the difference: the file its hygiene pass was to shrink grew 23% while parked. Note that the repo had already written the remedy — **#304**, *"the deferral is a decision with a home rather than a note that decays"* — five days after this note parked three findings the other way. **HIST re-check done** (26 rows): one further instance, `professor-review-sim-guilds-contracts-2026-07-14` finding 4, parked to *multiregion* — trigger **not** fired, so it had cost nothing, but same mechanism, moved to **#322**. Every other HIST row is clean: the parkings there already carry an issue (#131, #134, #115) or shipped. **Generalised into law the same day** (owner: *"zapiszmy regułę do zmienionych zachowań"*): `docs/WORKFLOW.md` §Documentation law — **a trigger is a promise, and promises live in the issue tracker**, with a greppable detector (every unpark trigger names an issue) and a test before flipping a note to HIST. Restated in `CLAUDE.md`, `docs/SELFCHECK.md`, `docs/personas/ANALYST.md` and the design-notes index. Pre-law backlog filed as **#326** rather than left as a silent exception; `world-model-implications` §Next — written earlier in this same session and already in breach — discharged to **#324**/**#325**/a comment on **#234**. |
| F6 | trigger fired | price board hotkey | `E8-living-economy.md:247` defers with "(reconcile configurability with #56 **when it lands**)". #56 landed 2026-07-13 — and its scope decision was **v1-lite: fixed bindings, remappable bindings explicitly deferred, "do not build them"**. So the pending reconciliation has an answer (nothing to configure), which nobody wrote back into the spec. | **resolved s13** — the E8 spec now records the answer instead of the question: nothing to reconcile, #56 landed v1-lite with remappable bindings explicitly not built. |
| F7 | structural | specs have no staleness marker | `docs/design-notes/` and `docs/incidents/` both carry an indexed digest with a status column; **`docs/specs/` has neither an index nor a LIVE/HIST equivalent**, yet **7 of its 12 specs belong to closed milestones** (E2, E3, E8, E9, E9.1, E10, E12 — 13 files counting `TEMPLATE.md`; E1 shipped without a spec) and still read as normative prose. E14's spec makes a de-facto eighth, per F8. Some carry an implementation-status table, not all. Consequence for this sweep: binding rule 1 has **no defined analogue for specs**, so "does this shipped spec still bind?" currently has no answer. | **resolved s13** — owner ruling: every spec binds, no HIST analogue (binding rule 5). Remaining work — a one-line-per-spec index for `docs/specs/` — routed to **#309**. |
| F8 | status | E14 milestone | Milestone **E14 — Shipyard & Refit is open with 0 open / 8 closed** issues. The tracker contradicts itself about whether the epic is done. | **resolved s13** — milestone E14 closed; the four remaining open milestones (E11, E13, E13.0, E15) all carry real open work. |
| F9 | structural | decisions revised in issue comments do not flow back | The repo's rule that **the newest AC comment supersedes** (WORKFLOW §4) makes an issue comment a legitimate place to change a decision — but nothing carries that change back to the **design note that originated it**. Two instances, one per direction: **#131** (trigger revised in a comment 2026-07-15; the originating grill note still says E3, F4) and **#304** (trigger premise found void; there the spec, HANDOFF and the note *were* updated in s12 — but only because a human happened to be reading them). The gap is not the comment, it is the absent return path. | **resolved s13** (#313) — landed as **WORKFLOW §Documentation law: "Decisions propagate at the moment they change"**, plus a `CLAUDE.md` line. Key design finding: **cross-references were never the missing piece** — #131 and the grill note cite each other and the trigger still diverged, so the obligation attaches to the moment of revision (walk the citations the edited document already carries; state which you checked — unstated means unchecked). |
| F10 | referential | PRD's hard-no scope list | `PRD.md:108` reads *"Out of scope (**hard no, see ADR-0004**): multiplayer, backend/accounts, mobile, Steam/desktop packaging, **3D, direct combat**"*, and `PRD.md:63` quotes **"ADR-0004's *no direct combat*"** as standing at every lens level. ADR-0004 is *Local persistence, no backend in v1*; it lists multiplayer, accounts, server sync, leaderboards, mobile, Steam — **no 3D, no combat, and no such phrase to quote**. The decision is presumably real and the owner's, but its cited authority is empty, and "no direct combat" is load-bearing: it governs the Events gradient and neighbours the M3 no-punishment lock that #131 phase 3 is parked behind. Anyone who checks the combat law at its stated source — as this sweep did — finds nothing. **Corrected s14 on evidence:** ~~the decision is presumably real~~ — it *is* real and it *is* recorded, at `PRD.md:13` (§Player fantasy, *"not through combat or reflexes"*), present since the foundation commit. And the citation never drifted: `git show 37b5643:docs/PRD.md` carries the identical six-item list already crediting ADR-0004, written in the **same commit** as the ADR that omits two of them. It was decoration from birth. A **third** site F10 missed: `grill-brief-m6-zoom-out.md:24` (*"still no combat (ADR-0004)"*) — a **LIVE** brief steering the one grill where the rule is a live question. | **resolved s14** — owner ruling: **split by weight**, against the repo's own ADR criteria (`WORKFLOW.md` §Documentation law: *hard to reverse, surprising without context, the result of a real trade-off*). **Direct combat** meets all three — the 2026-07-14 route-events grill genuinely weighed pirates and parked them "without letting the first punitive mechanic enter casually" — so it gets **[ADR-0009](../adr/0009-no-direct-combat.md)**, which records the decision, its operative boundary (*piracy only as an abstract voyage hazard*) and its four-condition reversal path, rather than inventing one. **3D** meets one, so it keeps no ADR and is demoted to a plain scope line: filing it would have manufactured a rationale retroactively, which is the very failure being corrected. All three citation sites repointed. |
| F12 | method | the sweep's own instrument | The Pass B sizing script counted terms as `$(grep -roiF "$term" $FILES \| wc -l)`. On this machine `grep -i` with `-F` **aborts** (exit 134, core dumped) — but `wc` counted the empty output as `0` and a pipeline's status is its last command's, so **a crash was recorded as a data point**. The measurement saw **26 % of the corpus** (1 575 mentions of a real 6 023) and reported **ten glossary terms as having zero occurrences anywhere**, which reads exactly like a finding about orphaned vocabulary. All ten were artifacts. What caught it was a domain check rather than a tooling one — `Thaler` is the currency, and a currency cannot have zero mentions. Matters beyond the slip: **Pass B is grep-driven end to end**, so a lossy count does not produce a false alarm here, it produces a false **CLEAN** — the same unchecked-exit-code defect as incident 0019 one session earlier, this time aimed at the sweep itself. | **resolved s14** — incident **0020** filed; the method section now requires every corpus-wide count to be anchored against a term whose answer is known in advance, and counts are not read out of a pipeline's tail. |
| F13 | semantic | `elasticity` (and `storability`) | **The word `elasticity` carries two different meanings in live text, and has no glossary entry to adjudicate between them.** Meaning A, the exponent of the price-from-stock curve: `market.ts:12,49` (`ELASTICITY = 0.75`, `(equilibrium/stock) ** ELASTICITY`), `E2-trade-loop.md:77,80` (same formula, `elasticity = 0.75`), `osmosis.test.ts:50`. Meaning B, the price-elastic multiplier on production/consumption flows: `E8-living-economy.md:192-193,276` (`elasticityMult = clamp(ratio, FLOW_MULT_MIN, FLOW_MULT_MAX)`, "clamps at 0.25/1.5"), `market.test.ts:284`, `market.ts:168,172`. **`src/sim/market.ts` uses both senses in one file** — A at lines 12/49, B at lines 168/172. `CONTEXT.md:214` does adjudicate, and picks **B** (*"price elasticity … names the production/consumption response"*) — while the code's constant named `ELASTICITY` is **A**, against the `CLAUDE.md` law that code identifiers come from the glossary. Same shape, milder: **`storability`**, named at `CONTEXT.md:137` as one of the four "market laws" Aether ice is defined against (*"visibly breaks exactly one"*), with no entry and no code. Two of those four laws are undefined vocabulary. **This is also how the finding was found** — not by sweeping a term, since neither is on the list, but by reading a neighbouring entry. See the struck claim in §Method: the 81 are a subset, so Pass B's coverage gap is structural, not incidental. | **resolved s14** (#316) — owner ruling: **B keeps the name**, matching `CONTEXT.md:214` and textbook economics (elasticity is *quantity* answering price), and costing nothing on B's side because the code already says `FLOW_MULT_*` / `productionMult`. A became `PRICE_CURVE_EXPONENT` — a name introducing no new domain word, since "price curve" was already in use. `CONTEXT.md` gained **Elasticity** and **Storability** entries, so all four market laws now have one. E2's formula and E8's phantom `elasticityMult` reconciled. Note what the fix confirmed: the collision never lived in the code's identifiers — only in prose, where nothing checks. |
| F14 | referential | the "M3 no-punishment lock" | `route-events-2026-07-14.md` invokes **"the M3 no-punishment lock"** three times — `:16` (a law that "stays untouched"), `:19` (what pirates must not breach casually), and `:51`, where it is **condition 2 of the four-part unpark trigger** for intrusive events, and therefore load-bearing for [ADR-0009](../adr/0009-no-direct-combat.md)'s reversal path. **Nothing anywhere defines it.** Verified s14 across `docs/`, `CONTEXT.md`, `CLAUDE.md`, every ADR and every other design note; `git log -S "no-punishment"` returns exactly two commits — the grill record that coined the phrase (`e4117a8`) and this sweep's own F10 (`0c94141`). So a named lock gates a parked mechanic while no text states what it locks, and a future session cannot tell whether revisiting it is a small call or a pillar-level one. **Found while resolving F10** — the identical shape (a real-sounding authority that holds nothing), one document deeper, which is the argument for finishing the citation walk rather than stopping at the first fix. | **resolved s15** — owner ruling: **strike the name, cite the real constraint** (not define — the define option would manufacture a rationale retroactively, the exact error F10's resolution corrected). The check that decided it: the only M3-rooted "not punitive" candidate, `E13-guild-buildings.md:174`, is a playtest note about whether a *capacity clamp* feels punitive, not a general lock — and M3's success criteria (PRD) name none. The real, defined constraint is **fork 1 of the route-events grill** (2026-07-14, *not* M3): *events never modify routes, cargo or purse*. All three sites repointed to it — route-events fork-1 row and Phase-3 trigger, and [ADR-0009](../adr/0009-no-direct-combat.md) condition 2 (of which the combat ban is one instance) — with a struck-name note left in route-events so it is not reintroduced. Confirmed same class as F10: misattributed authority, name holding nothing. |
| F11 | stale copy | M4 grill brief's input list | `grill-brief-m4-workbench.md` names **#255** twice as a parked automation input — in question 6 (*"which of the parked inputs fold in, which stay parked?"*) and in §Inputs. **#255 is closed and shipped** ("route editor table — visible click affordance for empty order cells"). Grill briefs are LIVE by definition and exist to hand a future session the right questions, explicitly *"for whichever orchestrator leads the M4+ grills"* — so this one hands the M4 grill a question that no longer needs deciding. #173, #177 and #227 in the same lists are correctly open. | **resolved s13** — dropped from both lists, with a one-line note in §Inputs recording that it was there and why it went (so the next reader does not re-add it). |

## What the findings have in common (interpretation, not a finding)

Read as a system rather than as ten defects, nine of the first ten sit in the same two
places — and they are the places Donella Meadows ranks as high-leverage precisely because
they look like housekeeping:

- **Information flows** — *who learns what, and when.* F4, F5, F9 and F7 are all one shape:
  the fact was updated somewhere, and the place a future reader will actually look never
  heard about it. F5 is the sharpest, because there the rule *"HIST does not bind"* combines
  with one wrong label to make a live parking lot unreachable **by design**.
  **Refined by F5's resolution (s14):** the label was the symptom, not the defect. Fixing
  the label would have left a parking lot that still depends on a reader opening the right
  file in the right week. The defect is that **a parked finding has no outflow** — an issue
  is met by anyone running `gh issue list`; a trigger written in prose is met only by luck.
  So this bullet's shape holds, but its remedy is not "label things correctly", it is
  "**put the pending thing where the pending things are looked for**".
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

Operational payoff, and the reason this is written down rather than admired: binding rule 6
is this insight made into a filter.

**But scope the payoff honestly — the first draft of this paragraph overreached.** Rule 6
retires *status* questions, which is what Pass A asked. Pass B asks a **semantic** question:
do all the documents mean the same thing by a term? A record can be perfectly accurate about
its date and still contradict today's `CONTEXT.md` about what *Hold* is — that is not
staleness, it is contradiction, and binding rule 5 says every spec binds regardless of age.

So the saving is real but partial: it lands on `docs/design-notes` (38 files, 2 540 lines,
mostly dated records that can be read lightly for semantics) and **not** on `docs/specs`
(2 796 lines, all binding). Expect Pass B to cost roughly what the spec segment costs. A
claim the next session can check.

## Stop rule

The sweep is done when every Pass A row and every Pass B row reads CLEAN or carries findings.
It is explicitly **resumable**: this table is the state. A session picks the topmost pending
row, works it, updates the row, and stops wherever it stops.

**Amended s14.** "Topmost" now means topmost in the Pass B table's own **Order** column,
which is sequenced by adjudicability (see above) rather than by `CONTEXT.md`'s section
order. The rule is unchanged in spirit — take the next pending row, do not shop around —
but the sequence it points at was re-derived once the corpus was actually measured. If a
future session finds a better ordering, it moves the rows and says so here; what it must
not do is pick a row because it looks appealing today.
