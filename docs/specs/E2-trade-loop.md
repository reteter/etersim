# E2 — Trade Loop

Feature spec for epic E2 (milestone M1, [PRD](../PRD.md)). Terms per [CONTEXT.md](../../CONTEXT.md).
Grilled and decided with the owner on 2026-07-04 (issue #4). Status: **approved** (2026-07-04).

**Implementation status (2026-07-07):**

| Area | Issues | Status |
| --- | --- | --- |
| Sim core | #10–#13 | **Shipped** |
| Store bridge + time fold | #14, #26 | **Shipped** (ADR-0005 immediate commands) |
| Baseline map + panels | #15, #16 | **Shipped** (pre–#28 UX; see §UI layout — shipped) |
| Save / load | #17 | **Shipped** (export/import; settings reconciliation in #37) |
| Controlled Ship + Harbor | #28, #32 | **Shipped** — port-click priority, Harbor list, `controlledShipId` store model, always-visible header |
| Remaining follow-ups | #33–#37 | **Spec'd, not shipped** — locked design in §UI layout — follow-ups and follow-up sections below |
| Moved to E10 | #25, #34 | **Re-scoped** — land in [E10 — Orrery view](E10-orrery-view.md) (spec approved 2026-07-07) |

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
  laneDensity: 0.6              // fraction of all candidate edges kept in total (min: spanning tree)
  voyageTicksPerUnit: 130       // lane length → duration: voyageTicks = round(voyageTicksPerUnit × length)
  orbitRadiusRange: [0.18, 0.46] // orbit-ring radii, evenly spaced per port (E10)
  portNamePool: [...]
}
```

(Shape as of E10 — see that spec's Tech section for the authoritative fields; this
snapshot is kept current so it doesn't silently contradict the code.)

v1 ships one default template (`heartland`). The template is data, not code — future regions
(e.g. mining-heavy frontiers, different port counts) are new templates, no worldgen changes.

**Lane topology decision (locked 2026-07-07, see #25):**
- **A** (map as space): topology geometry-aware. `connectPorts` favors short connections (distance-biased, reduced crossings). Positions matter for readability.
- Voyage ticks mapping: purely proportional to distance. (Correction 2026-07-07: the old
  48-tick floor never broke the triangle inequality — an affine cost with a positive
  intercept penalizes every extra hop; its real harm was compressing distance
  differences, e.g. the 206-vs-207 near-tie.)

Designed in full in **[E10 — Orrery view](E10-orrery-view.md)** (spec approved
2026-07-07): the decision-A geometry lands on top of the static orbit-ring placement
there. This section is superseded by that spec.

### Ship & travel

One ship (hold 50) in E2; design supports designating a **Controlled Ship** (see CONTEXT.md) to receive Commands while docked: buy, sell, `sailTo`. `sailTo` runs
Dijkstra over lane durations, assigns the resulting **route**, and the ship traverses it
voyage by voyage, passing intermediate ports without docking. No route loops or automation
(that's E9, PRD M2; the E4 draft was retired into it). While underway the ship shows destination and ETA in ticks.

**Shipped:** commands target `company.ships[0]`; panel `selection` toggles port vs ship view only.
**Follow-up (#28):** Controlled Ship designation via map click (when eligible), Harbor list,
header, or opening ShipPanel.

### Time controls

Speed ladder per ADR-0003: pause / 1x / 10x / 100x, wired to `elapsedToTicks` from E1.
Expected play pattern with 48–120-tick voyages: pause to trade, 10x–100x to fly.

### UI layout

Single screen, no view switching (readable depth: the map never leaves sight). The diagram below
shows the **target layout** after follow-ups #28–#33 ship; the shipped baseline differs — see
subsections.

```
┌─────────────────────────────────────────────┐
│ ₸ 1 240      Day 12, 07:00     ⏸ 1x 10x 100x │  top bar
├───────────────────────────┬─────────────────┤
│        REGION MAP         │ context panel          │
│   ○ port    ○             │ Controlled Ship hdr  │  ← #32
│     \      / \            │ Harbor (docked list) │  ← #28
│      ○────○   ○           │ market table         │
│        ⛵ ship             │ (or Sail button)     │  ← #33
│                           │ ship clicked →       │
│                           │  ShipPanel (hold,    │
│                           │  dest, ETA)          │
└───────────────────────────┴─────────────────┘
```

Map: SVG — ports as nodes (name + archetype glyph), lanes as edges, ship(s) moving along their
lane proportionally to voyage progress. World date convention: Day 1 starts at tick 0,
hour = tick mod 24 (decided during #15; nothing earlier defined it).

#### Shipped (baseline — #15, #16; superseded where noted by #28, #32)

- **Top bar:** thalers, world date, pause / 1x / 10x / 100x (`TopBar`).
- **Side panel:** port view *or* ship view — toggled by map/panel selection (`App` `SidePanel`),
  now with the Controlled Ship header always on top (#32).
- **Map click:** ~~ship icon is drawn on top of docked ports and wins the hit test~~ — *superseded by
  #28:* a docked ship is click-through so the port beneath wins (port-click priority); the ship
  stays clickable while underway.
- **Port view:** market table with buy/sell when the player's ship is docked at that port;
  read-only market + `Sail here (~N ticks)` button below the table for remote ports
  (`PortPanel`). Commands ~~target `company.ships[0]`~~ — *superseded by #28:* target the
  Controlled Ship (`controlledShipId`).
- **Ship view:** hold, docked/underway status, ETA; **Open market** button still present
  (`ShipPanel`) — interim affordance until #28/#33.
- **Save/load menu:** export/import JSON buttons in top bar (`GameMenu`); no settings surface
  yet (#37).

#### Follow-ups — Controlled Ship + Harbor shipped (#28, #32); sail placement pending (#33); glyph work moved to E10 (#34)

Clicking a port always opens its view first: the **Harbor** section (list of docked Ships —
player's ships in one subsection, others in another; hover shows Hold + Cargo summary) appears
above the market.

A thin, always-visible **Controlled Ship header** sits at the very top of the right-hand context
panel (above the Harbor when a port is selected). It is persistent across panel states and shows:
- A ship glyph + short identifier
- Current status and location: "Docked at <PortName>" or "Underway to <PortName> • ~<ETA ticks>"
- Hold usage (e.g. "12/50")

Clicking the header designates the ship as the current Controlled Ship (if not already) and
opens its ShipPanel.

When the Controlled Ship is docked at the currently viewed port, the header indicates this
(e.g. "Docked here") and the ship is visually distinguished in the Harbor list.

- If the Controlled Ship is docked here: market enables trading (buy/sell).
- Remote ports: Harbor on top, followed by a prominent "Sail [Controlled Ship name] here (~N)"
  action button directly under the Harbor section (more visually distinct than standard market
  buttons), then the read-only market below (reuses `previewRouteTicks`).

Docked player Ships are primarily accessed via the Harbor list (port click wins over docked ship
icons). Clicking an eligible player Ship on the map (e.g. underway) or in the Harbor list
designates it as the Controlled Ship and opens its ShipPanel.

Market access happens via port selection (which always shows the Harbor above the market). The
interim "Open market" button remains in ShipPanel as a convenience; its removal and the sail
action's relabel/placement are tracked in **#33**.

For remote ports the Sail button is available only when the Controlled Ship is docked at a
different port. The button always targets the current Controlled Ship. Its label stays
`Sail here (~N)` and it sits below the market for now; the `Sail [Controlled Ship name] here`
relabel and move under the Harbor are tracked in **#33**.

**Note:** Exact glyph choice and any color/tinting treatment for the header are deferred to
follow-up work (#34). Now spec'd in [E10 — Orrery view](E10-orrery-view.md) §Icons
(SVG/Unicode boundary, Controlled gold semantics); see also
`docs/design-notes/icon-implementation-handoff.md`.

### Buy / sell improvements (high-level, E2 follow-up)
The market row in PortPanel supports:
- Qty input clamped to the currently tradable maximum.
- "Max" buttons for buy and sell (Buy max = min(available stock, hold space, thalers ÷ marginal cost of next unit); Sell max = held quantity of the good).
- The marginal price of the *next single unit* is always visible alongside the lot-total quote on the action buttons. This makes the marginal (walking) pricing behaviour legible.

"Max" values and unit price are expected to update live with market changes. Layout remains compact within the existing 320 px panel.

### Auto-pause on arrival (high-level, E2 follow-up)
When the Controlled Ship docks at its *final destination*, the game auto-pauses (default On). 
- Applies only on destination arrival (not intermediate ports).
- No-op if already paused.
- Toggle lives in future options/settings (see item 5 / #17 reconciliation).
- Persists via localStorage (tied to save/load mechanics in the store layer).

### Options / settings view (high-level, E2 follow-up)
A unified settings surface (first tenant: auto-pause toggle from item 4).
- Reconciled with #17 (start screen + menu with export/import) — no duplicate menus.
- Settings and save/load (JSON export/import) live together in the same place.
- Persistence: settings use a separate localStorage key (independent of game saves for simplicity; can be folded later if needed).
- Presentation: extends the existing menu structure (modal or dedicated section within the #17 menu flow).

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

**Shipped:**

- Zustand store holds the current `World` + UI state (`selection` for panel focus, `speed`,
  `carryMs`); a `requestAnimationFrame` loop feeds real elapsed ms through `elapsedToTicks` and
  folds `tick()` the returned number of times with empty command lists. Player commands apply
  immediately via `applyCommand` on dispatch instead of queuing (ADR-0005) — this enables
  pausing to trade; determinism is preserved because `tick()` applies commands at the start
  of a tick, so `applyCommand` now + `tick(world, [])` later equals `tick(world, [cmd])`.
- UI panels pass `company.ships[0].id` to `dispatch` (valid for E2's single ship; not yet a
  Controlled Ship designation model).
- Components: `TopBar`, `RegionMap` (SVG), `PortPanel`, `ShipPanel`, `ControlledShipHeader`,
  `StartScreen`, `GameMenu`.
- Persistence adapter lives in `src/store` (localStorage is banned inside `src/sim`).

**Shipped (#28, #32):**

- Store holds `controlledShipId` (separate from panel `selection`). `openShip(id)` designates a
  ship Controlled and focuses its panel — the shared path for Harbor, map (underway ship) and
  header clicks. Commands target the Controlled Ship. `controlledShipId` is not serialized —
  `newGame`/`loadWorld` seed it from `company.ships[0]`.

### Testing plan (TDD for sim)

- Worldgen: same seed + template ⇒ deep-equal region; archetype coverage invariant; graph
  connectivity; lane durations within template bounds.
- Market: price formula bounds and clamps; marginal quote symmetry (buy then sell same lot
  never profits at one market); stock never negative, never above cap over 10 000 ticks.
- Commands: rejection cases leave world unchanged; happy paths conserve
  `thalers + cargo value` at quote prices.
- Determinism: scripted 5 000-tick session with mixed commands ⇒ deep-equal worlds.
- Save: JSON round-trip of a mid-session world ⇒ deep-equal.
- UI — **[shipped]** store bridge unit tests (incl. `controlledShipId`, `openShip`); Playwright
  E2E for start screen, top bar, port-click priority, Controlled Ship header, Harbor list, ship
  panel, port market table, buy/sell, sail to remote port (`e2e/ui.spec.ts`). E2E runs locally;
  not yet in CI.
- UI — **[#33–#37]** E2E to extend when the rest ship: sail relabel/placement + Open market
  removal, buy/sell max/clamp, auto-pause, Continue/autosave, export/import. Manual playtesting
  recommended for exploration.

### Balance tuning levers (implementation-phase, no spec change needed)

Archetype flow tables, `elasticity`, clamp bounds, equilibrium formula, jitter range,
starting thalers/hold. Anything structural (new good, new archetype, price formula shape)
is spec drift and updates this file.
