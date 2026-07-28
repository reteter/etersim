# Design notes — index

One line per note: what it is, what it concluded, and whether it still steers work.
Read this table; open a note only when its line is relevant to what you're doing.
Same contract as [`docs/incidents/README.md`](../incidents/README.md) §Log.

**The line is a pointer, not a summary.** It carries enough to decide whether to open the
file — never the note's evidence, verdict detail or reasoning chain. A row that grows into a
paragraph turns the index into a second document to read (it did: rows reached ~2 900
characters before the 2026-07-28 trim).

**Status column:** **LIVE** = still steers work (parking lots with unshipped items, pending
grills, growing records). **HIST** = closed; kept for provenance, safe to skip unless you are
reconstructing why something is the way it is.

**Maintenance is part of creating the note** ([documentation.md](../workflows/documentation.md)):
whoever adds a file here adds its row in the same commit, and whoever closes out a note's last
open item flips it to HIST.

**A trigger is a promise, and promises live in the issue tracker.** Park the *reasoning* in a
note; park the *obligation* in an issue, and have the note point at it — `gh issue list` is
swept every session while HIST rows are explicitly safe to skip. **Before flipping a note to
HIST, ask whether the flip would hide an obligation; if it would, file it first.**

## Process, evaluation & tooling

| Note | Status | What it says |
| --- | --- | --- |
| [coder-scorecard](coder-scorecard.md) | **LIVE** | Per-PR quality metrics for coder-delivered work — the durable sample behind coder-model casting. Appended at every wave check close. |
| [tiered-verification-gates-2026-07-14](tiered-verification-gates-2026-07-14.md) | HIST | The #162 grill that replaced flat ceremony with the tier 1/2/3 table. Kept diagnosis: the defect was gates that were flat, not gates that were heavy. |
| [ab-286-shipyard-construction](ab-286-shipyard-construction.md) | HIST | First same-task coder pair (Opus vs Sonnet, `src/sim`). Established the cost metric: % of a session limit. |
| [ab-276-shipyard-ui](ab-276-shipyard-ui.md) | HIST | Second and final pair (UI-only). Series closed 2/2 → coder default = Sonnet, advisor = Opus. |
| [design-surface-sweep](design-surface-sweep.md) | HIST | Closed s16. The docs-vs-docs pass that read the project's documents against each other, because a contradiction between two idle documents has no diff to appear in. Carries the binding rules (HIST does not bind) and findings F1–F17. |
| [world-model-implications](world-model-implications.md) | **LIVE** | The standing register of statements that must be true if this world is what we say it is, each with its falsifier. Survey finding: structure is guarded, dynamics are not — the assertion content E11 still lacks. |
| [knowing-is-not-binding-2026-07-19](knowing-is-not-binding-2026-07-19.md) | **LIVE** | Standing principle from three s14 failures with one mechanism: **a system acts on what obliges it, not on what it knows.** What worked every time was a detector, never an insight. |
| [semantic-code-search-tooling](semantic-code-search-tooling.md) | **LIVE** | Why there is no vector search here (parked, tracked as #212). Holds the design sketch and the unpark trigger. |
| [markdown-normalizer-grill-2026-07-21](markdown-normalizer-grill-2026-07-21.md) | **LIVE** | Grill record for #341: clause-level line breaks, AST-based, enforced against an allowlist. Its segment-by-segment rollout is overridden by #384. |
| [eval-gpt-5.6-solo-driver-e13](eval-gpt-5.6-solo-driver-e13.md) | **LIVE** | Pre-registered eval-1: can the implementation loop be delegated to a solo non-Anthropic driver? Verdicts recorded below its FROZEN line — both arms CONDITIONAL, and the money finding is that **the win is the pipeline, not any solo**. |
| [delegation-eval-playbook](delegation-eval-playbook.md) | **LIVE** | The reusable *how* for a pre-registered paired delegation eval. Core rules: isolation has a cheap default (run arms before the reference merges), the ruler prompt is a byte-identical committed artifact, and the ruler measures while the Orchestrator adjudicates. |
| [eval-2-refactor-loop-319-320-321](eval-2-refactor-loop-319-320-321.md) | **LIVE** | Pre-registered eval-2 (#379): is eval-1's casting verdict invariant across task-shape? Answer: yes. Frontier solo ≈ pipeline; cheap solo NO-GO on a **fake refactor** that passed all four gates. Cheap-tier failure mode is task-shape-specific. |
| [e13-0-shrink-measurement-2026-07-21](e13-0-shrink-measurement-2026-07-21.md) | HIST | The measured HANDOFF bet "E13.0 should make #100 smaller" — **confirmed and retired** at E13 close: #100 arrived as wiring, not inventing. |
| [oq8-buildingStoreValue-grill-2026-07-21](oq8-buildingStoreValue-grill-2026-07-21.md) | HIST | Closes OQ8: a building's standing goods store gets a generic `buildingStoreValue` field so E15 reuses it without a second version bump. **Note the version: E15 uses v15, not the v14 its spec still names.** |
| [parked-item-audit-2026-07-21](parked-item-audit-2026-07-21.md) | HIST | Closes #326, the trigger-is-a-promise law's own pre-law backlog. Settles the standing rule: a grill tied to a named PRD milestone slot needs no issue; one without a slot does. |
| [nonmarket-order-authoring-grill-2026-07-28](nonmarket-order-authoring-grill-2026-07-28.md) | **LIVE** (until #393 ships) | Closes #404: `deliver`/`store`/`withdraw` are authored on the board via the "więcej" drawer, market-free cells inert to plain click. Shipped as #419. Transferable rule: **a UI rule derived from permanent state does not transfer to transient state unchanged.** |
| [s14-law-automation-decision-2026-07-21](s14-law-automation-decision-2026-07-21.md) | HIST | Decides #332: two of the four s14 laws get a standing detector, two are recorded as deliberately not automated. Implementation landed in PR #364. |

## Architecture reviews (the Professor)

| Note | Status | What it says |
| --- | --- | --- |
| [professor-construction-review](professor-construction-review.md) | **LIVE** | End-to-end construction review. Engine certified sound; F4 and F7 resolved by [ADR-0008](../adr/0008-one-goods-store.md). Still live for F5 and F6. |
| [professor-review-src-sim-2026-07-13](professor-review-src-sim-2026-07-13.md) | HIST | First `src/sim` review. Verdict: honestly built — purity holds, one seeded stream, manual/routed equivalence enforced by construction. |
| [professor-review-ui-store-2026-07-14](professor-review-ui-store-2026-07-14.md) | HIST | UI + store bridge review: a UI born single-ship that grew a fleet underneath it. Its three parked findings became #319/#320/#321 — read §Parked findings unparked for what the parking cost. |
| [professor-review-sim-guilds-contracts-2026-07-14](professor-review-sim-guilds-contracts-2026-07-14.md) | HIST | E3-close review of guilds/contracts/settlement. Four findings, all accounted for; source of the **ledger grammar law**. |

## Grill briefs — scenarios for grills not yet held

A brief hands the *questions*, the locked rails and the known traps; the owner answers at the
table. A brief goes HIST when its grill happens.

| Note | Status | What it says |
| --- | --- | --- |
| [grill-brief-m4-workbench](grill-brief-m4-workbench.md) | HIST | M4 clusters A+B: the Price board as the game's control center. Grilled 2026-07-22 → [E16 — Workbench](../specs/E16-workbench.md). |
| [grill-brief-m4-events-and-ice](grill-brief-m4-events-and-ice.md) | **LIVE** | M4: economic events as *Głos Eteru* dispatches, plus the market model of Aether ice. Locked rail: level-1 events disturb production/consumption only. |
| [grill-brief-m5-great-work](grill-brief-m5-great-work.md) | **LIVE** | M5 The Expedition — budget a full session. Run only after Processing has shipped and been playtested. |
| [grill-brief-m6-zoom-out](grill-brief-m6-zoom-out.md) | **LIVE** | M6 first zoom-out: recursion architecture, administrator mechanic, second region. **Its first question is architectural and hard to reverse** — grill after M5 is specced. |

## Roadmap & vision grills

| Note | Status | What it says |
| --- | --- | --- |
| [fantasy-roadmap-grill-2026-07-16](fantasy-roadmap-grill-2026-07-16.md) | **LIVE** | Turned the 1.0 fantasy into an executable roadmap. Locked: no parallel roadmap doc — the PRD stays canon. Source of the four briefs above and of the `procedural`/`design-frontier` labels. |
| [farewell-roadmap-grill-2026-07-15](farewell-roadmap-grill-2026-07-15.md) | HIST | Durable roadmap locks made against a possible frontier-access lapse. Superseded in practice by the 07-16 grill. |

## Parking lots & standing principles

| Note | Status | What it says |
| --- | --- | --- |
| [automation-observable-idle-state](automation-observable-idle-state.md) | **LIVE** | Standing principle from E9: any automated actor must present an observable idle state at a tick boundary, or it is uninterruptible by construction. |
| [route-conditionals](route-conditionals.md) | **LIVE** | Owner's ask for conditional Stop orders. **Parked — do not implement**; needs its own grill. |
| [e8-followups](e8-followups.md) | **LIVE** | E8 parking lot. Headline: peripheral starvation of remote sole-producer goods (3 of 4 seeds). |
| [trade-loop-followups](trade-loop-followups.md) | HIST | E2 playtest parking lot, all items shipped. Kept as the worked example of the parking-lot → grill → issues path. |
| [icon-implementation-handoff](icon-implementation-handoff.md) | HIST | Pre-decision handoff for icon strategy; resolved into the E10 spec and ADR-0006. |

## Grill records — decisions already made

| Note | Status | What it says |
| --- | --- | --- |
| [goods-store-grill-2026-07-19](goods-store-grill-2026-07-19.md) | **LIVE** | Opened as the E13 grill, closed with sub-epic E13.0 and [ADR-0008](../adr/0008-one-goods-store.md): every place goods can sit becomes one encapsulated Goods store. Lesson: **deduplicating an engine without naming the concept leaves the debt.** |
| [market-impact-second-ship-2026-07-14](market-impact-second-ship-2026-07-14.md) | HIST | The #152 payback outlier, resolved with **no engine change**. Read before touching economics guardrails: the seed-sensitivity is understood, not a bug. |
| [e3-spec-refresh-grill-2026-07-14](e3-spec-refresh-grill-2026-07-14.md) | HIST | Re-verified an approved spec against the code before implementing. The worked example of "check the spec is still true before building from it". |
| [e3-ui-grill-2026-07-14](e3-ui-grill-2026-07-14.md) | HIST | E3 UI locks. Key decision: the Ledger is the event source, replacing the spec's phantom "toast pattern". |
| [founding-progress-bar-2026-07-14](founding-progress-bar-2026-07-14.md) | HIST | Grill of #134: split into a shipped founding savings goal (#157) and a parked company-investment hook. |
| [pause-cause-note-2026-07-14](pause-cause-note-2026-07-14.md) | HIST | Grill of #130. Outcome: **no hint system exists** — it would violate the law that mechanics arrive with buildings, not tutorials. |
| [route-events-2026-07-14](route-events-2026-07-14.md) | HIST | Grill of #131, split into three layers: ambient skiffs shipped, encounter offers parked (#131), intrusive events parked to multiregion. |
| [route-automation-grill-2026-07-21](route-automation-grill-2026-07-21.md) | HIST | Grill of #357: conditional Stops rejected (reaffirms the E9 frozen-bet lock), auto-sell-at-best out of scope. The playtest signal was a legibility gap, not an automation gap. |

## Playtests

Owner playtests, analysed under the Analyst gate (every observation verified against code
before classification). All HIST — each one's routing was actioned in its own session; kept as
the evidence trail behind design decisions.

| Note | Status | What it says |
| --- | --- | --- |
| [playtest-2026-07-15-contractor](playtest-2026-07-15-contractor.md) | HIST | First field run of E3. Headline: rank/tier progression deadlock — two observations that were one structural finding. |
| [playtest-2026-07-14-routes-fleet-ux](playtest-2026-07-14-routes-fleet-ux.md) | HIST | Multi-ship route-driven mid-game. Its cluster B forced the E3 UI grill. |
| [playtest-2026-07-14-pricebar-shipinfo](playtest-2026-07-14-pricebar-shipinfo.md) | HIST | Random-seed run at day 89; the auto-pause note changing TopBar height (#195 guards it today). |
| [playtest-2026-07-12-fresh-eyes-kacper](playtest-2026-07-12-fresh-eyes-kacper.md) | HIST | **First outside player**, no exposure to specs or glossary. The most decision-dense playtest; source of the "map needs more life" signal. |
| [playtest-Kacper-seed-watermelon](playtest-Kacper-seed-watermelon.md) | HIST | The raw player log, verbatim and in Polish — a deliberate exception to the English-docs rule, because it is source material. |
| [playtest-2026-07-12-goodbye-fable](playtest-2026-07-12-goodbye-fable.md) | HIST | Verification of the shipped Ledger + Fleet list. Caveat: E9's Headquarters/routes had no UI yet. |
| [playtest-2026-07-09-living](playtest-2026-07-09-living.md) | HIST | E8 verification. All three target degeneracies confirmed dead **by feel, not just by test** — read it for what "the economy works" meant in practice. |
| [playtest-2026-07-08-orb](playtest-2026-07-08-orb.md) | HIST | Ten observations; UI polish shipped in PR #55, economy items became E8 grill inputs. |
| [playtest-2026-07-07-orrery-baseline](playtest-2026-07-07-orrery-baseline.md) | HIST | Evening run after the orbit-ring placement and SVG icons merged; triaged inline. |
| [playtest-2026-07-07-market-legibility](playtest-2026-07-07-market-legibility.md) | HIST | The v1-dissatisfaction playtest that produced the v2 direction. The origin point of the current shape of the game. |
