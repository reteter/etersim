# E8 — Living economy

Feature spec for epic E8 (milestone M2 — Living Region, [PRD](../PRD.md)). Terms per
[CONTEXT.md](../../CONTEXT.md). Grilled and decided with the owner on 2026-07-08.
Status: **approved** (2026-07-08); **shipped** (#57–#63, epic closed 2026-07-09).

Grill inputs: [playtest-2026-07-07-market-legibility.md §3–4](../design-notes/playtest-2026-07-07-market-legibility.md)
(saturation root cause, price board idea, v2 grill decisions),
[playtest-2026-07-08-orb.md §2/6/7/10](../design-notes/playtest-2026-07-08-orb.md)
(free-time arbitrage re-confirmed; two new requirements: per-archetype price bias and
bid-ask spread; price board confirmed).

Scope in one line: the region's markets become self-balancing and structurally varied —
price-elastic flows, per-archetype price bias, bid-ask spread, trade osmosis with ambient
visualization, daily stochastic flow drift — plus a region-wide price board overlay.
Explicit non-goals: simulated NPC ships as agents (osmosis is a flow; the "rich" variant
stays a Horizon idea), ship upkeep (parked, E3-era), information fog (E6), the per-good
comparison badge in remote port view (subsumed by the price board; revisit only if a
playtest shows the port panel still needs it), keybind configuration (#56, separate
scope), route automation (E9).

## Design

### Principle: durable gradients, transient opportunities

Two playtests said the same thing: *"that's not a decision anymore, it's an algorithm."*
Today every market drifts monotonically to floor or ceiling and pins there; waiting is
free and the floor→ceiling spread is guaranteed. E8 replaces that dead landscape with a
region that holds two kinds of profit:

- **Structural gradients** — persistent, moderate price differences between port
  archetypes (a mining outpost always values grain above an agrarian breadbasket).
  Predictable bread-and-butter income; the foundation E9's looping routes will stand on.
- **Transient opportunities** — daily flow drift knocks ports out of equilibrium;
  elasticity and osmosis chase the disturbance but slowly, leaving a window for an
  observant player to beat the region's own correction. The reward for *watching* the
  region work (owner's v2 fantasy: observe-and-orchestrate).

Everything below is calibrated against this split. Balance targets (tuning these is not
spec drift): resting producer→consumer price gaps of roughly **25–40%** across the
region, a buy+sell round trip costing **~5%** of value, osmosis waking above **~15%**
relative price gap.

### Price-elastic flows (soft saturation)

Production and consumption respond to price with a continuous multiplier in
**[0.25×, 1.5×]**, equal to 1× at the good's effective base price (stock at
equilibrium):

- Unfavorable price slows a flow down to the **0.25× floor, never to zero**: a port cut
  off from trade (regional shortage, player draining a market, future E6 lane cuts)
  still starves eventually — several times slower than today, and the rising price
  pulls osmosis in long before. Extremes remain reachable but become a *crisis state*,
  not the resting state; the region genuinely needs trade to stay healthy.
- Favorable price boosts a flow **up to 1.5×**, symmetrically: expensive goods make
  producers speed up, cheap goods make consumers eat through surplus. The region heals
  shortages at the source and recovers quickly after player action.

Consumption still stops entirely at stock 0 and production at the stock cap (unchanged
hard limits).

### Per-archetype price bias (structural variation)

**Corrects the root cause of playtest-orb observation #6** (identical extreme prices
everywhere): `basePrice` was global per good, so every port quoted the same curve. Now
each port gets an **effective base price** per good:

```
effectiveBase(port, good) = basePrice(good) × archetypeBias[archetype][good] × portJitter
```

- `archetypeBias` is a hand-authored 5×5 table: an archetype **consuming** a good biases
  it up (~1.15–1.35×), one **producing** it biases it down (~0.8×), neutral goods sit
  at 1.0×. Initial table (tuning is not spec drift):

  | | grain | textiles | aetherSalt | electronics | timber |
  | --- | --- | --- | --- | --- | --- |
  | agrarian | 0.80 | 1.20 | 1.15 | 1.15 | 1.00 |
  | industrial | 1.30 | 1.00 | 1.25 | 0.80 | 1.15 |
  | urban | 1.35 | 0.80 | 1.15 | 1.20 | 1.20 |
  | mining | 1.30 | 1.15 | 0.80 | 1.20 | 1.00 |
  | verdant | 1.20 | 1.20 | 1.00 | 1.00 | 0.80 |

- `portJitter` is a per-port, per-good multiplier in **[0.95, 1.05]** drawn from the
  seeded worldgen RNG — two ports of the same archetype never quote twin prices; the
  region gets texture without breaking determinism (ADR-0003).
- The bias scales the **whole price curve including floor and ceiling** (both are
  multiples of the base) — zeroed-out ports now quote *different* ceilings, and the
  elasticity multiplier pivots around the biased base. Spatial price heterogeneity
  becomes structural, not an accident of stock levels.

### Bid-ask spread (anti-scalp friction)

**Corrects the `market.ts` claim** "a buy-then-sell round trip at one market never
profits" — true only instantaneously; waiting one tick captured consumption drift for
free (playtest-orb observation #10). Fix:

- Quotes gain a spread of **~2.5% per side**: buying pays the marginal-price walk
  ×1.025 (ask), selling receives it ×0.975 (bid). A round trip costs ~5% of value —
  above the ~2%/tick price drift near equilibrium, so 1–2-tick scalps lose money, while
  structural gradients of 25–40% barely notice.
- The spread is **baked into the quotes**: the price you see is the price you get. The
  port panel shows **two prices per good** (buy/ask and sell/bid) — which also fixes
  today's guesswork about what a good sells back for.
- Spread revenue goes nowhere: it is the game's first money sink and first friction on
  churn (upkeep stays parked).
- Trend glyphs and snapshots keep tracking the **mid price** (the spread-free curve), so
  trends describe the market, not the fee.

### Trade osmosis (the lazy competitor)

Osmosis (CONTEXT.md) is the region's self-balancing flow — designed deliberately as a
competitor the player always outruns:

- **Deadband:** no flow below **~15% relative price gap** on a lane. Structural
  gradients from bias survive at rest; osmosis reacts to real disequilibria (crises,
  player action, drift swings), not to the landscape.
- **Proportional above the deadband:** flow scales with the gap beyond the threshold.
- **Attenuated by distance:** flow is divided by the lane's `voyageTicks` — remote pairs
  equalize slower, the region keeps pockets where a player route is worth the trip
  (consistent with "map is space", E10).
- **Capped per lane per tick:** osmosis never teleports bulk cargo; a player ship is
  always faster at exploiting a big gap.
- **No in-transit state:** goods move directly between the two markets each tick — it
  is diffusion, not voyages. Magnitudes are small; the cap guarantees no bulk teleport.
- All flows in a tick are computed from the **pre-tick price snapshot**, then applied —
  no lane-order artifacts.

### Ambient ships (osmosis made visible)

The "living region" must be visible, not just simulated. Active osmosis renders as
**small ambient pulses** traveling along the lane in the flow's direction — glyphs
*clearly smaller* than the Controlled Ship, read as signal moving through a network,
not as vessels (owner call, 2026-07-08). Frequency/intensity scales with flow
magnitude. Purely cosmetic and UI-side: derived from sim state, no entities in
`src/sim`, no tick-driven sim cost. Thanks to the deadband, lanes at rest stay quiet —
the map keeps the "quieter lanes" calm of PR #55, and a busy lane is a diagnostic: it
points at a price gap worth investigating.

### Stochastic flow drift (the region breathes)

Drift lives on **flows, not equilibria** — it must create real disequilibria that
elasticity and osmosis then visibly chase, without silently moving the player's learned
price anchors:

- Each port × good carries a drift multiplier in **[0.7, 1.3]** applied to its
  production/consumption rate, on top of the elasticity multiplier.
- The multiplier takes a **mean-reverting random step once per world day** (not per
  tick): "a good week at the mines", "a lean harvest" — chunky, legible, cheap. Draws
  come from the world's seeded RNG in canonical port × good order (ADR-0003).
- Mean reversion guarantees no port wanders off permanently: **drift breathes, bias
  stands** — transient opportunity vs. durable structure, cleanly separated.
- A strong swing can push a lane's price gap past the osmosis deadband and light up
  ambient pulses — drift is the heartbeat that makes the region worth watching.

### Region price board

The agreed full-information economic view (fog stays parked for E6):

- **An overlay** in the Options/Credits pattern, opened from a TopBar button and a
  hotkey (default key ships with the board; configurability belongs to #56).
- **Rows = ports** (archetype accent as on the map), **columns = goods**; each cell
  shows **bid/ask** and the trend glyph. 6×5 cells fit comfortably.
- Per good column, the **cheapest ask** (where to buy) and the **highest bid** (where
  to sell) are highlighted — the game's core decision, readable at a glance.
- The row of the port where the Controlled Ship is docked is marked; clicking a row
  opens that port's panel.
- The per-good comparison badge from the 2026-07-07 note (item 2) is **subsumed** by
  the board and deliberately not built — a decision, not an omission.

## Tech

### Market (`src/sim/market.ts`)

- New constants: `SPREAD = 0.025`, `FLOW_MULT_MIN = 0.25`, `FLOW_MULT_MAX = 1.5`,
  `OSMOSIS_DEADBAND = 0.15` (osmosis constants may live in `osmosis.ts`).
- `price(good, entry)` gains the port's effective base: signature takes an
  `effectiveBase` (or the `Port`) instead of reading `GOODS[good].basePrice` directly;
  floor/ceiling clamp against the effective base. `price` stays the **mid price**.
- `quoteBuy` = marginal walk × `(1 + SPREAD)`, `quoteSell` = walk × `(1 − SPREAD)`,
  rounding as today (walk first, round the total, spread applied before rounding).
  The docstring claim about zero-profit round trips is replaced by the spread
  guarantee: an instant round trip loses ~2×SPREAD of value.
- `marketTick` applies `flow × elasticityMult(price/effectiveBase) × driftMult`, with
  `elasticityMult = clamp(ratio, FLOW_MULT_MIN, FLOW_MULT_MAX)` — linear in the price
  ratio (β = 1): at the 4× ceiling a consumer runs at 0.25×, a producer clamps at 1.5×
  well before. Hard limits unchanged (consumption stops at 0, production at cap).

### Region & worldgen (`src/sim/region.ts`, `src/sim/worldgen.ts`, `src/sim/goods.ts`)

- `ARCHETYPE_BIAS: Record<PortArchetype, Record<GoodId, number>>` — the authored 5×5
  table (region.ts, next to `ARCHETYPE_PROFILES`).
- `Port` gains `priceBias: Record<GoodId, number>` — the combined
  `archetypeBias × portJitter`, drawn once in worldgen (`nextFloat` per good in
  `GOOD_IDS` order, jitter `0.95 + 0.1u`), serialized with the world.
  `effectiveBase(port, good) = GOODS[good].basePrice × port.priceBias[good]`.
- Worldgen RNG draw order extended — same seed ⇒ deep-equal region still holds
  (existing determinism tests extend to `priceBias`).

### Osmosis (`src/sim/osmosis.ts`, new)

- `osmosisTick(region): { region, pulse }` — for each lane × good in canonical order,
  compute mid prices from a pre-tick snapshot; if the relative gap
  `(pHigh − pLow) / pLow > OSMOSIS_DEADBAND`, move
  `min(OSMOSIS_RATE × (gap − OSMOSIS_DEADBAND) × eqAvg / voyageTicks, OSMOSIS_CAP × eqAvg)`
  units from the cheap to the expensive port (never below 0 / above the cap rules).
  All flows computed first, then applied.
- Calibration to start (tuning ≠ spec drift): `OSMOSIS_RATE = 0.02`,
  `OSMOSIS_CAP = 0.01` (per tick, as a fraction of average equilibrium) — hauling a
  full hold across a 40-tick lane must move more goods than osmosis does over the same
  interval on that lane.
- `pulse: Record<LaneId, number>` — signed, value-weighted net flow per lane this tick
  (positive = a→b), stored on `World` for the UI's ambient layer. Transient display
  state; serializing it with the world is harmless.

### World & tick (`src/sim/world.ts`, `src/sim/tick.ts`)

- `World` gains `flowDrift: Record<PortId, Record<GoodId, number>>` (init 1.0) and
  `osmosisPulse: Record<LaneId, number>`.
- Tick phase order becomes: apply commands → advance ships → market tick (elasticity ×
  drift) → **osmosis** → tick+1 → on day boundary: **drift step** + price snapshots.
- Drift step: per port × good in canonical order,
  `m' = clamp(m + DRIFT_REVERT × (1 − m) + DRIFT_STEP × (2u − 1), 0.7, 1.3)` with
  `DRIFT_REVERT = 0.2`, `DRIFT_STEP = 0.15`, `u` drawn via `nextFloat`. Draws thread
  through `world.rng` — a separate RNG stream (floated in the grill) is unnecessary
  because drift draws are schedule-fixed (day boundaries only) and no player command
  consumes RNG; recorded here as the settled refinement.
- **No save migration**: pre-1.0 dynamic phase, no compat guarantees (owner call
  2026-07-07, reaffirmed by the E10 precedent). Old saves without the new fields are
  invalid; start a new game.

### UI (`src/ui/`)

- `PortPanel.tsx`: two prices per good — buy (ask) and sell (bid); trend glyph keyed to
  the mid-price snapshot as today.
- `PriceBoardOverlay.tsx` (new, Options/Credits overlay pattern): ports × goods table,
  bid/ask + trend per cell, archetype accents, cheapest-ask / highest-bid highlights
  per good, docked-row marker, row click → port panel. TopBar button + default hotkey
  (reconcile configurability with #56 when it lands).
- `RegionMap.tsx`: ambient osmosis layer — small pulses along lanes with
  `|osmosisPulse|` above a display threshold, direction from the sign, density/speed
  from magnitude; clearly subordinate to the Controlled Ship glyph; respects
  `prefers-reduced-motion` (E10 precedent).

### Docs sync

- CONTEXT.md: new entries **Price bias** (PL: odchylenie cenowe), **Spread**
  (PL: spread), **Flow drift** (PL: dryf przepływów), **Price board** (PL: tablica
  cen); update **Trade osmosis** implementation note (shipped in E8, ambient-pulse
  rendering); note under **Market** that quotes are two-sided (bid/ask).
- E2 spec (`E2-trade-loop.md`): Market model section gets a pointer here — constant
  flows, global base prices and spread-free quotes are superseded.
- PRD §M2 E8 bullet: link this spec; fold in the two playtest-orb requirements (bias,
  spread).
- Design notes: `playtest-2026-07-08-orb.md` items 2/6/7/10 and
  `playtest-2026-07-07-market-legibility.md` items 3–4 get "Resolved → spec"
  blockquotes; 07-07 item 2 (comparison badge) gets a "subsumed by the price board"
  note.
- No new ADR: no hard-to-reverse decision beyond what ADR-0003/0004 already cover;
  calibrations are declared tunable.

## Testing

- Sim (Vitest, TDD):
  - Determinism: same seed + same commands ⇒ deep-equal world after N days (drift and
    osmosis included); worldgen `priceBias` deterministic.
  - Elasticity: multiplier curve (1 at equilibrium, clamps at 0.25/1.5); an isolated
    consumer port approaches stock 0 strictly slower than the constant-flow model, and
    still reaches it (soft saturation, not self-stabilization).
  - Bias: resting mid prices differ per archetype per the table; ceilings/floors scale
    with bias; jitter within [0.95, 1.05].
  - Spread: instant buy→sell round trip loses ~5%; a buy → wait k ticks → sell scalp at
    nominal flows is unprofitable for small k (the observation-#10 regression test).
  - Osmosis: zero flow below the deadband; direction cheap→expensive; per-tick cap
    respected; attenuation by `voyageTicks`; snapshot-based application (no lane-order
    artifacts).
  - Drift: bounds hold; mean reversion (expected value drifts toward 1); steps only at
    day boundaries.
  - **Invariant suite** (region alone, no player, 60 world days, several seeds): no
    port × good pinned at floor/ceiling for the last 30 days; every good keeps
    cross-port mid-price dispersion > 0; total stock stays finite and positive.
  - **Dominance guardrail** (the epic's goal, encoded): a scripted "camp at the
    producer until cheap, haul to the starved neighbor" bot earns **no more profit per
    day** than a scripted simple gradient-loop bot — the degenerate autopilot stops
    being optimal.
- UI (Playwright E2E): price board opens via TopBar button and hotkey; 6×5 grid with
  bid/ask; cheapest-ask/highest-bid highlights present; docked row marked; row click
  opens the port panel; port panel shows two prices per good; ambient pulse layer
  renders when a flow is active (seeded scenario).
- Manual playtest: does the region *feel* alive — watch it run untouched for a few
  days; the owner's control question: "do you see decisions instead of an algorithm?"
  Tune bias table, osmosis rate, drift amplitude, pulse visuals.

## Issue cut

Milestone **E8 — Living economy** (filed 2026-07-08).

| Issue | Track | Scope | Depends on |
| --- | --- | --- | --- |
| #57 | sim | `feat(sim)`: per-archetype price bias + port jitter + bid-ask spread (effective base, two-sided quotes, worldgen draw) | — |
| #58 | sim | `feat(sim)`: price-elastic flow multiplier in marketTick (0.25×–1.5×, soft saturation) | #57 |
| #59 | sim | `feat(sim)`: trade osmosis module (deadband, attenuation, cap, pulse output, tick phase) | #57 |
| #60 | sim | `feat(sim)`: stochastic flow drift (daily mean-reverting step, World state, invariant + dominance suites) | #58 |
| #61 | ui | `feat(ui)`: port panel bid/ask display | #57 |
| #62 | ui | `feat(ui)`: region price board overlay (TopBar button, hotkey, highlights) | #57 |
| #63 | ui | `feat(ui)`: ambient osmosis pulses on the map | #59 |

Sequencing note: E8 runs after E10 (shipped) and **before E9** (owner, 2026-07-07) —
routes need a living economy underneath, and E9's fleet reuses the gradients this epic
creates. #57 is the keystone; #58/#59 parallelize after it, UI tracks parallelize
against sim tracks (#61/#62 after #57, #63 after #59). The invariant and dominance
suites land with #60, closing the epic's loop.
