# E13 — Guild buildings

Feature spec for epic E13 (milestone M3 — Guilds & obligations, [PRD](../PRD.md)). Terms
per [CONTEXT.md](../../CONTEXT.md). Grilled and decided with the owner on 2026-07-09.
Status: **approved (2026-07-09)**.

Grill inputs: M3 grill (owner: docking-fee discounts too small to feel — rank perks
should unlock *buildings* instead; develop, ship one, hook the rest), E9 design law
"buildings introduce mechanics", E9 construction machinery (Recipe / Build Order /
auto-draw / deliver / rush).

Scope in one line: guild ranks grant **building permits**; the E9 construction machinery
generalizes to building types; the flagship **Granary** (agrarian Storehouse variant)
ships with store/withdraw Route orders — reputation buys mechanics, not percentages.

Explicit non-goals: the other four Storehouse variants (hooks — variant = goods filter +
skin, the implementation ships here); any second building *mechanic* beyond storage;
build queue, assembly time, demolition, relocation (E9 non-goals stand); storehouse
upgrades/capacity tiers; renting storage at NPC buildings; branch offices (PRD Horizon);
save migration (pre-1.0).

## Design

### Permits: reputation buys mechanics

Rank perk shape locked at the grill: a guild rank grants a **building permit** — the
right to construct that guild's building variant. Percent discounts were rejected as
imperceptible at E9's fee scale; a building is a *new verb*, and it extends the E9 law:
every new gameplay layer arrives with a Building. The Granary requires **Granary Guild
rank 2** (constant, tuning) — one settled contract arc away from enrollment, so the
loss-leader investment pays off in a mechanic, visibly.

### Placement: geography with teeth

A guild building may stand at **ports of that guild's archetype** or at the **Free
port** — nowhere else. Consequences fall out of E12's map: the Granary sits with grain
producers (stockpile when the ask dips) or at the neutral crossroads (the Free port as
the region's warehouse hub); you never build on another guild's turf.

### The Granary: storage as a new optimization axis

- Stores **grain only** (the guild's domain; the Storehouse implementation takes a
  goods filter, so future variants are data + skin).
- **Finite capacity** (`STOREHOUSE_CAPACITY = 200`, tuning) — an infinite buffer would
  kill the volatility the whole game runs on.
- Two new Stop order kinds and twin manual commands: **store(good)** (move cargo into
  the storehouse, up to capacity) and **withdraw(good)** (fill available Hold from the
  store). Market-free — the goods are already yours (the E9 `deliver` precedent);
  best-effort ("what fits / what's there"); the ship departs immediately (the no-wait
  law stands).
- **Arbitrage over time is intentional** (pillar 2 gains a third dimension: buy low,
  store, sell after the drift) and bounded: capacity caps the position, and every exit
  still pays the spread and walks the marginal curve. A guardrail test keeps
  buy-store-sell from dominating carry trade.
- Storage's strategic synergy: a buffer smooths E3 contract quotas against flow drift —
  reputation (which unlocked the Granary) helps keep reputation.

### Construction: the E9 machinery, generalized

Commissioning a building creates a Build Order exactly like a hull: Recipe + labor fee,
site store filled by auto-draw from the *building's* port, deliveries (`deliver` and
deliver Stops target any port with an active site — a natural generalization of E9's
"local build site" wording), and rush. **One active Build Order per Company, ship or
building** — scarcity preserved, still no queue. The building activates the moment its
Recipe completes.

### UX skeleton

- **Headquarters panel, Budowa tab** grows a commission choice: ship (as in E9) or a
  permitted building + target port (dropdown limited to legal placements); the same
  progress/stall/rush UI serves both (one Build Order model, one UI).
- **PortPanel** at a storehouse port gains a Storehouse section: stored quantity /
  capacity, plus manual store/withdraw buttons for a docked ship.
- **Route editor** (E9 Trasy tab) gains store/withdraw chips, shown only for ports with
  a Company storehouse.
- Map: no new layer in M3 (a small badge on the port disc is a candidate, parked).

## Tech

### Buildings (`src/sim/building.ts`, generalized)

- `Company.buildings: readonly CompanyBuilding[]`;
  `CompanyBuilding = { type: "storehouse"; variant: GuildId; portId: PortId;
  store: GoodsStore }` — a Goods store like any other (ADR-0008, shipped by E13.0).
  Its goods filter and `STOREHOUSE_CAPACITY` clamp live in its `StorePolicy`
  variant `{ kind: "storehouse"; filter; capacity }`, consumed by `accepts` — **not**
  as clamps inside the `storeGood` command. The Headquarters keeps its E9 shape
  (`Company.headquarters`) — no refactor of shipped state.
- **Correction (2026-07-19):** this spec previously said `BuildOrder` gains a target
  kind union. That road was not taken — #99 extracted a shared `ConstructionSite`
  *engine* and E14's Shipyard kept its own state, so there are parallel holders rather
  than one tagged order. A commissioned Storehouse follows that E14 precedent: it holds
  its own construction state and calls the shared engine, with auto-draw buying at the
  *target* port's market. The one-active-order law is enforced by consuming the existing
  `hasActiveBuildOrder` helper (`commands.ts:126-137`), which already reads "one per
  Company — ship or building" and was written to be consumed here.
- Constants (tuning ≠ spec drift): `STOREHOUSE_RECIPE = { grain: 40, textiles: 20,
  aetherSalt: 10, electronics: 8, timber: 6 }`; `STOREHOUSE_LABOR_FEE = 500`;
  `STOREHOUSE_CAPACITY = 200`; `STOREHOUSE_PERMIT_RANK = 2`.
- New Commands: `commissionGuildBuilding(type, variant, portId)` (rejected without the
  permit rank, on illegal placement, while an order runs, or when the labor fee is
  unaffordable), `storeGood(shipId, good, target)`, `withdrawGood(shipId, good, source)`
  (docked at the storehouse port; best-effort quantities). **Name collision, resolved
  2026-07-19:** `commissionBuilding(thalers, laborFee)` already exists
  (`building.ts:396`) as the generic "charge the labor fee, open an empty site" helper
  used by E14 — the guild-building *command* therefore takes a distinct name rather than
  shadowing it (one identifier, one meaning).
- **Explicit addressing** (ADR-0008; E13.0 leaves it representable but not selectable).
  `store`/`withdraw` and `deliver` name their destination as a `StoreRef` instead of
  relying on a priority chain: E13.0's `resolveDeliveryTarget` is **deleted**, not
  extended, and `StopOrder` carries the destination. This is what makes "feed the
  Storehouse" and "feed the construction site" different expressible intents at one
  port — today they differ only by verb, which E15's provisions chain (3 grain +
  1 textiles) would break, since the Granary stores the same grain a plant consumes
  (Professor F7). `StopOrder` kind union += `"store" | "withdraw"`; the docking phase
  executes them like the E9 three.

### The site registry — superseded

The typed site registry decided here on 2026-07-19 was **reopened and rejected the same
day** at the owner's request, once reading the spec against the code showed it guarded
the wrong shape: the Storehouse arrives as a *collection*, which a loop already covers,
so the registry protected nothing E13 ships, while its re-evaluation trigger (E15's Plant
as a fourth site kind) rested on a premise `docs/specs/E15-processing.md:52` contradicts —
plants are a collection too.

Replaced by **[ADR-0008](../adr/0008-one-goods-store.md)**: every place goods can sit is
one encapsulated Goods store, guarded by a value-neutrality invariant rather than an
enumeration. The refactor ships as sub-epic **[E13.0](E13.0-goods-store.md)**, before
#100. Reasoning chain: [design-notes/goods-store-grill-2026-07-19](../design-notes/goods-store-grill-2026-07-19.md).
The deferred ordered-iterator refactor (#304) keeps its debt but moves its trigger to the
**M5 grill**, where the Great Work may be a genuine fourth singleton.

### Ledger & netWorth

- Kind union += `store` / `withdraw` (good, qty, portId, shipId) — goods movements,
  no thalers; commissioning reuses `laborFee`; activation reuses `launch`? No —
  buildings get their own `completed` kind (a launch is a ship; one kind per meaning).
- Daily `netWorth` adds storehouse stores at region-average mid (the E9 formula gains a
  term; buildings still carry no book value — the honest-curve rule stands). The
  Storehouse registers a `StoreRef`; `computeNetWorth` walks `companyStores` (E13.0), and
  omissions are caught by the value-neutrality invariant rather than by an enumeration.
- **Decided (OQ8, grilled 2026-07-21):** the Storehouse's value gets its own `NetWorthBreakdown`
  field, `buildingStoreValue` — generic, not `storehouseValue`, since E15's Plant needs the
  identical treatment (`E15-processing.md:197`) and a generic field lets it reuse this one
  without a second shape change. Changes the `netWorth` Ledger event shape (`ledger.ts:83-90`):
  `SAVE_VERSION` bumps to 14, `migrateV13ToV14` backfills `buildingStoreValue: 0` on existing
  `netWorth` events (a fact for pre-Storehouse saves, not an approximation). Reasoning:
  [design-notes/oq8-buildingStoreValue-grill-2026-07-21](../design-notes/oq8-buildingStoreValue-grill-2026-07-21.md).

### Docs sync

- CONTEXT.md: Storehouse / Building permit / Stop store-withdraw entries (done live at
  the grill sweep — verify).
- E9 spec: no amendment — deliver's "local build site" generalization is noted here and
  in CONTEXT.md; E9's shipped behavior is unchanged.

## Testing

- Sim (Vitest, TDD):
  - Permit and placement validation on `commissionBuilding` (rank, archetype/freeport
    rule, single active order across ship+building, labor fee).
  - Construction parity: auto-draw at the target port, deliveries, rush, stall, and
    completion behave exactly as the E9 suites (shared machinery, shared tests where
    possible); activation appends the building and emits `completed`.
  - store/withdraw: capacity clamp, hold clamp, goods-filter rejection, best-effort
    zero-quantity no-ops, route-order and manual-command parity (equivalence).
  - netWorth includes stores; Ledger events for every store/withdraw; determinism and
    byte-equal Ledger extended over building scripts; save/load round-trips buildings.
  - **No-dominance guardrail** (standard seed): scripted buy-store-sell at one port
    does not out-earn a scripted two-port carry loop (pillar-1 boundary, encoded).
- UI (Playwright E2E): commission a Granary from the Budowa tab (port dropdown limited
  to legal placements); progress renders; PortPanel Storehouse section shows fill and
  manual store/withdraw; route with store/withdraw chips executes in a seeded scenario.
- Manual playtest: does rank 2 → permit → first Granary feel like the loss-leader
  paying off; does the Free port emerge as a warehouse-hub candidate; does capacity
  feel binding without feeling punitive.

## Issue cut (proposal — file on spec approval)

| Track | Scope | Depends on |
| --- | --- | --- |
| sim | `feat(sim)`: Build Order generalization + `commissionBuilding` + permits | E3 ranks |
| sim | `feat(sim)`: Storehouse state, store/withdraw commands + Stop orders, Ledger kinds, netWorth term | generalization issue |
| ui | `feat(ui)`: Budowa commission choice + PortPanel Storehouse + route editor chips | both sim issues |
| tests | `test(sim)`: no-dominance guardrail (store-sell vs carry) | sim issues |
