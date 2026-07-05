# E2 — Trade Loop

Feature spec for epic E2 (milestone M1, [PRD](../PRD.md)). Terms per [CONTEXT.md](../../CONTEXT.md).
Grilled and decided with the owner on 2026-07-04 (issue #4). Status: **approved** (2026-07-04);
sim core (#10–#14) and map/top bar UI (#15) implemented.

Scope in one line: one region, live per-port markets, one ship sailed manually, map + panels UI,
time controls, save/load. No magic, no contracts, no fleet, no upgrades.

## Design

### Player experience

Start with 500 thalers and one ship (hold 50) docked somewhere in a procedurally generated
region of 5–6 ports. Read the live price board, buy cheap, pick a destination, sail for 2–5 world
days while the economy keeps moving, sell higher, climb the goods ladder from grain runs toward
timber freight. Voyages are long on purpose: prices drift while you fly, so a route chosen at
departure is a bet, not a sure thing.

### Goods

Five goods, no arcane goods yet (E5). Base prices set the affordability ladder:

| Good | Base price (₸) | Role |
| --- | --- | --- |
| grain | 10 | cheap bulk; every non-agrarian port consumes it |
| textiles | 40 | processed staple made in urban ports |
| aether salt | 60 | preservative & ship fuel additive, mined |
| electronics | 150 | high-value manufactured goods |
| timber | 250 | **rare**: living wood from verdant worlds — a luxury freight in the aether |

Setting note (owner's call): in the aether, wood is one of the rarest materials there is —
timber is the endgame freight of E2, not a building commodity.

### Ports & archetypes

Each port gets one **port archetype** at worldgen. Profiles are net flows per world day
(24 ticks) and are stored per day — exact integers; the market tick divides by 24 when
applying them. Initial values, tuned during implementation:

| Archetype | Produces /day | Consumes /day |
| --- | --- | --- |
| agrarian | grain +96 | textiles 6, electronics 2, aether salt 4 |
| industrial | electronics +12 | grain 24, aether salt 8, timber 2 |
| urban | textiles +24 | grain 30, electronics 4, timber 3, aether salt 4 |
| mining | aether salt +20 | grain 18, textiles 4, electronics 3 |
| verdant | timber +6 | grain 12, textiles 5 |

Invariant: every good has exactly one producing archetype and ≥2 consuming archetypes, so
arbitrage always exists and flows from geography, not scripts.

### Market model

Price is a pure function of stock (decided over hidden-pool and random-walk models):

```
price(good, port) = basePrice * (equilibrium / max(stock, 1)) ^ elasticity
```

- `elasticity = 0.75` (global for E2; per-good is a future tuning lever).
- Clamp to `[0.25 × base, 4 × base]`.
- `equilibrium` per (port, good): `max(100, 10 × daily gross flow)`; initial stock at worldgen
  is equilibrium ± 25% jitter (seeded RNG), so opening prices vary around base.
- Each tick every market applies production and consumption to stock. Consumption stops at
  stock 0 (unmet demand is lost); production stops at the stock cap `4 × equilibrium`
  (warehouses full).
- **Event modifier hook (for E6):** production and consumption are each multiplied by a
  modifier that defaults to 1. E2 ships the multiplication only; storms, meteor rains and
  market shocks (E6) will drive the modifiers without touching the market code.

**Trading** is marginal, per unit: buying walks the price up as stock falls unit by unit
(total = Σ price at each intermediate stock); selling walks it down symmetrically. This makes
dumping a full hold into a small market self-limiting. Thalers are integers; totals round to
the nearest thaler.

**Information:** all prices in the region are live and visible at all times (owner's call:
price drift over long voyages already supplies the uncertainty; stale info on top would make
the sim feel random). Each price shows a trend arrow vs. the last day-boundary snapshot.

### Worldgen

`generateRegion(rng, template)` — procedural, deterministic from the seed, shaped by a
**region template**:

```
RegionTemplate {
  portCountRange: [5, 6]  // min 5: fewer ports than archetypes would leave a good with no producer
  archetypeWeights: { agrarian: 1, industrial: 1, urban: 1, mining: 1, verdant: 1 }
  laneDensity: 0.6            // fraction of all candidate edges kept in total (min: spanning tree)
  voyageTicksRange: [48, 120] // lane length → duration mapping bounds
  portNamePool: [...]
}
```

v1 ships one default template (`heartland`). The template is data, not code — future regions
(e.g. mining-heavy frontiers, different port counts) are new templates, no worldgen changes.

Algorithm: draw port count from the range → assign archetypes (shuffle all five first so every
archetype appears once before weighted repeats — keeps the arbitrage invariant) → place ports
on a unit plane with minimum-distance rejection sampling → connect with a random spanning tree,
then add random extra edges until `laneDensity` of all candidate edges is kept (sparse graph:
routing must matter) → map each lane's euclidean length linearly into `voyageTicksRange`.

### Ship & travel

One ship, hold 50. Commands available while docked: buy, sell, sail to port. `sailTo` runs
Dijkstra over lane durations, assigns the resulting **route**, and the ship traverses it
voyage by voyage, passing intermediate ports without docking. No route loops or automation
(that's E4). While underway the ship shows destination and ETA in ticks.

### Time controls

Speed ladder per ADR-0003: pause / 1x / 10x / 100x, wired to `elapsedToTicks` from E1.
Expected play pattern with 48–120-tick voyages: pause to trade, 10x–100x to fly.

### UI layout

Single screen, no view switching (readable depth: the map never leaves sight):

```
┌─────────────────────────────────────────────┐
│ ₸ 1 240      Day 12, 07:00     ⏸ 1x 10x 100x │  top bar
├───────────────────────────┬─────────────────┤
│        REGION MAP         │ context panel   │
│   ○ port    ○             │                 │
│     \      / \            │ port clicked →  │
│      ○────○   ○           │  market table   │
│        ⛵ ship             │  (price, trend, │
│                           │   stock, buy/   │
│                           │   sell + qty)   │
│                           │ ship clicked →  │
│                           │  hold, dest, ETA│
└───────────────────────────┴─────────────────┘
```

Map: SVG — ports as nodes (name + archetype glyph), lanes as edges, ship moving along its
lane proportionally to voyage progress. World date convention: Day 1 starts at tick 0,
hour = tick mod 24 (decided during #15; nothing earlier defined it). Clicking a port while docked there enables trading;
remote ports show the same live market table read-only.

### Save / load

Per ADR-0004: one autosave slot in localStorage (`etersim.autosave`), written every 24 ticks
and on pause. Start screen: **Continue** (if autosave exists) / **New game** with an optional
seed field (blank = random seed). Menu: export/import world JSON. Save format
`{ version: 1, world }` — the version field gates future migrations.

### Starting conditions

500 ₸, one ship (hold 50) docked at a random port, world at tick 0. A full hold of grain
(~500 ₸) is the natural first move; timber freight (~12 500 ₸ a hold) is the horizon.

### Out of scope & future hooks

- **E4:** route automation, fleet.
- **E5:** arcane goods, aether currents.
- **E6:** events drive the production/consumption modifiers shipped here.
- **Post-v1 (owner's hook, recorded, not designed):** multiple regions where cross-region
  prices are known only from the last visit; a buildable trading outpost upgrades a region to
  live prices; cross-region trade carries uncertainty bonuses. Nothing in E2 may preclude
  this, nothing in E2 implements it.

## Tech

### Sim module layout (`src/sim`, pure TS — ADR-0002)

| File | Contents |
| --- | --- |
| `goods.ts` | `GoodId` union, `GOODS` table (base price, display name) |
| `region.ts` | `Port`, `Lane`, `Region` types; `PortArchetype` |
| `template.ts` | `RegionTemplate` type + `HEARTLAND` default |
| `worldgen.ts` | `generateRegion(rng, template): [Region, RngState]` |
| `market.ts` | `price()`, `quoteBuy()/quoteSell()` (marginal totals), `marketTick()` |
| `ship.ts` | `Ship` (docked \| underway + route/progress), voyage advancement |
| `commands.ts` | `Command` union: `sailTo`, `buy`, `sell` (replaces E1's empty union) |
| `pathfinding.ts` | Dijkstra over lane durations |
| `world.ts` | `World` grows: `region`, `company { thalers, ships }`, price snapshots |
| `tick.ts` | phase order: apply commands → advance ships → market tick → tick+1 |

All iteration in deterministic array order (generation order); no object-key iteration.
Invalid commands (buy over stock/thalers/hold, sail while underway) are rejected without
state change — the command is dropped, never partially applied.

New-game seeding: seed string → uint32 hash (FNV-1a, in sim) → `createWorld(seed, template)`
runs worldgen and threads the RNG state into the world.

### Store bridge & UI (`src/store`, `src/ui`)

- Zustand store holds the current `World` + UI state (selection, speed, carryMs); a
  `requestAnimationFrame` loop feeds real elapsed ms through `elapsedToTicks` and folds
  `tick()` the returned number of times with empty command lists. Player commands apply
  immediately via `applyCommand` on dispatch instead of queuing (ADR-0005) — this enables
  pausing to trade; determinism is preserved because `tick()` applies commands at the start
  of a tick, so `applyCommand` now + `tick(world, [])` later equals `tick(world, [cmd])`.
- Components: `TopBar`, `RegionMap` (SVG), `PortPanel`, `ShipPanel`, `StartScreen`.
- Persistence adapter lives in `src/store` (localStorage is banned inside `src/sim`).

### Testing plan (TDD for sim)

- Worldgen: same seed + template ⇒ deep-equal region; archetype coverage invariant; graph
  connectivity; lane durations within template bounds.
- Market: price formula bounds and clamps; marginal quote symmetry (buy then sell same lot
  never profits at one market); stock never negative, never above cap over 10 000 ticks.
- Commands: rejection cases leave world unchanged; happy paths conserve
  `thalers + cargo value` at quote prices.
- Determinism: scripted 5 000-tick session with mixed commands ⇒ deep-equal worlds.
- Save: JSON round-trip of a mid-session world ⇒ deep-equal.
- UI: light — store bridge unit tests; panels verified by running the app.

### Balance tuning levers (implementation-phase, no spec change needed)

Archetype flow tables, `elasticity`, clamp bounds, equilibrium formula, jitter range,
starting thalers/hold. Anything structural (new good, new archetype, price formula shape)
is spec drift and updates this file.
