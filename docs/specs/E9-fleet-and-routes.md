# E9 — Fleet & routes

Feature spec for epic E9 (milestone M2 — Living Region, [PRD](../PRD.md)). Terms per
[CONTEXT.md](../../CONTEXT.md). Grilled and decided with the owner on 2026-07-09.
Status: **approved (2026-07-09)**.

Grill inputs: [playtest-2026-07-09-living.md](../design-notes/playtest-2026-07-09-living.md)
(progression pull — bigger hold, routes, upgrades; natural play speed 10×; owner follow-up
inputs: regulated money sink, company performance board), CONTEXT.md Route/Course naming
collision note, PRD §M2 E9 bullet (fleet-lite, absorbed E4 draft).

Scope in one line: the Company grows from one ship into an orchestrated fleet — a
Headquarters building unlocks Route templates (looping buy/sell/deliver stops) and ship
construction fed by the living market (auto-draw, player deliveries, market-priced rush),
paid for through docking fees and a full Ledger with an in-game performance board.

Explicit non-goals: **flat cash ship purchase** (never built — construction replaced it
at the grill, superseding the PRD wording "ship purchase is v2's money sink"); route
wait/price conditionals (PRD: route rot *is* the gameplay); additional building types,
build queue, assembly time, Headquarters relocation/demolition, hull classes (M3 as
locked 2026-07-09 ships guild building types via E13; the rest stays parked);
branch offices per region + region administrator (multi-region hooks, PRD Beyond);
"supplier" ship automation (parked hook — the deliver order is its foundation);
map-drawn route editing (list editor ships; map only highlights); trade taxes (the
spread already is one); ship upkeep (parked at this grill; later spec'd in E3 —
approved 2026-07-09); save migration (pre-1.0, E8/E10 precedent).

## Design

### Principle: buildings introduce mechanics

Owner's design law, locked at the grill: a new gameplay layer arrives with a Building,
not with a tutorial. E9 is its first application — the progression beat is
**manual trader → founder → orchestrator**:

1. The game opens exactly as today (E8 manual trading — playtest-confirmed fun).
2. Founding the **Headquarters** is the moment the shipper becomes a company: it unlocks
   the Route panel *and* ship construction, together.
3. From there the player's attention shifts from clicking trades to tuning loops,
   watching the Ledger, and growing the fleet — the observe-and-orchestrate fantasy.

Everything below hangs off this beat. Future buildings (M3) each carry their own
mechanic; other regions will get theirs via branch offices (PRD hook).

### Course vs Route (naming resolution)

The old internal `route` (a pathfinding result — the lane Voyages of one `sailTo`) is
renamed **Course**; **Route** now exclusively means the player-facing loop. E10's UI
identifiers (`courseVoyages`, `isCourseAccented`, `.lane--course-accent`) turn out
correct under the new vocabulary and stay unchanged. Pure mechanical refactor under
existing tests; no behavior change.

### Routes: Company-level templates, assigned by reference

A **Route** is a Company entity, not ship state — created and edited in the
Headquarters' Route panel, assigned to any number of Ships **by reference**:

- **Editing propagates to the fleet**: every assigned ship picks up the change from its
  next Stop. Tune a loop once, five ships follow — orchestration, not micromanagement
  (pillar 2). This is also the foundation for the future "Okazje" feature (switch the
  fleet onto a few hot routes at once).
- Deterministic edge semantics: a ship's next-Stop index left out of range by a
  shortening edit wraps to Stop 0; deleting an assigned Route lets ships finish their
  current Course, then leaves them routeless (no stranding).
- **Manual orders suspend, never destroy**: a manual `sailTo` to a routed ship
  auto-suspends its Route (no confirmation dialog, no rejected command); the Route stays
  assigned and the UI says so. **Resume** sails to the next Stop in order — predictable,
  never "nearest". Intervening on an opportunity must not cost the player their plan.
- Ship-side state is only `(routeId, next Stop index, suspended?)`.

### Stops: buy / sell / deliver, best-effort

A Stop is a Port plus orders named after their economic effect (glossary updated at the
grill — the old load/unload wording became ambiguous once deliver existed):

- **buy(good)** — fill available Hold at the normal ask (`quoteBuy`), paid from the
  Company purse.
- **sell(good)** — sell all of the good at the normal bid (`quoteSell`).
- **deliver(good)** — transfer cargo to the local build site, up to the Recipe's
  remaining need; no charge (the goods are already yours); a no-op at ports with no
  active build.

Rules, all locked:

- **Same quotes as manual play, same shared purse.** A Route can never out- or
  under-perform a player clicking the same trades; when a route loses money the reason
  is visible in the same prices the player already reads (pillar 4). Policies in the
  E11 Harness will drive the very same commands.
- **"Do what you can and sail on."** Insufficient stock → buy what's there; insufficient
  thalers → buy what you can afford; nothing → sail on. A Route never blocks a ship.
  Empty legs are not a bug — they are the **route-rot signal** the player is supposed to
  notice, and the Ledger will show them plainly.
- Orders execute on docking (sells, then buys, then delivers are irrelevant to order —
  each good appears in at most one order per Stop; execution is in the Stop's order
  list order); the ship then dwells docked for one tick before departing on the next
  Stop's Course (Tech — the dwell mirrors manual play and is the player's intervention
  window; it is never idle waiting *for* a price or a condition).
- Ships race for shared purse and stock in deterministic `ships[]` order (Tech).

### Headquarters: founding the company

- **One per Company**, placed at **any port** of the player's choice (no ship presence
  required — the founding is an act of paperwork, not cargo), paid as a flat
  **thaler price**, active immediately. No construction process for the Headquarters
  itself: we do not gate the unlock behind the very system it unlocks, and hauling
  materials with one 50-hold ship would be grind before the game begins.
- The port choice is the first magnate decision and it has teeth: the Headquarters port
  is the market construction will draw from (build near cheap materials?) and where new
  hulls launch (build near your loops?).
- Cost calibration: **₸2,500** — reachable around world day 20–30 of natural play at the
  E8-verified earning pace (tuning ≠ spec drift).
- **Reserve gate (amended 2026-07-12, #122 grill)**: founding requires
  `HEADQUARTERS_COST + CONSTRUCTION_RESERVE` in the purse — see §The Reserve below.
  Below the threshold the founding button is disabled with the honest label:
  "requires ₸3,000 — founding may not touch the ₸500 reserve".

### Ship construction: the market builds your fleet

Commissioning a hull at the Headquarters creates a **Build Order** (one at a time in
E9). The **Recipe** spans all five goods — much grain (provisions), medium textiles
(rigging) and aether salt (hull infusion), a little electronics (instruments) and a
little **timber: the living-wood keel**, the recipe's prestigious top — plus a flat
**labor fee** in thalers charged when the order is placed.

**Corrects the `goods.ts` setting comment** ("timber is a luxury freight here, not a
building commodity"): owner verdict 2026-07-09 — aether ships *must* have living wood at
the keel, and that is precisely *why* timber is the most expensive good in the world.
Fleet growth is meant to feel exceptional.

The build site's material store fills from three sources:

1. **Auto-draw (the default, "runs on osmosis").** Each tick the site buys missing
   materials from the Headquarters port's market at the normal ask, paid from the
   Company purse, rate-capped per day. The site is simply a consumer on the market: its
   demand raises local prices, osmosis starts pulling the good in from neighbors — the
   living economy supplies the shipyard with no dedicated mechanism. When the purse
   hits the Reserve or local stock runs dry the build visibly stalls ("paused:
   treasury reserve" / "paused: no stock") — no penalties, consistent with
   best-effort Stops; auto-draw never takes the Company below the Reserve
   (amended 2026-07-12, #122 grill — originally "purse run dry", which allowed
   spending to ₸0).
2. **Deliveries.** The `deliver` command (docked ship at the Headquarters port) or a
   Route's deliver Stop moves `min(cargo, remaining need)` into the site for free —
   hauling timber from a cheap producer beats paying the local ask; supplying your own
   shipyard becomes a route-optimization problem.
3. **Rush.** One click buys the entire remainder instantly at the normal market quote —
   the marginal walk up the curve plus spread makes bulk rushing *naturally* expensive,
   with the exact cost quoted before confirming. Limited by local stock: **money does
   not teleport timber**. Rushing drains the market, prices spike, osmosis rushes in —
   rush again tomorrow. No flat-premium teleport variant: materials appearing outside
   the market would be the only point in the game where goods bypass the economy
   (anti-pillar 1).

The ship **launches the moment the Recipe completes**: docked at the Headquarters port,
empty, routeless, named (see UX). Payback target for the second ship: **20–40 world
days** (tuning ≠ spec drift).

### The Reserve: construction never touches starting capital

Locked at the #122 grill (2026-07-12), after the first fresh-eyes playtest reached a
dead state — ₸0, empty hold, docked; no income-generating action exists from there
([playtest note](../design-notes/playtest-2026-07-12-fresh-eyes-kacper.md)). The
original stall rule above was spec-compliant with that outcome: it never asked what
happens at ₸0. Root philosophy locked with the fix: **agency guarantee** — from every
reachable state a path to income exists; the game may slow down, never die. No
bankruptcy screen; a dead state is a defect by definition.

- **One rule, four enforcement points**: no construction spend may take the purse
  below the **Reserve** (CONTEXT.md; `CONSTRUCTION_RESERVE = 500` — equal to
  `STARTING_THALERS`, so the rule reads "building never touches your last
  starting-purse"; calibration is tuning ≠ spec drift). Founding requires
  `cost + Reserve`; `placeBuildOrder` requires `labor fee + Reserve`; auto-draw
  stalls at the Reserve (visible stall reason); rush quotes at most `purse − Reserve`.
- **Docking fees stay deliberately outside the rule** — pay-what-you-have, no debt:
  fees are the cost of activity, not investments. The pathological manual drain
  (sailing an empty hold in circles until fees hit ₸0) remains theoretically open;
  it is named grill input to E3 (insolvency under daily upkeep — see #95 and the E3
  spec §Upkeep), not mechanized here.
- **Upfront estimate + confirmation on placing a Build Order**: the Budowa tab shows
  a Recipe × current asks + labor fee breakdown computed by a pure sim function
  (`computeBuildEstimate` — the `computeRushQuote` pattern: the displayed number can
  never drift from what gets charged), labeled "at today's prices" (auto-draw spreads
  purchases over days; prices drift). Clicking "Zleć budowę" opens a confirmation
  step with the total; when the estimate exceeds the purse, the confirmation says so
  plainly — the build will stall at the Reserve unless the player delivers materials
  or keeps earning.
- **No recovery mechanic** (cancel order / withdraw from site): with the Reserve
  universal, the construction dead state is unreachable, so none is needed for #122.
  If site-store withdrawal ever ships, it rides E13's store/withdraw semantics as its
  own design decision, not a rescue.

### Docking fee: the fixed cost of activity

A flat per-docking charge, differentiated per port (by archetype), paid on **every**
docking — manual or routed; sailing through an intermediate port without docking stays
free. No trade tax: the spread already taxes every transaction proportionally, and a
second proportional knob teaches nothing new. The docking fee creates pressure the
spread cannot:

- **Stop count becomes a decision** — two short loops vs one long loop differ in fixed
  cost at equal turnover.
- **The sink self-scales with the fleet** — ₸10 is nothing to a lone manual trader and
  a real budget line for five ships docking thirty times a day (the playtest's
  "small, but felt", structurally).
- **Route rot gets legible sooner** — a loop barely above water after the spread turns
  plainly negative after fees, and the Ledger shows fees as their own line.

No debt in E9: an empty purse pays what it has. Fee schedule (tuning ≠ spec drift):
urban ₸20, industrial ₸15, mining ₸12, agrarian ₸8, verdant ₸5.

### Ledger and the performance board

The Ledger (glossary) lands in E9 as the canonical event stream; the E11 Harness will
consume the same schema — one schema, two consumers.

- **Every thaler or goods movement is an event**: trades (manual and routed), docking
  fees, auto-draw purchases, rush purchases, deliveries, labor fees, the Headquarters
  founding, ship launches — tagged with `tick, kind, shipId?, portId?, good?, qty?,
  thalers?, routeId?`. **`routeId` on route-driven events is the keystone**: per-route
  economics fall out of a filter.
- **Daily net-worth snapshot**: thalers + fleet cargo + build-site store at mid price;
  **ships and buildings carry no book value** — the company-value chart tells the
  honest investment story (a build is a visible dip, then steeper growth; "did the
  second ship pay off" is readable off the curve).
- **Full retention** (~50 events/day is megabytes only after years of world time; a cap
  is a problem for the future, not a design for today).
- The player-facing board in E9: **transaction list** (filter per ship), **company
  value chart** (from snapshots), and — priority, not garnish — **last-loop result per
  Route** ("loop: +₸320 / −₸40") shown in the Route panel, computed from `routeId`
  events. That number is what makes route rot visible at a glance — the heart of E9's
  gameplay.

### Pacing

- **Speed set unchanged** (pause/1×/10×/100×). 10× as the natural cruise is an
  observation, not a problem: 1× remains the watching-the-osmosis gear, 100× the
  waiting gear.
- **Lane distances unchanged in E9** — E10 geometry is fresh, and routes change what
  distance *feels* like (130 ticks stops being waiting time and becomes capital
  turnover time). Explicit playtest question: does 100× displace 10× for good once
  routes run? Only then discuss distance tuning.
- **Balance targets live in world days**: Headquarters ~day 20–30; first hull by
  auto-draw alone ~10–15 days (deliveries/rush compress toward 2–3); second-ship
  payback 20–40 days. At 10× a world day is 2.4 s — a two-week build is ~34 s of
  watching, felt but not boring.
- **#56 (speed hotkeys) joins the E9 milestone**: orchestration is constant
  speed-juggling; `1/2/3/space` stop being QoL and become part of the loop. Scope locked
  v1-lite (owner, 2026-07-09): fixed default bindings + read-only Keybinds tab;
  remappable bindings deferred.

### UX skeleton

- **Headquarters view** — one panel, two tabs. **Budowa**: active Build Order (per-good
  progress, auto-draw rate, stall reason when stalled, rush button with live quote,
  "Zleć budowę" button — disabled while a build runs; before a build, the estimate
  breakdown from `computeBuildEstimate` "at today's prices" and a confirmation step
  on placing the order, with the stall-at-Reserve warning when the estimate exceeds
  the purse — #122 grill, design §The Reserve). **Trasy**: the Company's Route
  templates — Stop editor, assigned ships, last-loop result. Two entrances: a
  "Headquarters" section on the Headquarters port's PortPanel (with build progress bar —
  the owner's "readable from the port level" requirement) and a persistent TopBar
  shortcut once founded.
- **Route editor is list-based, not map-based**: a Stop is a row (port dropdown +
  buy/sell/deliver chips per good); the panel shows loop metrics — total Course ticks,
  docking fees per loop, last-loop result. On the map, the selected Route only
  **highlights its Stop ports** (E10 accent style); drawing full loop paths is parked.
- **Fleet list replaces the single Controlled Ship header**: every ship with name,
  status (docked / underway / on route / suspended), assigned Route; click = designate
  Controlled Ship (mechanic unchanged). **#54 (ship display names) joins E9**: names
  are given at launch (editable, generator-suggested) — with three hulls, "s0/s1/s2"
  stops being funny.
  Implementation note (#83): the old header's click-toggle (clicking while already
  viewing a docked ship's own panel returned to its port panel, #5) was **consciously
  dropped**, not reimplemented — a list of rows designating-and-opening uniformly
  (matching Harbor's existing click behavior) reads more predictably than one row that
  behaves differently on a second click. Flagged for the owner to reconsider if players
  miss the shortcut.
- **Performance board as an overlay** (PriceBoardOverlay pattern): tabs **Transakcje**
  (filterable list) and **Wartość firmy** (chart). Per-route results live with the
  routes (Headquarters view), not here — one fact, one home.

## Tech

### Course rename (`src/sim/pathfinding.ts`, `ship.ts`, `commands.ts`, `src/ui/`)

Mechanical, behavior-free, first PR of the epic: `shortestRoute` → `shortestCourse`,
`Ship.location.route` → `course`, `routeTicks` → `courseTicks`, UI `routePreview.ts` →
`coursePreview.ts` (+ identifiers inside). E10's `course*` identifiers in
`RegionMap.tsx` untouched. Existing tests renamed alongside; the `goods.ts` timber
comment is corrected in the same PR (setting verdict above).

### Route & Stop (`src/sim/route.ts`, new; `commands.ts`, `ship.ts`, `tick.ts`)

- Types: `RouteId`; `StopOrder = { kind: "buy" | "sell" | "deliver"; good: GoodId }`;
  `Stop = { portId: PortId; orders: readonly StopOrder[] }`;
  `Route = { id: RouteId; name: string; stops: readonly Stop[] }`. Assignable iff
  **≥ 2 Stops spanning ≥ 2 distinct ports**, with each good in at most one order per
  Stop — enforced on `createRoute`/`updateRoute`. The distinct-port rule (added in
  implementation) closes a degenerate all-one-port loop that would execute — and never
  pay a docking fee — forever.
- `Company` gains `routes: readonly Route[]`. `Ship` gains
  `assignment?: { routeId: RouteId; nextStopIndex: number; suspended: boolean }` and
  `name: string` (#54, mandatory — every ship is named from launch, including the
  starting ship on new game — `generateShipName(0)`, no RNG draw).
- New Command `renameShip(shipId, name)` (#54/#83): trims the input, rejects a
  blank result (a ship's name is always present), truncates to
  `MAX_SHIP_NAME_LENGTH`; no other field changes. The ShipPanel's rename affordance.
- New Commands (all player mutations stay Commands — determinism + E11 replay):
  `createRoute`, `updateRoute`, `deleteRoute`, `assignRoute(shipId, routeId)`,
  `unassignRoute(shipId)`, `resumeRoute(shipId)`. `assignRoute`/`resumeRoute` are
  **pure state-setters** — they set `(routeId, nextStopIndex, suspended)` only; the
  tick route pass does all Course dispatch and Stop execution, so routes never
  introduce a second ordering regime alongside the `ships[]` race. `applyCommand`'s
  `sailTo` on an assigned, unsuspended ship sets `suspended: true` (auto-suspend).
  Invalid commands drop unchanged, as today.
- **Tick phase order** (extends E8's): apply commands → advance ships → **docking
  phase** → **build-site auto-draw** → market tick → osmosis → tick+1 → day boundary:
  drift step + price snapshots + **net-worth snapshot**.
- Docking phase, in `ships[]` array order (the deterministic race for shared
  purse/stock), **interleaved per ship** (each ship pays then trades before the next is
  touched, so a fee limits what a later ship can afford): charge the docking fee
  (`min(fee, thalers)`, no debt) for every ship that transitioned underway → docked
  this tick. Then a **state-keyed route pass** runs for each docked, assigned,
  unsuspended ship:
  - **at its next Stop's port** → execute the Stop's orders best-effort in list order
    (by dispatching the *same* buy/sell/deliver Commands a player would — routes get no
    special math, so a Route's trades equal the identical manual sequence by
    construction), advance `nextStopIndex` (mod stop count), and **dwell docked for one
    tick**. The dwell mirrors manual play's quantization (a ship can never depart the
    tick it arrives) and gives the player a tick-boundary window to intervene — a manual
    `sailTo` lands there and auto-suspends the Route. Co-located consecutive Stops drain
    one per dwell tick.
  - **elsewhere** → redirect on the Course to the next Stop's port (`shortestCourse`),
    no execution. This is both the normal post-dwell departure and the recovery when a
    template edit moved the Stop out from under an in-flight ship (no wrong-port trade,
    no deadlock).
  Fee gates on the transition, execution on ship state — so a resume/assign at the Stop
  port trades without a second fee. An assign/resume on an **underway** ship is dormant
  until it next docks, then the pass picks it up. Index out of range after a shortening
  edit → wrap to 0. Deleted route → assignment cleared once the ship's current Course
  completes (never stranded mid-voyage).
- Docking-fee constants: `DOCKING_FEE: Record<PortArchetype, number>` =
  `{ urban: 20, industrial: 15, mining: 12, agrarian: 8, verdant: 5 }` (region.ts, next
  to `ARCHETYPE_PROFILES`).

### Headquarters & construction (`src/sim/building.ts`, new)

- `Company` gains `headquarters?: { portId: PortId; buildOrder?: BuildOrder }`.
  `BuildOrder = { siteStore: Record<GoodId, number> }` — remaining need is
  `RECIPE[good] − siteStore[good]`, no extra progress state.
- Constants (tuning ≠ spec drift): `HEADQUARTERS_COST = 2500`; `SHIP_RECIPE` =
  `{ grain: 100, textiles: 30, aetherSalt: 20, electronics: 5, timber: 12 }`
  (≈ ₸7,150 at equilibrium mid prices); `LABOR_FEE = 800` (charged on
  `placeBuildOrder`); `AUTO_DRAW_PER_DAY = 10` units per good (spread per tick like
  E8 flows — grain is the 10-day pole by auto-draw alone; a 50-hold delivery is worth
  5 days); `CONSTRUCTION_RESERVE = 500` (= `STARTING_THALERS`; #122 grill 2026-07-12
  — see design §The Reserve).
- New Commands: `foundHeadquarters(portId)` (rejected if one exists or
  purse < cost + Reserve),
  `placeBuildOrder()` (rejected while one runs or purse < labor fee + Reserve),
  `rushBuild()` (buys every remaining good via `quoteBuy`, bounded by current local
  stock **and** the purse above the Reserve — `maxAffordableQty` per good against
  `purse − CONSTRUCTION_RESERVE`, so it is partial by stock and never dips into the
  Reserve; full quote shown UI-side from the same function),
  `deliver(shipId, good)` (docked at the Headquarters port; moves
  `min(cargo, remaining)`).
- `computeBuildEstimate(world)`: pure preview of a prospective Build Order's cost —
  Recipe × current asks + `LABOR_FEE`; the `computeRushQuote` pattern, consumed by
  the Budowa tab's estimate + confirmation step (#122 grill). Priced via
  `estimateBuy` (market.ts): `quoteBuy`'s exact marginal walk without the stock cap
  — units beyond today's stock price at the curve's ceiling, so a full-Recipe
  estimate stays finite when the market can't cover it today (`quoteBuy` delegates
  to it within stock, so the two can never drift).
- Auto-draw (tick phase): for each good in `GOOD_IDS` order with remaining need and
  per-day budget left, buy `min(rate share, remaining, affordable above the Reserve,
  floor(stock))` via `quoteBuy` from the Headquarters port — a purchase never takes
  the purse below `CONSTRUCTION_RESERVE`. Stalls (buys 0) silently at the sim level;
  the UI derives and displays the stall reason from state (Reserve reached vs no
  local stock).
- Launch: the tick `siteStore` completes the Recipe — append a new `Ship` (hold 50,
  empty cargo, docked at the Headquarters port, generated name), clear `buildOrder`.

### Ledger (`src/sim/ledger.ts`, new)

- `World` gains `ledger: readonly LedgerEvent[]`. Event union kinds: `trade` (side,
  good, qty, thalers, shipId, portId, routeId?), `dockingFee`, `autoDraw`, `rush`,
  `delivery`, `laborFee`, `founding`, `launch`, `netWorth` (daily: thalers + fleet
  cargo + siteStore at mid). Cargo and store are valued at the **region-average mid
  price** per good — deterministic, no "which port" ambiguity for underway ships.
- Events are appended by `applyCommand`/tick phases at the point of mutation — one
  source of truth, impossible to drift from actual state changes.
- Serialized with the save (ADR-0004); full retention (design §Ledger).

### Store & UI (`src/store/gameStore.ts`, `src/ui/`)

- Store: route/building actions dispatch Commands (same path as trade actions today);
  selectors for per-route last-loop results (fold ledger by `routeId` between
  consecutive visits to Stop 0), company-value series (netWorth events), fleet list.
- New components: `HeadquartersPanel.tsx` (tabs Budowa/Trasy; route editor rows;
  rush quote via the same sim function), `FleetList.tsx` (replaces
  `ControlledShipHeader.tsx`), `LedgerOverlay.tsx` (transactions + SVG value chart —
  no chart library, ADR-0004 keeps the bundle lean), PortPanel gains the Headquarters
  section (founding button pre-HQ at any port? no — founding lives in PortPanel of the
  candidate port: "Załóż siedzibę — ₸2,500", one button, disabled when unaffordable or
  already founded), `RegionMap.tsx` gains Stop-port highlighting for the Route selected
  in the panel.
- Ship name generator: seeded from world RNG? No — names are cosmetic and
  player-editable; the generator draws from a fixed list keyed by `ship count`
  (deterministic enough, no RNG state consumed — sim RNG stays reserved for world
  events, ADR-0003 note).

### Docs sync

- **CONTEXT.md** — done live at the grill (2026-07-09): Route (template semantics),
  Course (new), Stop (buy/sell/deliver), new section Buildings & construction
  (Building, Headquarters, Recipe + labor fee, Build Order, Docking fee), Ledger
  (E9 implementation note). Verify only.
- **PRD** — rewrite the E9 bullet (construction replaces purchase; link this spec);
  add the "buildings introduce mechanics" principle; Beyond/M3 hooks: branch offices,
  region administrator, build queue, assembly time, HQ relocation, map route drawing;
  "Company running costs" hook notes the docking fee shipped its first slice.
- **`goods.ts`** — timber comment correction (in the rename PR).
- **E2 spec** — Commands section gets a pointer here (command set grew; load/unload
  wording superseded).
- **Design notes** — playtest-2026-07-09-living: grill-input items get
  "Resolved → spec" blockquotes.
- **Issues** — #54 and #56 retargeted into the E9 milestone; #54's scope lands inside
  the fleet-list issue (comment + close-by that PR).
- No new ADR: nothing here is hard to reverse; calibrations declared tunable.
- **Amendment 2026-07-12 (#122 grill — the Reserve)**: CONTEXT.md gains the Reserve
  entry and the Build Order entry's stall wording is corrected ("stalls at the
  Reserve", not "purse run dry"); E3 spec §Upkeep gains the named insolvency gap
  (grill input via #95); the fresh-eyes playtest note's finding section gets its
  "Resolved → spec" blockquote; final acceptance criteria posted as a comment on
  #122.

## Testing

- Sim (Vitest, TDD):
  - **Determinism**: same seed + same command script (incl. route CRUD, founding,
    builds) ⇒ deep-equal world and byte-equal Ledger after N days.
  - **Route execution**: orders best-effort (stock-, purse-, hold-limited); ships race
    in `ships[]` order; loop wraps; template edit picked up at next Stop; shortening
    wraps index to 0; delete clears assignment after Course completes; suspend on
    manual `sailTo`; resume targets next Stop in order.
  - **Equivalence guarantee**: a Route's trades produce the same world state as the
    identical manual command sequence — routes get no special math (the spec's core
    promise, encoded).
  - **Construction**: auto-draw respects daily cap, stock, purse (stall = buy 0, no
    error); deliver caps at remaining need, leftovers stay aboard; rush cost equals
    `quoteBuy` of the remainder and is stock-limited; launch exactly on completion —
    new ship docked/empty/named at the HQ port; second `placeBuildOrder` rejected while
    one runs; labor fee charged once.
  - **Fees**: charged per docking (manual and routed), not on pass-through; empty purse
    clamps at 0, never negative.
  - **Ledger**: every purse/cargo/stock mutation has exactly one event; netWorth math
    matches state recomputation; route events carry `routeId`.
  - **Economics guardrail**: on the standard seed, a scripted 2-ship company running a
    producer→consumer loop recoups `LABOR_FEE + recipe market cost` within 40 world
    days of the second ship's launch (payback target, encoded loosely).
- UI (Playwright E2E): found the Headquarters from a PortPanel; create a Route, assign
  the ship, watch it execute a loop (seeded fast scenario); manual sailTo shows
  "suspended", resume continues; Build Order progress renders per good; rush button
  shows a quote and executes; fleet list designates Controlled Ship; Ledger overlay
  opens with transactions and chart; HQ port's PortPanel shows the build progress bar.
- Manual playtest: does founding feel like a milestone; does route rot get *noticed*
  (the last-loop number does its job); does 100× displace 10× once routes run; recipe
  pacing (10–15 day auto-draw, 2–3 with deliveries); fee "small but felt" check at
  1 ship vs 4 ships.

## Issue cut

Milestone **E9 — Fleet & routes** (filed 2026-07-09).

| Issue | Track | Scope | Depends on |
| --- | --- | --- | --- |
| #79 | sim | `refactor(sim)`: rename route→course everywhere + goods.ts timber comment correction | — |
| #80 | sim | `feat(sim)`: Route/Stop model, route Commands (CRUD/assign/suspend/resume), docking phase + fees, Course dispatch | #79 |
| #81 | sim | `feat(sim)`: Headquarters + Build Order (found, place, auto-draw, deliver, rush, launch) + ship names | #79 |
| #82 | sim | `feat(sim)`: Ledger events + daily net-worth snapshots | #80, #81 |
| #83 | ui | `feat(ui)`: fleet list replacing Controlled Ship header (+ names UI; closes #54) | #80, #81 |
| #84 | ui | `feat(ui)`: Headquarters panel — Budowa tab + PortPanel section (founding, progress, rush) | #81 |
| #85 | ui | `feat(ui)`: Headquarters panel — Trasy tab (route editor, loop metrics, last-loop result) + map Stop highlighting | #80, #82 |
| #86 | ui | `feat(ui)`: performance board overlay (transactions + company value chart) | #82 |
| #56 | ui | speed/pause hotkeys (existing issue, pulled into the milestone) | — |

Sequencing note: E9 closes M2 — it runs on top of E8's gradients (routes are frozen bets
on them) and E10's geometry (Course dispatch, Stop highlighting). The rename is the
keystone PR; the two sim tracks (routes, construction) parallelize after it, meeting in
the Ledger issue; UI tracks parallelize against sim as their dependencies land. After E9
ships: re-review the E11 draft against the shipped Ledger schema (owner decision,
2026-07-09).
