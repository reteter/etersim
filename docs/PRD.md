# etersim — Product Requirements Document

Living document. Owner: Jakub. Terms per [CONTEXT.md](../CONTEXT.md). Last updated: 2026-07-04.

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

**In v1:** one region, simulated per-port markets, player company with ships and routes, time controls (pause/1x/10x/100x), save/load, arcane goods, contracts and guilds (later epics), events/hazards (later epics).

**Out of v1 (hard no, see ADR-0004):** multiplayer, backend/accounts, mobile, Steam/desktop packaging, 3D, direct combat (piracy may exist only as an abstract voyage hazard).

## Milestones & epics

Milestones group epics. Every epic starts with a grilling session and an approved feature spec (docs/WORKFLOW.md); epics beyond M1 are drafts and will be re-grilled before work starts.

### M1 — Trade Loop (prove the core is fun)

- **E1 Foundation**: app scaffold, CI, tick engine with seeded RNG, world model skeleton. Spec: ADRs 0001–0004.
- **E2 Trade Loop**: worldgen (4–6 ports), market simulation, ship travel over lanes, map view + market panel + ship panel, time controls, save/load. No magic, no contracts, no fleet.

**M1 success criteria:**
- Same seed + same commands ⇒ identical world (asserted by test).
- Save/load round-trips full world state.
- Owner check: a 20+ minute session where price differences and route choice keep mattering.

### M2 — Depth (draft)

- **E3 Contracts & guilds**: NPC organizations offering freight contracts.
- **E4 Fleet**: multiple ships, route automation.

### M3 — Arcana (draft)

- **E5 Arcane economy**: arcane goods with distinct market behavior, aether currents on lanes.
- **E6 Events & hazards**: aether storms, market shocks, abstract piracy.

### M4 — Arc (draft)

- **E7 Progression & goals**: company milestones, scenario objectives, polish.
