# etersim — Product Requirements Document

Living document. Owner: Jakub. Terms per [CONTEXT.md](../CONTEXT.md). Last updated: 2026-07-09.

## Vision

You are the founder of a trading company in a world where 19th-century science charted the aether — the ocean between worlds — and magic is simply another force of nature and another line in a ledger. Buy low, sail the lanes, sell high, and grow from a single leaky ship into a trading power the guilds must reckon with. The world's economy lives and moves whether you act or not.

## Player fantasy

Trade magnate: building a growing enterprise through routes, margins and timing — not through combat or reflexes.

## Pillars

1. **Living economy** — prices emerge from simulated stock, production and consumption at ports; the player is a participant, not the center.
2. **The joy of optimization** — the core reward is finding and tuning profitable routes; depth comes from the market, not from micromanagement.
3. **Aether-punk identity** — Victorian science plus open magic; arcane goods trade on the same markets as grain (no separate magic system).
4. **Readable depth** — a complex economy presented through legible panels; if the player can't see why a price moved, the feature is unfinished.

## Core loop

Buy goods at a port → assign ship a route → time passes in ticks, the world simulates → sell at a better market → reinvest in ships and upgrades → scale toward an empire.

## Scope

**In scope (full product):** one region, simulated per-port markets, player company with ships and routes, time controls (pause/1x/10x/100x), save/load, arcane goods, contracts and guilds (later epics), events/hazards (later epics).

**Out of scope (hard no, see ADR-0004):** multiplayer, backend/accounts, mobile, Steam/desktop packaging, 3D, direct combat (piracy may exist only as an abstract voyage hazard).

## Milestones & epics

Milestones group epics. Every epic starts with a grilling session and an approved feature spec (docs/WORKFLOW.md). M2 goals are locked at milestone level (owner grill 2026-07-07); E10 is spec'd ([specs/E10-orrery-view.md](specs/E10-orrery-view.md), approved 2026-07-07) and shipped, E8 is spec'd ([specs/E8-living-economy.md](specs/E8-living-economy.md), approved 2026-07-08) and shipped (epic closed 2026-07-09), E9 still needs a per-epic spec. Epics beyond M2 are drafts and will be re-grilled before work starts.

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
ships the first running-cost slice; the rest waits for E3-era legibility);
wait-until-full route orders; build queue, shipyard assembly time and Headquarters
relocation (E9 grill); real orbital motion (E5 candidate — aether currents over a
moving system); information fog on remote prices (E6 candidate — events can cut the
telegraph); region/port upgrades and upgrade-gated multi-region views; map-drawn route
editing (E9 ships a list editor).

### Tooling track (parallel to milestones)

- **E11 Proving grounds**: headless evaluation harness — an agent tests builds by
  authoring deterministic policies, running seed batches, reading aggregated telemetry
  (Ledger), and hunting bugs with adversarial strategies; direct-play sessions log into
  replayable runs; experiment conclusions land in `docs/experiments/`. Spec:
  [specs/E11-proving-grounds.md](specs/E11-proving-grounds.md) (**draft**, grilled
  2026-07-09 — re-reviewed and approved only after E9 ships, by owner decision).

### M3 — Depth (draft)

- **E3 Contracts & guilds**: NPC organizations offering freight contracts (moved from the
  pre-v2 M2; natural home for the upkeep/money-sink hook).

### M4 — Arcana (draft)

- **E5 Arcane economy**: arcane goods with distinct market behavior, aether currents on lanes (candidate: real orbital motion from the M2 hook).
- **E6 Events & hazards**: aether storms, market shocks, abstract piracy (candidate: information fog from the M2 hook).

### M5 — Arc (draft)

- **E7 Progression & goals**: company milestones, scenario objectives, polish.

## Horizon (unscheduled ideas)

Loose ideas with no milestone. Nothing here is a promise: an idea enters a version only
through a grill (WORKFLOW.md). One line per idea with its origin; curated — dead ideas
get deleted, the list stays short.

- **Multi-region world** — travel between regions; regions as economic islands with gateways. Hooks from the E9 grill (2026-07-09): per-region **branch offices** unlock the buildings mechanic in a new region; a paid **region administrator** shifts gameplay from managing a region to managing *between* regions. (Owner, 2026-07-07 playtest.)
- **Region/port upgrades** — player investments in infrastructure; e.g. the region-wide economic view of a *foreign* region gated behind an upgrade. (Owner, [playtest note §8](design-notes/playtest-2026-07-07-market-legibility.md).)
- **Ship classes** — hull sizes, speeds, specializations; the rest of the original E4 draft beyond fleet-lite. (PRD draft, retired into E9 2026-07-07.)
- **Company running costs** — umbrella for ship upkeep and crew wages; docking fees shipped as the first slice (E9). (Parked hook from the v2 grill, partially unparked 2026-07-09.)
- **Opportunities board ("Okazje")** — surfaced high-margin route suggestions; the fleet switches onto a few hot loops at once (Route templates by reference are its foundation). (Owner, E9 grill 2026-07-09.)
- **Supplier ships** — automation of build deliveries: deliver-only routes the game plans itself. (Owner fantasy, E9 grill 2026-07-09; the deliver order is the hook.)
- **Real orbital motion** — planets orbit over world time; ETAs depend on departure timing. (E5 candidate, parked 2026-07-07.)
