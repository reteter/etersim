# etersim — Product Requirements Document

Living document. Owner: Jakub. Terms per [CONTEXT.md](../CONTEXT.md). Last updated: 2026-07-15.

## Vision

You are the founder of a trading company in a world where 19th-century science charted the aether — the ocean between worlds — and magic is simply another force of nature and another line in a ledger. Buy low, sail the lanes, sell high, and grow from a single leaky ship into a trading power the guilds must reckon with. The world's economy lives and moves whether you act or not.

And when the region is finally yours, the lens recedes: the map you mastered becomes a single node of a larger one, and you begin again — one level up (§Long-term fantasy).

## Player fantasy

Trade magnate: building a growing enterprise through routes, margins and timing — not through combat or reflexes.

## Pillars

1. **Living economy** — prices emerge from simulated stock, production and consumption at ports; the player is a participant, not the center.
2. **The joy of optimization** — the core reward is finding and tuning profitable routes; depth comes from the market, not from micromanagement.
3. **Aether-punk identity** — Victorian science plus open magic; arcane goods trade on the same markets as grain (no separate magic system).
4. **Readable depth** — a complex economy presented through legible panels; if the player can't see why a price moved, the feature is unfinished.

## Core loop

Buy goods at a port → assign ship a route → time passes in ticks, the world simulates → sell at a better market → reinvest in ships and upgrades → scale toward an empire.

## Long-term fantasy — the receding lens

Locked with the owner at the farewell-roadmap grill (2026-07-15,
[design-notes/farewell-roadmap-grill-2026-07-15.md](design-notes/farewell-roadmap-grill-2026-07-15.md)).
This section is the roadmap's vanishing point: everything past 1.0 is vision, not
promise — each level enters a version only through its own grill (WORKFLOW.md).

### The Lens ladder

Four self-similar levels. At each step the previous level's whole map becomes a single
tradable node of the next, the player's current job is taken over by a delegate
mechanic (delegation is progression, never forced — manual play always remains), and
the new level arrives with its own mechanics:

| Level | Its "port" | The player delegates to | Entry mechanics |
| --- | --- | --- | --- |
| **Region** | port | routes, fleet | buildings, contracts, guilds |
| **Multiregion** | region | region administrators | tariffs, politics (guilds writ large), region-wide buildings, buildings that create new goods |
| **Galaxy** | star system / region cluster | governors, inter-galactic policies | open-aether crossings, encounters (pirates, free traders), new civilizations |
| **The Unknown** | galaxy | (everything below) | ancient artifacts, exploration, the multi-galactic super-project |

The endgame asks the player the game's own question: **"Why is it so?"** — trade
stops being only about profit and becomes the engine of finding out.

### Ladder laws

- **Law of the receding lens** — mastery is rewarded with delegation; the mastered
  map becomes a node of the next. This generalizes the E9 grill's "orchestration is
  progression, not a replacement" and the M2 v2 statement.
- **Law of the Great Work** — every level ends with a
  [Great Work](../CONTEXT.md): a super-construction commissioned by that level's
  institutions (Region: the Guilds via Contracts; Multiregion: regional politics; …),
  consuming streams of many goods through the generalized Build Order machinery.
  Completing it opens the next level.
- **Events gradient** — hazards scale with the lens. In-region: economic disturbances
  only (flow shocks, bounty/blight — never a threat to ships). Inter-region crossings:
  travel hazards (aether storms, currents). Open aether (galaxy level): full wilderness —
  pirates and free traders as opt-in encounters (#131's hooks; ADR-0004's "no direct
  combat" stands at every level), new civilizations. The old E6 draft dissolves into
  this gradient.
- **Arcana split** — the region gets **one** arcane good with genuinely distinct
  market behavior (the taste of weirdness, and the test of the machinery); full arcana
  debuts as the economic fuel of the Multiregion level — goods created by buildings,
  worth moving *between* regions. Aether currents ride the long crossings. The old E5
  draft dissolves into these two installments.

### Where 1.0 ends

**1.0 = a mature single region + the first recession of the lens as the finale.** The
Region's Great Work (working name: the Expedition), commissioned by the guilds,
completes → the second region opens, the first administrator appears → credits roll.
The zoom-out moment *is* the ending — and the cliffhanger. Multiregion proper, galaxy
and the Unknown are post-1.0 expansions.

### Flagged open question (design-frontier)

Does the Multiregion level **re-instantiate the region sim** (a region becomes a node
in a higher-order graph running the same abstract machinery — fractal in code, not
just in design)? Not decided today; this is the first question of the multiregion
grill, and the answer is hard to reverse. Nothing before M6 depends on it.

## Scope

**In scope (1.0):** one mature region (simulated per-port markets, company with ships
and routes, time controls, save/load, contracts and guilds, one arcane good, economic
events) plus the first zoom-out finale: the Great Work, the second region opening and
the first administrator (§Long-term fantasy). Multiregion proper and everything above
it on the Lens ladder is post-1.0.

**Out of scope (hard no, see ADR-0004):** multiplayer, backend/accounts, mobile, Steam/desktop packaging, 3D, direct combat (piracy may exist only as an abstract voyage hazard).

## Milestones & epics

Milestones group epics. Every epic starts with a grilling session and an approved feature spec (docs/WORKFLOW.md). M1 and M2 are shipped (E8/E9/E10 all in). Of M3, E12 and E3 are shipped; **E13 is the next implementation work**. Epics beyond M3 are drafts and will be re-grilled before work starts.

**Roadmap labels** (2026-07-15, model-agnostic casting — WORKFLOW.md §Roles): every
item below carries one of two labels. **`procedural`** — an approved spec exists and
the machinery is established; any competent executor tier implements it under the
standing gates. **`design-frontier`** — it designs new mechanics and requires an
owner-led grill before any implementation. The label's job is to make the boundary
visible: an orchestrator must *notice* when work crosses from execution into design.

**Milestone playtest law** (2026-07-15): no milestone closes on green metrics alone —
the harness screens balance so the owner's playtest can judge *fun*; an owner playtest
is part of every milestone's close.

### M1 — Trade Loop (prove the core is fun)

- **E1 Foundation**: app scaffold, CI, tick engine with seeded RNG, world model skeleton. Spec: ADRs 0001–0004.
- **E2 Trade Loop**: worldgen (5–6 ports), market simulation, ship travel over lanes, map view + market panel + ship panel, time controls, save/load. No magic, no contracts, no fleet. **Shipped** — baseline (#10–#17) plus all playtest follow-ups (#28, #32, #33, #35, #36, #37); #25/#34 re-scoped into E10.

**M1 success criteria:**
- Same seed + same commands ⇒ identical world (asserted by test).
- Save/load round-trips full world state.
- Owner check: a 20+ minute session where price differences and route choice keep mattering.

### M2 — Living Region (v2)

Locked with the owner 2026-07-07 (grill inputs:
[playtest-2026-07-07-market-legibility.md](design-notes/playtest-2026-07-07-market-legibility.md)).

**v2 statement:** a living, self-balancing region as the substrate the game runs on; the
player grows from hands-on trading (the v1 loop, which stays) into orchestration — a small
fleet on player-defined looping routes, observed through a region-wide economic view.
Orchestration is progression, not a replacement for manual trade.

- **E8 Living economy**: price-elastic production/consumption (soft saturation);
  per-archetype price bias + per-port jitter (structural price gradients — playtest-orb
  requirement); bid-ask spread on quotes (anti-scalp friction, first money sink —
  playtest-orb requirement); trade osmosis along lanes (deadband, lane-length attenuation,
  per-tick cap) rendered as small ambient pulses (visual layer derived from flows — no
  agent sim); stochastic drift of *flows* (daily mean-reverting multiplier — the original
  "drift of equilibria" draft was corrected in the grill: flow drift creates visible
  disequilibria, equilibrium drift silently moves price anchors); region-wide price board
  with full live prices (no information fog). Kills the "wait at the producer's price
  floor" dominant strategy found in the M1 playtest. Spec:
  [specs/E8-living-economy.md](specs/E8-living-economy.md) (approved 2026-07-08). Shipped
  (#57, #58, #59, #60, #61, #62, #63).
- **E9 Fleet & routes** (absorbs draft E4 — number retired): fleet-lite reached through
  **construction, not purchase** (the 2026-07-09 grill superseded the earlier "buy
  additional identical hulls / ship purchase is v2's money sink" wording): founding a
  Headquarters building unlocks the orchestration layer — Company-level Route templates
  (looping Stops with buy/sell/deliver orders, assigned to ships by reference,
  suspend/resume) and ship construction fed by the living market (auto-draw from the
  local market, player deliveries, market-priced rush; the recipe topped by a living-wood
  keel). Docking fees are the recurring money sink; the Ledger event stream plus an
  in-game performance board share one schema with the E11 harness. No wait or price
  conditionals — routes decay as the living market tightens spreads, and noticing and
  re-planning them *is* the game. Design law locked at the grill: **buildings introduce
  mechanics** — each new gameplay layer arrives with a building, not a tutorial (applies
  forward to M3 upgrades and multi-region branch offices). Depends on E8 and the #28
  Controlled Ship model. Spec:
  [specs/E9-fleet-and-routes.md](specs/E9-fleet-and-routes.md) (approved 2026-07-09).
- **E10 Orrery view**: the region presented as a planetary system — ports on static orbit
  rings around a central star (set dressing, no mechanics); lanes subtle by default,
  accented when a port is selected; tintable monochrome icon set (#34; game-icons.net is
  the lead candidate); #25 geometry-aware lane topology lands here, on top of the orbital
  placement. Spec: [specs/E10-orrery-view.md](specs/E10-orrery-view.md) (approved
  2026-07-07); runs before E8/E9 so the new geometry sits under their playtests. Shipped
  (#43, #25, #34, #44, #45).

**M2 success criteria:**
- Autonomy: 30 player-idle world days ⇒ no good at any port stays pinned at the price
  floor/ceiling beyond a short window; prices keep oscillating (asserted by test).
  Owner-decided exception (2026-07-08,
  [design-notes/e8-followups.md §1](design-notes/e8-followups.md)): for a good with a
  single net-producer, ports more than one lane-hop from that producer may pin at the
  ceiling — a durable gradient by design, not a failure; revisit only if a playtest shows
  the pinned rim feels dead.
- Determinism extends to routes: same seed + same routes ⇒ identical world (asserted by test).
- Save/load round-trips fleet and routes.
- Owner check: set up 2–3 routes, then 15+ minutes of mostly watching plus occasional
  re-planning stays interesting; the v1 wait-at-the-floor tactic is no longer clearly optimal.

**Parked hooks (deliberately out of v2):** ship upkeep / crew wages (E9's docking fee
ships the first running-cost slice; ship upkeep is spec'd in E3 — approved 2026-07-09;
crew wages stay parked);
wait-until-full route orders; build queue, shipyard assembly time and Headquarters
relocation (E9 grill); real orbital motion (long-crossings candidate, M6+ — aether
currents over a moving system; formerly "E5 candidate"); information fog on remote
prices (Events-gradient candidate, post-1.0 — events can cut the telegraph; formerly
"E6 candidate"); region/port upgrades and upgrade-gated multi-region views; map-drawn
route editing (E9 ships a list editor).

### Tooling track (parallel to milestones)

- **E11 Proving grounds**: headless evaluation harness — an agent (or the owner's
  Analyst session) tests builds by authoring deterministic policies, running seed
  batches, reading aggregated telemetry (Ledger), and hunting bugs with adversarial
  strategies; experiment conclusions land in `docs/experiments/`. Spec:
  [specs/E11-proving-grounds.md](specs/E11-proving-grounds.md) — re-reviewed against
  E9/E12/E3 and **v1 approved 2026-07-15**: Batch core + `harness run` CLI
  (`play`/`replay` deferred to v2). Absorbs #202 (multi-seed sweeps; that grill
  happened at the farewell-roadmap session) and #115 (seed-sensitive guardrail →
  distribution assertion). `procedural`. **Owner directive (2026-07-15): the sim is
  becoming the only viable way to balance the game — E11 v1 runs before M4**, because
  M4's tuning (events, an arcane good) depends on it, and because the harness is what
  keeps the scarce owner playtests spent on fun, not on solvency checks.

### M3 — Guilds & obligations

Locked with the owner at the M3 grill (2026-07-09). Runs after E9 ships (M2 closes).

**v3 statement:** the region gains faces — guilds, NPC institutions with addresses and
demands, offer **continuous** freight contracts that put deliberate obligations on the
Company; reputation becomes the long-term currency (loss-leader contracts are
investments), and ship upkeep turns the game of margins into a game of cash flow.
Guilds are institutions, not agents: they own no ships and read the same living economy
the player reads.

- **E12 Region v2**: HEARTLAND v2 — port count raised to 7–9 (`portCountRange` is
  template data; no ADR freezes it), sixth archetype **Free port** (exactly one per
  region: no dominant flows, price bias ~1.0, no guild seat — the region's neutral
  ground), orrery ring-packing recalibration (`orbitRadiusRange`/`MIN_PORT_DISTANCE` —
  the E10 spec's anticipated owner decision), E8/E9 calibration tests re-anchored to the
  new template. Runs first — the E10 precedent: geometry lands under the playtests that
  follow it. Spec: [specs/E12-region-v2.md](specs/E12-region-v2.md) (approved 2026-07-09).
  **Shipped.**
- **E3 Contracts & guilds**: five per-archetype guilds with guildhouses at their ports;
  enrollment (one-time fee, requires a founded Headquarters, grants rank 1 of 4);
  continuous contracts — *keep delivering* ≥ quota per settlement period for ≥ K
  periods — generated deterministically from real shortages and sized from real
  geometry (feasible by construction, basis shown on the offer); flat fee per met
  period (the market pays for goods, the guild pays for reliability); breach after two
  consecutive missed periods, resignation always possible at the same reputation-only
  cost (no thaler penalties, no-debt precedent); contract board as a PriceBoardOverlay
  tab; **ship upkeep** as the daily per-ship fixed cost — the parked hook lands now
  because its stated precondition (legible costs) shipped with the E9 Ledger. Spec:
  [specs/E3-contracts-and-guilds.md](specs/E3-contracts-and-guilds.md) (approved 2026-07-09).
  **Shipped**, including the post-playtest Desperation clause (#226).
- **E13 Guild buildings**: rank-gated **building permits** (reputation buys mechanics,
  not percentages); the E9 construction machinery generalized to building types; one
  flagship — the **Granary** (agrarian Storehouse variant, stores grain) with
  store/withdraw Route orders. Storage opens arbitrage over time, bounded by capacity,
  spread and the marginal walk. Buildable at the guild's archetype ports and the Free
  port only. Spec: [specs/E13-guild-buildings.md](specs/E13-guild-buildings.md) (approved 2026-07-09).
  `procedural` — next implementation work.

- **E14 Shipyard & Refit** (post-M3 pull-forward, owner call 2026-07-16): the Company's
  second Building — one **Shipyard** per Company, commissioned after the Headquarters —
  where a docked ship undergoes a **Refit**: a mini Build Order raising its Hold along a
  fixed multiplier ladder over `baseHold` (×2 → ×1.5 → ×1.25, hard cap). Adopts #99
  (construction-site generalization) as its first issue; `baseHold` is the anchor for
  future ship types. Spec: [specs/E14-shipyard-and-refit.md](specs/E14-shipyard-and-refit.md) (draft).

**M3 success criteria:**
- Determinism extends to guilds: same seed + same commands ⇒ identical world including
  contract offers, ranks and Ledger (asserted by test).
- Offer feasibility invariant: every generated offer is satisfiable by a single ship at
  the basis stated on the offer, with slack (asserted by test).
- Save/load round-trips enrollment, ranks, active contracts and storehouse stock.
- No-dominance guardrails: buy-store-sell does not beat carry trade on the standard
  seed; a scripted loss-leader strategy reaches rank 2 while staying solvent (asserted
  by test).
- Owner check: taking a slightly unprofitable contract for rank feels like a good
  decision; "guild port vs Free port" is a real dilemma when siting the Headquarters or
  a Storehouse; upkeep reads as a fair cost, not an unexplained penalty.

**Parked hooks (deliberately out of M3):** route order conditionals ("hold the sale
until…" — [design-notes/route-conditionals.md](design-notes/route-conditionals.md),
touches the E9 route-rot law, needs its own grill); the remaining four Storehouse
variants; recurring guild dues (rejected at the grill: they double-tax the loss-leader
relationship); crew wages (the rest of "Company running costs"); ship upgrades
(Horizon).

### M4 — Region mastery (draft; replaces the old "M4 Arcana")

The region at its deepest before the lens moves: the orchestration layer gets its
quality-of-life ceiling, the economy gets its first weather, and the world gets its
first taste of the arcane. Every epic here is `design-frontier` (owner grill first);
implementation after each spec is `procedural`. The old E5/E6 drafts are dissolved
per §Long-term fantasy (epic numbers retired; see the Arcana split and Events
gradient laws).

- **Cluster A — route automation**: quality-of-life for the orchestration layer
  (grill pending; parked inputs live in the cluster's design notes and issues).
- **Cluster B — economic surface**: ship dispatch from the Price Board, the offer
  label system (#227), the board as the permanent post-HQ workbench. (The harness
  part of this cluster was grilled and unparked into E11 v1 on 2026-07-15.)
- **Economic events** (Events gradient, level 1): flow shocks, bounty/blight —
  disturbances of production/consumption, never threats to ships. Builds on E8's
  flow-drift machinery; balanced with the E11 harness.
- **First arcane good** (Arcana split, installment 1): one good with genuinely
  distinct market behavior — the taste of weirdness and the proving ground for the
  machinery that full arcana (M6+) will reuse.

### M5 — The Great Work (draft; absorbs the old "M5 Arc"/E7 for 1.0)

The arc that ends 1.0: rank culmination → the Guilds jointly commission the Region's
[Great Work](../CONTEXT.md) (working name: the Expedition) — a super-construction
consuming streams of many goods at once, generalizing the Build Order machinery
(the same generalization path E13 starts). Completion triggers the first recession
of the lens. `design-frontier` (the Great Work grill is the big one: commissioning
flow, contract integration, pacing).

### M6 — First zoom-out (draft; 1.0 ships when M4–M6 close)

What lies behind the credits: the second region opens, the first **administrator**
takes over the mastered region (delegation stays optional), long inter-region
crossings arrive with aether currents and travel hazards (Events gradient, level 2),
and arcana debuts as inter-region fuel (Arcana split, installment 2). Carried hooks
from the E9 grill (2026-07-09, formerly the Horizon multi-region entry): per-region
**branch offices** unlock the buildings mechanic in a new region; the paid
administrator shifts gameplay from managing a region to managing *between* regions.
`design-frontier` — and it opens with the flagged recursion question
(§Long-term fantasy): whether a region becomes a node of a re-instantiated sim.

### Post-1.0 (vision, not promise)

Multiregion proper (tariffs, politics, region-wide buildings) → Galaxy (open-aether
wilderness, encounters, civilizations) → the Unknown (artifacts, the super-project,
*Why is it so?*) — per the Lens ladder. Each level gets its own grills when its time
comes.

## Horizon (unscheduled ideas)

Loose ideas with no milestone. Nothing here is a promise: an idea enters a version only
through a grill (WORKFLOW.md). One line per idea with its origin; curated — dead ideas
get deleted, the list stays short.

- **Region/port upgrades** — player investments in infrastructure; e.g. the region-wide economic view of a *foreign* region gated behind an upgrade. (Owner, [playtest note §8](design-notes/playtest-2026-07-07-market-legibility.md).)
- **Ship classes** — hull sizes, speeds, specializations; the rest of the original E4 draft beyond fleet-lite. (PRD draft, retired into E9 2026-07-07.)
- **Ship upgrades** — retrofitting an existing hull (e.g. hold expansion); distinct from ship classes: same ship, better parts. (Owner, M3 grill 2026-07-09; independently requested — with a progression rationale — by the first fresh-eyes playtester, [2026-07-12](design-notes/playtest-2026-07-12-fresh-eyes-kacper.md).)
- **Company running costs** — umbrella for ship upkeep and crew wages; docking fees shipped as the first slice (E9), ship upkeep unparked into E3 (M3 grill 2026-07-09); crew wages remain here. (Parked hook from the v2 grill.)
- **Opportunities board ("Okazje")** — surfaced high-margin route suggestions; the fleet switches onto a few hot loops at once (Route templates by reference are its foundation). (Owner, E9 grill 2026-07-09.)
- **Supplier ships** — automation of build deliveries: deliver-only routes the game plans itself. (Owner fantasy, E9 grill 2026-07-09; the deliver order is the hook. Independently invented by the first fresh-eyes playtester, [2026-07-12](design-notes/playtest-2026-07-12-fresh-eyes-kacper.md).)
- **Real orbital motion** — planets orbit over world time; ETAs depend on departure timing. (Parked 2026-07-07; long-crossings candidate, M6+ — formerly "E5 candidate".)
