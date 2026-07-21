# Design notes — index

One line per note: what it is, what it concluded, and whether it still steers work.
Read this table; open a note only when its line is relevant to what you're doing.
Same contract as [`docs/incidents/README.md`](../incidents/README.md) §Log — the digest
is what future sessions actually read, and it is written so you can absorb the
conclusion without the file.

**Status column:** **LIVE** = still steers work (parking lots with unshipped items,
pending grills, growing records). **HIST** = closed; kept for provenance, safe to skip
unless you are reconstructing why something is the way it is.

**Maintenance is part of creating the note** (WORKFLOW.md §Documentation law): whoever
adds a file to `docs/design-notes/` adds its row here in the same commit, and whoever
closes out a note's last open item flips it to HIST. An index nobody is obliged to
update decays into a second thing to distrust.

**A trigger is a promise, and promises live in the issue tracker** (owner ruling
2026-07-19, sweep F5). Park the *reasoning* in a note; park the *obligation* in an issue
carrying the same trigger, and have the note point at it. The asymmetry is the whole
argument: `gh issue list` is swept every session start, while this index tells readers
HIST rows are safe to skip — so a trigger written only in prose fires into a document
nobody is obliged to open. **Before flipping a note to HIST, ask whether the flip would
hide an obligation; if it would, file it first.** This index is where that question gets
asked, which is why the rule is restated here rather than only in WORKFLOW.

## Process, evaluation & tooling

| Note | Status | What it says |
| --- | --- | --- |
| [coder-scorecard](coder-scorecard.md) | **LIVE** | Per-PR quality metrics for coder-delivered work — the durable sample behind coder-model casting decisions (wave reports die with their sessions, this table doesn't). Appended when each wave check closes. Also carries the closed A/B read-out and the TDD-line counting rule. |
| [tiered-verification-gates-2026-07-14](tiered-verification-gates-2026-07-14.md) | HIST | Process grill (#162) that replaced flat ceremony with the tier 1/2/3 table now in WORKFLOW.md. Diagnosis kept: verification *should* dominate wall-time in agent-driven work; the defect was gates that were flat, not that they were heavy. Data point: a 60-LOC UI diff burned ~66k tokens on two reviewers re-deriving context to find one inline-catchable issue. |
| [ab-286-shipyard-construction](ab-286-shipyard-construction.md) | HIST | First same-task paired coder trial (Opus vs Sonnet, issue #286, `src/sim` + save shape). Cost metric established: % of a session limit, Opus weighing ~2×. |
| [ab-276-shipyard-ui](ab-276-shipyard-ui.md) | HIST | Second and final pair (#276, UI-only). Series closed 2/2 for Sonnet on written-rule conformance and tests at ~half the cost; Opus better architecture both times. Fed the owner decision: coder default = Sonnet, advisor = Opus. |
| [design-surface-sweep](design-surface-sweep.md) | HIST | **Closed s16** — the docs-vs-docs pass that read the project's documents *against each other*, because every gate we run reads a diff and a contradiction between two idle documents has no diff to appear in. Opened s13 (2026-07-19) over the **whole** design surface (98 files, ~8.5k lines, plus 196 issue numbers the docs cite); method was subject-keyed, not pairwise — grep each `CONTEXT.md` term and adjudicate the hits together. Pass A complete s13 (six classes, F4–F11); Pass B's seven glossary rows worked s14–s16, all CLEAN after fixes; the un-numbered Process subjects row (no glossary entry — verification gates, casting, cert order, documentation law) closed the pass s16 with three more mechanical fixes (F15–F17). Every finding across both passes is resolved or routed to a real issue — no prose triggers left parked. Carries the binding rules (**HIST does not bind**; a LIVE doc citing HIST as current does) and the full findings table (F1–F17) for provenance. A future contradiction gets a new sweep and a new note, not a reopening of this one. |
| [world-model-implications](world-model-implications.md) | **LIVE** | The standing register of statements that must be true if this world is what we say it is — each with the observation that would falsify it and the thing that checks it. Exists because **every other gate here is a comparison**, and what caught s14's ten fabricated findings was a *prediction from the world model* ("a currency cannot have zero mentions"), which no machinery owns. Its survey finding: **structure is guarded, dynamics are not** — worldgen and archetype invariants have real tests (`region.test.ts`, `worldgen.test.ts`), while nothing checks what the world must *do over time*, because that needs Runs (E11, #232→#234). The register is the assertion content E11 currently lacks. Complement to [design-surface-sweep](design-surface-sweep.md): that one catches contradiction in meaning, this one catches silence and divergence. |
| [knowing-is-not-binding-2026-07-19](knowing-is-not-binding-2026-07-19.md) | **LIVE** | Standing principle, from three s14 failures that shared one mechanism: **a system acts on what obliges it, not on what it knows.** In each case the correct knowledge was already written down and changed nothing — #304 stated F5's remedy five days early while HANDOFF §Watch logged its symptom; the ADR-0004 miscitation was false in the *foundation commit*, written by an author holding both documents (freshness is a risk factor, not a safeguard, because verification feels redundant exactly when it is cheapest); and `world-model-implications` named the parking-lot trap in §Honest limits and then committed it in §Next hours later. What worked every time was a detector, never an insight. Prices its own cost honestly: three laws landed in s14 and none is automated — a detector that is "somebody greps" is one generation better than prose, not ten. |
| [semantic-code-search-tooling](semantic-code-search-tooling.md) | **LIVE** | Why there is no vector search here (parked 2026-07-10, tracked as #212). At grep scale with a `CONTEXT.md`-enforced vocabulary, lexical search resolves conceptual queries too; the context burn came from long sessions, not failed search. Contains the design sketch for when the trigger fires (~30k lines in `src/`, or recurring "where is concept X handled" friction). |
| [markdown-normalizer-grill-2026-07-21](markdown-normalizer-grill-2026-07-21.md) | **LIVE** | Grill record for #341: clause-level line breaks everywhere in prose (sentence/semicolon/colon/em-dash + 100-char soft fallback, not per-comma), enforced via a `--check` gate scoped to an allowlist of migrated files, full coverage reached through several segment-scoped PRs rather than one pass (revisits and keeps the s15 non-goal, for `git blame`-burying reasons beyond diff size), built on `remark`/AST rather than a hand-rolled scanner, with an explicit rule keeping inline bold spans from landing at a wrapped line-start. #341 itself ships the tool + `CONTEXT.md` as the proof migration; other segments get their own follow-up issues once the tool exists. |

## Architecture reviews (the Professor)

| Note | Status | What it says |
| --- | --- | --- |
| [professor-construction-review](professor-construction-review.md) | **LIVE** | End-to-end review of the construction subsystem (2026-07-17). Engine certified sound — determinism, purity, save v13, Reserve, ledger grammar, quote/charge. Seven findings with a routing table. **F4 and F7 are both resolved** (2026-07-19): the site-registry answer to F4 was reopened and replaced by [ADR-0008](../adr/0008-one-goods-store.md), and F7 dissolved with it — addressing became constitutive rather than conventional. See [goods-store-grill-2026-07-19](goods-store-grill-2026-07-19.md). Still LIVE for **F5** (partly reduced by `writeStore`) and **F6** (`RefitOrder` stored vs derived — raise only if `HOLD_LADDER` tuning enters an agenda). |
| [professor-review-src-sim-2026-07-13](professor-review-src-sim-2026-07-13.md) | HIST | First `src/sim` review (tick pipeline, market, commands), pre-E3/E12/E13. Verdict: honestly built — purity line holds, one seeded stream, and E9's manual/routed equivalence is enforced by construction (`executeStop` dispatches the same `applyCommand`). Findings closed via #149 / routed onward. |
| [professor-review-ui-store-2026-07-14](professor-review-ui-store-2026-07-14.md) | HIST | UI + store bridge review. Central image: a UI born single-ship that grew a fleet underneath it. Three "load-bearing beams never poured" — a notice pattern the spec claimed existed but didn't, a hand-copied tab shell, and an unanswered "where does a guild's face go?" in the color law. Routing actioned same day; fed the E3 UI grill. **Findings 4/5/8 were parked here and are not any more** — sweep F5 (s14) found all three triggers had fired and all three findings still live, and moved them to **#319/#320/#321**. Read the note's §Parked findings unparked for the lesson it paid for: a parking in a note is a stock with no outflow, and Finding 8's file grew 23% while waiting. |
| [professor-review-sim-guilds-contracts-2026-07-14](professor-review-sim-guilds-contracts-2026-07-14.md) | HIST | E3-close review of `guild.ts` / `contract.ts` / settlement. *"Came to find rot and found mostly good timber"* — determinism kept via substream quarantine, settlement compounding correct. Four findings, one load-bearing for E13. All four now accounted for (§Disposition): #200, #203 (the **ledger grammar law**, now in `CONTEXT.md` + `ledger.ts` + a test), #204, and finding 4 parked to multiregion as **#322** rather than left inside a HIST note. |

## Grill briefs — scenarios for grills not yet held

A grill brief hands the *questions*, the locked rails, and the known traps; the owner
answers at the table. All four were written at the 2026-07-16 fantasy-roadmap grill for
whichever orchestrator leads the M4+ grills. **All LIVE by definition** — a brief goes
HIST when its grill happens.

| Note | Status | What it says |
| --- | --- | --- |
| [grill-brief-m4-workbench](grill-brief-m4-workbench.md) | **LIVE** | M4 Clusters A+B: how the Price board becomes the game's control center (route planning, dispatch, reading in one surface) and what the region map keeps. |
| [grill-brief-m4-events-and-ice](grill-brief-m4-events-and-ice.md) | **LIVE** | M4: the region's first weather — economic events as *Głos Eteru* dispatches — plus the concrete market model of Aether ice. Locked rail: level-1 events disturb production/consumption only. |
| [grill-brief-m5-great-work](grill-brief-m5-great-work.md) | **LIVE** | M5 The Expedition — **the big one**, budget a full session. Commissioning flow, construction at Great Work scale, contract integration, pacing to credits. Run only after Processing has shipped and been playtested. |
| [grill-brief-m6-zoom-out](grill-brief-m6-zoom-out.md) | **LIVE** | M6 first zoom-out: recursion architecture, administrator mechanic, second region, long crossings. **Its first question is architectural and hard to reverse** — grill after M5 is specced. |

## Roadmap & vision grills

| Note | Status | What it says |
| --- | --- | --- |
| [fantasy-roadmap-grill-2026-07-16](fantasy-roadmap-grill-2026-07-16.md) | **LIVE** | Turned the 1.0 fantasy into an executable roadmap for a post-frontier-access orchestrator. Locked shape: no parallel roadmap doc — the PRD stays canon, deepened in place, with a grill brief attached to every `design-frontier` item. Source of the four briefs above and of the roadmap's procedural/design-frontier labels. |
| [farewell-roadmap-grill-2026-07-15](farewell-roadmap-grill-2026-07-15.md) | HIST | The preceding session: durable roadmap locks made against the possibility of frontier access lapsing, vendor-agnostic by design. Superseded in practice by the 07-16 grill, which executed on it. |

## Parking lots & standing principles

| Note | Status | What it says |
| --- | --- | --- |
| [automation-observable-idle-state](automation-observable-idle-state.md) | **LIVE** | Standing design principle from E9: any automated actor must present an observable idle state at a tick boundary, so the player can intervene. An actor only ever mid-action between boundaries is uninterruptible by construction. |
| [route-conditionals](route-conditionals.md) | **LIVE** | Owner's ask for conditional Stop orders ("hold the sale until \<condition\>"), raised at the M3/E3 grill. **Parked — do not implement**; needs its own grill. Sharpened by standing contract obligations making *when* a loop realizes margin a real decision. |
| [e8-followups](e8-followups.md) | **LIVE** | Parking lot from E8 implementation. Headline item: peripheral starvation of remote sole-producer goods, surfaced by the #60 invariant suite on 3 of 4 seeds. |
| [trade-loop-followups](trade-loop-followups.md) | HIST | E2 playtest parking lot; **all items shipped as of 2026-07-08** (see the spec's implementation-status table). Kept as the worked example of the parking-lot → grill → issues path. |
| [icon-implementation-handoff](icon-implementation-handoff.md) | HIST | Pre-decision handoff for icon strategy; **resolved 2026-07-07** — locked in the E10 spec and ADR-0006 (game-world entities get vendored monochrome SVG with `currentColor`, UI chrome stays Unicode, gold = Controlled Ship). |

## Grill records — decisions already made

| Note | Status | What it says |
| --- | --- | --- |
| [goods-store-grill-2026-07-19](goods-store-grill-2026-07-19.md) | **LIVE** | Opened as the E13 grill, closed with a new sub-epic (E13.0), [ADR-0008](../adr/0008-one-goods-store.md) and an invalidated HANDOFF queue. Reopened the same day's site-registry lock at the owner's request: the registry guarded the wrong shape (collections vs singletons) and its E15 trigger was **void** (plants are a collection). Every place goods can sit becomes one encapsulated **Goods store**; F7 dissolves because addressing turns constitutive. Read for the reasoning chain, the two driver claims the Engineer corrected, and the lesson: **deduplicating an engine without naming the concept leaves the debt.** |
| [market-impact-second-ship-2026-07-14](market-impact-second-ship-2026-07-14.md) | HIST | The #152 payback outlier (~175 days on seed 1 vs ~40–60 elsewhere). Resolved by owner grill with **no engine change** — spec, CONTEXT.md and the guardrail moved instead. Read before touching economics guardrails: the seed-sensitivity is understood, not a bug. Related open issue: #115. |
| [e3-spec-refresh-grill-2026-07-14](e3-spec-refresh-grill-2026-07-14.md) | HIST | Re-verified the approved E3 spec against the then-current `src/sim` before implementing, folding in two Professor findings. The worked example of "check the spec is still true before building from it". |
| [e3-ui-grill-2026-07-14](e3-ui-grill-2026-07-14.md) | HIST | E3 UI locks (#96/#97), forced by Professor findings + playtest cluster B. Key decision: the Ledger is the event source, replacing the spec's phantom "toast pattern" — a new `settlement` Ledger kind rather than an ephemeral notice. |
| [founding-progress-bar-2026-07-14](founding-progress-bar-2026-07-14.md) | HIST | Grill of #134: the idea split into a visible founding savings goal (shipped as #157) and a parked company-investment-policy hook (#134 stays parked for real multiregion). |
| [pause-cause-note-2026-07-14](pause-cause-note-2026-07-14.md) | HIST | Grill of #130. Outcome: **no hint system exists** — it would violate the E9 law that mechanics arrive with buildings, not tutorials. Reframed to a single pause-cause legibility fix. |
| [route-events-2026-07-14](route-events-2026-07-14.md) | HIST | Grill of #131: split into three layers with different fates — ambient skiffs shipped now (#161), opt-in encounter offers parked to post-E3 (#131), intrusive events parked to multiregion. |

## Playtests

Owner playtests, analysed under the Analyst gate (every observation verified against
code before classification). All HIST — each one's routing was actioned in its own
session; they are kept as the evidence trail behind design decisions.

| Note | Status | What it says |
| --- | --- | --- |
| [playtest-2026-07-15-contractor](playtest-2026-07-15-contractor.md) | HIST | First field run of E3 (~125 days, seed `contractor`). Headline: rank/tier progression deadlock — two observations that turned out to be one structural finding, confirmed in code and routed to a grill as top priority. |
| [playtest-2026-07-14-routes-fleet-ux](playtest-2026-07-14-routes-fleet-ux.md) | HIST | Multi-ship route-driven mid-game: routes, fleet visibility, price-board UX. Cluster B here forced the E3 UI grill. |
| [playtest-2026-07-14-pricebar-shipinfo](playtest-2026-07-14-pricebar-shipinfo.md) | HIST | Random-seed run at day 89. Notable: the auto-pause note changing TopBar height, verified in `TopBar.tsx` and filed (#195 guards it today). |
| [playtest-2026-07-12-fresh-eyes-kacper](playtest-2026-07-12-fresh-eyes-kacper.md) | HIST | **First outside player** (the owner's brother; no exposure to specs, grills or the glossary), no prompting during play. The single most decision-dense playtest — first ever exercise of the Headquarters UI, and the source of the "map needs more life" signal behind the route-events split. Raw log: [playtest-Kacper-seed-watermelon](playtest-Kacper-seed-watermelon.md). |
| [playtest-Kacper-seed-watermelon](playtest-Kacper-seed-watermelon.md) | HIST | The raw player log, verbatim and in Polish — a deliberate exception to the English-docs rule, because it is source material. Analysis lives in the note above. |
| [playtest-2026-07-12-goodbye-fable](playtest-2026-07-12-goodbye-fable.md) | HIST | Verification of the shipped Ledger + Fleet list on the post-E9-sim build. Scope caveat: E9's Headquarters/routes had no UI yet, so founding and Route assignment weren't exercisable. |
| [playtest-2026-07-09-living](playtest-2026-07-09-living.md) | HIST | E8 verification run. All three target degeneracies confirmed dead **by feel, not just by test** — the note to read if you want to know what "the economy works" meant in practice. |
| [playtest-2026-07-08-orb](playtest-2026-07-08-orb.md) | HIST | Ten observations; five UI-polish items shipped in PR #55, economy items became E8 grill inputs, keybinds became #56. |
| [playtest-2026-07-07-orrery-baseline](playtest-2026-07-07-orrery-baseline.md) | HIST | Evening run right after the orbit-ring placement and SVG icon set merged; triaged inline the same session. |
| [playtest-2026-07-07-market-legibility](playtest-2026-07-07-market-legibility.md) | HIST | The v1-dissatisfaction playtest that produced the v2 direction — grilled the same day into the PRD's M2 (Living Region: E8, E9, E10). The origin point of the current shape of the game. |
