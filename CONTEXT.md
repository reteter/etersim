# etersim

Single-player trading and economy simulation set in an aether-punk world where magic openly exists. The player runs a trading company sailing the aether between ports of a living, simulated economy.

## Language

### World & setting

**Aether** (PL: eter):
The physical medium filling the space between worlds; ships sail through it like an ocean.
_Avoid_: space, void, ether

**Region** (PL: region):
A bounded area of aether containing ports and lanes; the playable map. v1 has exactly one.
_Avoid_: sector, galaxy, system

**Port** (PL: port):
Any dockable location with a market — a planet harbor, a station, a floating enclave.
_Avoid_: city, planet, station (as gameplay terms)

**Harbor** (PL: przystań):
The docking area of a Port where Ships reside while docked. Selecting a Port in the UI displays its Harbor (player's ships separated from others) above the market; hover on a listed Ship shows a summary (Hold usage and Cargo). Docked player Ships are accessed via the Harbor list rather than direct map clicks.
_Implementation_: shipped in #28 — the port view shows the Harbor above the market (player's docked ships; other companies' ships not modelled in E2). Hover shows Hold + Cargo.
_Avoid_: dock, berth (as first-class terms)

**Lane** (PL: szlak):
A navigable connection between two ports; an edge of the region graph.
_Avoid_: path, link, connection

**Aether current** (PL: prąd eteru):
A directional flow along a lane that shortens or lengthens voyage time.
_Avoid_: wind, stream

**Port archetype** (PL: archetyp portu):
A port's economic role assigned at worldgen (agrarian, industrial, urban, mining, verdant); defines its production/consumption profile. E12 (M3) adds a sixth, the Free port — the one Port archetype that is not an Economic archetype.
_Avoid_: port type, class, specialization

**Economic archetype** (PL: archetyp ekonomiczny):
The five producing Port archetypes — agrarian, industrial, urban, mining, verdant — each with a production/consumption gradient and (from E3) a Guild. The worldgen weighted draw pool and the Guild domain are keyed on these five; the Free port is the one Port archetype that is *not* an Economic archetype (neutral, no gradient, no Guild).
_Implementation_: E12 (PRD M3) — `EconomicArchetype` type + `ECONOMIC_ARCHETYPES`; `PortArchetype = EconomicArchetype | "freeport"`. Not in build yet.
_Avoid_: weighted archetype, guild archetype

**Free port** (PL: wolny port):
The sixth Port archetype (E12): no dominant production or consumption, price bias ~1.0 —
an economic crossroads, not a factory. Exactly one per region. No Guild has a seat there
and no Contracts originate there — the region's neutral ground; the one place any guild
Building may be built regardless of archetype.
_Implementation_: E12 (PRD M3) — not in build yet.
_Avoid_: neutral port (as identifier), hub, freeport (one word, in prose)

**Archetype palette** (PL: paleta archetypów):
The five design-token colors, one per Port archetype, used consistently across the map
(planet disc tint), panels and future charts. Color aids recognition; the archetype icon
carries the meaning (colorblind-safe).
_Implementation_: E10 — rendered in `src/index.css` (#44); disc tint is its only consumer
so far, panels/charts to follow as they need it.
_Avoid_: theme colors, port colors (as identifiers)

**Region template** (PL: szablon regionu):
Data describing how to generate a region: port count range, archetype weights, lane density, name pools. Worldgen = seed + template.
_Avoid_: map config, preset

**Orrery view** (PL: widok planetarium):
The map presentation of a Region as a planetary system: ports on static orbit rings around
a central star. Purely visual in M2 — positions do not change over world time (real orbital
motion is a parked E5 candidate) and the star has no mechanics.
_Implementation_: E10 ([spec](docs/specs/E10-orrery-view.md)) — positions from #43, rendering
(star, rings, planet discs, glow) shipped in #44, lane accents + tick labels in #45. Epic
complete (#43/#25/#34/#44/#45 all merged).
_Avoid_: solar system, starmap (as identifiers)

**Orbit ring** (PL: pierścień orbity):
A concentric circle around the Region's center on which exactly one Port sits. Radii are
deterministic (evenly spaced across the template's range); the port's angle is the seeded
randomness. Presentation-side geometry — a port's radius carries no mechanics.
_Implementation_: E10 — placement in worldgen (#43); rendered as a faint circle per port,
radius recovered from its position (#44).
_Avoid_: orbit (alone, in identifiers), track

### Trade & economy

**Good** (PL: towar):
A tradable commodity type (e.g. grain, aether salt).
_Avoid_: item, resource, commodity

**Arcane good** (PL: towar magiczny):
A category of goods of magical origin or use. Flows through the same market mechanisms as any other good — there is no separate magic system.
_Avoid_: spell, artifact (as economy terms)

**Market** (PL: rynek):
The per-port exchange where goods are bought and sold; prices react to stock changes.
Quotes are two-sided from E8 on: buying pays the ask, selling receives the bid (see Spread).
_Avoid_: shop, exchange

**Stock** (PL: zapas):
The quantity of a good present at a port's market.
_Avoid_: inventory, supply (in identifiers)

**Thaler** (PL: talar):
The currency of the world.
_Avoid_: credit, gold, money (in identifiers)

**Equilibrium** (PL: równowaga):
A market good's reference stock level; the price formula compares current Stock against it,
and production/consumption push stock toward it. Worldgen sets it per port archetype.
_Avoid_: baseline, target stock

**Price bias** (PL: odchylenie cenowe):
A per-port multiplier on a Good's base price — authored per Port archetype (consumers value
a good above the global base, producers below) plus a small seeded per-port jitter. Scales
the whole price curve including floor and ceiling; the source of the region's structural
price gradients.
_Implementation_: shipped in #57 ([spec](docs/specs/E8-living-economy.md)) — `Port.priceBias`,
drawn once in worldgen (`ARCHETYPE_BIAS` × per-good jitter); `effectiveBase(port, good)` is the
anchor the whole price curve scales around.
_Avoid_: price modifier, base multiplier (as loose synonyms)

**Spread** (PL: spread):
The gap between a Market's two-sided quotes: buying pays the marginal-price walk plus the
spread (ask), selling receives it minus the spread (bid). Baked into quotes, shown as two
prices; a money sink — no one collects it. Trends track the mid price (spread-free).
_Implementation_: shipped in #57 ([spec](docs/specs/E8-living-economy.md)) — `quoteBuy`/
`quoteSell` in `src/sim/market.ts` (`SPREAD = 0.025`); the port panel shows both quotes
per good (#61).
_Avoid_: fee, tax, commission (for this mechanism)

**Flow drift** (PL: dryf przepływów):
A per-port, per-good mean-reverting multiplier on production/consumption rates, stepped
once per world day from the seeded RNG. Creates transient disequilibria that elasticity
and Trade osmosis chase; drift breathes, Price bias stands.
_Implementation_: shipped in #60 ([spec](docs/specs/E8-living-economy.md)) — `World.flowDrift`,
stepped once per world day in `tick.ts` (bounds [0.7, 1.3]); invariant and dominance-guardrail
suites land alongside it.
_Avoid_: randomness, noise (in identifiers)

**Trade osmosis** (PL: osmoza handlowa):
Background goods flow along Lanes from cheaper ports to more expensive ones, proportional
to the price gap beyond a deadband, attenuated by lane length and capped per tick; rendered
as small ambient pulses on lanes, but it is a flow — no simulated NPC agents.
_Implementation_: shipped in #59/#60 ([spec](docs/specs/E8-living-economy.md)) — `osmosisTick`
wired into the tick each world hour, `World.osmosisPulse` carries the per-lane signal; #63
renders it as ambient pulses on the map (static, opacity-scaled under `prefers-reduced-motion`).
_Avoid_: NPC trade, AI traders (as sim terms)

**Price board** (PL: tablica cen):
The region-wide economic overlay: all Ports × all Goods in one table with bid/ask and
trend per cell, highlighting the cheapest ask and highest bid per good. Full information
in M2 (fog is a parked E6 candidate).
_Implementation_: shipped in #62 ([spec](docs/specs/E8-living-economy.md)) —
`PriceBoardOverlay.tsx`, opened from the TopBar button or the `B` hotkey; rows are ports,
columns goods, cheapest-ask / highest-bid highlighted per good, docked row marked.
_Avoid_: market overview, economy screen (as identifiers)

### Player & ships

**Company** (PL: kompania):
The player's trading enterprise; owns ships and thalers.
_Avoid_: player (in sim code), corporation

**Ship** (PL: statek):
A vessel owned by a company; carries cargo along lanes. Every Ship carries a display
`name` from the moment it exists — the starting ship on new game and every launched
ship alike — never a raw id.
_Implementation_: name shipped in #83/#54 — generated from a fixed cosmetic pool keyed
by ship count (`generateShipName`, no sim RNG draw, ADR-0003), player-editable in the
ShipPanel (`renameShip` command). `FleetList.tsx` and every other UI surface show the
name, never `ship.id`.
_Avoid_: vessel, boat

**Fleet** (PL: flota):
The Company's full set of Ships, listed and status-tracked together — every Ship's
name, status (docked / underway / on route / suspended) and assigned Route, always
visible at the top of the side panel. A roster view, not a mechanic of its own; the
Fleet list is where the player designates the Controlled Ship.
_Implementation_: shipped in #83 — `FleetList.tsx`, replacing the single-ship
`ControlledShipHeader` (#32) once the fleet grew past one ship (E9).
_Avoid_: fleet-lite (PRD placeholder term, retired), armada, squadron

**Controlled Ship** (PL: kontrolowany statek):
The Ship that the player has designated to receive Commands (e.g. `sailTo`, `buy`, `sell`). The UI maintains exactly one Controlled Ship at a time. Designating happens by clicking a player Ship on the map (when appropriate), in the Harbor list, or in the Fleet list.
_Implementation_: shipped in #28, #32 — the store holds `controlledShipId` (distinct from panel `selection`); designated via map click, Harbor list, or the Fleet list. Commands target it. `FleetList.tsx` (#83) replaced the earlier single-ship `ControlledShipHeader` once the fleet grew past one ship (E9).
_Avoid_: active ship, selected ship (to distinguish from UI panel selection)

**Hold** (PL: ładownia):
A ship's cargo capacity.
_Avoid_: capacity, storage

**Cargo** (PL: ładunek):
The goods currently aboard a ship.
_Avoid_: freight, load

**Route** (PL: trasa):
A Company-level template: a looping, ordered list of port Stops, created and edited in the
Headquarters' Route panel. Assigned to Ships **by reference** — one Route can sail on many
Ships at once, and editing the template applies to every assigned Ship from its next Stop
(an index left out of range wraps to Stop 0; deleting an assigned Route lets ships finish
their current Course, then leaves them routeless). Routes carry no price or wait
conditions — a route is a frozen bet that its spreads keep paying. A manual order to a
routed Ship suspends the Route (it stays assigned); resuming sails to the next Stop in
order. Ship-side state: `(routeId, next Stop index, suspended?)`.
_Implementation_: sim model + semantics shipped in #80 (`route.ts`, route Commands, the
docking-phase route pass in `tick.ts`); assignable Routes need ≥ 2 Stops over ≥ 2 distinct
ports. Route-editor UI shipped in #85 (`HeadquartersPanel.tsx` Trasy tab — list-based Stop
editor, assign/unassign, suspend/resume, loop metrics; `RegionMap.tsx` highlights the
selected Route's Stop ports). Naming collision with the old internal `route`
resolved at the E9 grill (2026-07-09): the pathfinding concept is now **Course**; `Route`
is reserved for this player-facing loop.
_Avoid_: itinerary, plan; template (as identifier — every Route is one)

**Course** (PL: kurs):
A pathfinding result — the ordered lane Voyages a Ship sails to execute one `sailTo`
(or to reach the next Stop of a Route). Transient and per-leg, in contrast to the
standing, looping Route.
_Implementation_: rename landed in #79 (E9 keystone PR). Now `shortestCourse`,
`Ship.location.course`, `courseTicks`, `coursePreview.ts`. E10's UI identifiers
(`courseVoyages`, `isCourseAccented`, `.lane--course-accent`) match and were untouched.
(Old names were in sim code before #79.)
_Avoid_: path, leg sequence; route (reserved for the player-facing loop)

**Stop** (PL: przystanek):
One entry of a Route: a Port plus its orders, each naming its economic effect — **buy**
(good → fill available Hold at ask), **sell** (good → sell all at bid), **deliver** (good →
transfer cargo to the local build site, up to the recipe's remaining need). Orders execute
best-effort on docking ("do what you can and sail on" — no waiting, no conditions), then
the ship departs immediately. A deliver order at a port with no active build is a no-op.
_Implementation_: shipped in #80 — a routed Stop executes by dispatching the same
buy/sell/deliver Commands a player issues (equivalence by construction). A ship dwells one
tick at each Stop before departing (the manual-play quantization + the intervention
window). Order vocabulary locked at the E9 grill (2026-07-09), replacing the earlier
load/unload wording ("unload" became ambiguous once deliver existed). E13 (M3) adds two
order kinds: **store** and **withdraw** (transfer between Cargo and a Storehouse,
market-free — the goods are already yours).
_Avoid_: waypoint, leg; load/unload (pre-E9 wording)

**Voyage** (PL: rejs):
One traversal of a lane by a ship, taking a number of ticks.
_Avoid_: trip, journey

### Buildings & construction

Terms locked at the E9 grill (2026-07-09). Design principle: **buildings introduce
mechanics** — a new gameplay layer arrives with a Building, not with a tutorial. The sim
model (Headquarters, Build Order, auto-draw/deliver/rush, launch) shipped in #81; the
Headquarters-panel UI shipped in #84 (`HeadquartersPanel.tsx` Budowa tab — per-good build
progress, auto-draw rate, stall reason, rush quote/execute; `PortPanel.tsx` gains the
founding button and the HQ port's progress section) and #85 (Trasy tab, see Route above).

**Building** (PL: budynek):
A Company-owned structure at a Port. E9 has exactly one type — the Headquarters; E13
(M3) adds rank-gated guild Buildings (see Storehouse, Building permit). Per-region
*branch offices* stay parked (multi-region hook, PRD). NPC-owned Guildhouses are
world-side and are not Company Buildings.
_Avoid_: structure, facility

**Headquarters** (PL: siedziba):
The Company's founding Building — one per Company, placed at a port of the player's
choice for a flat thaler price, active immediately. Unlocks the orchestration layer: the
Route panel and ship construction. New ships launch docked at the Headquarters port.
Progression beat: manual trader → founder → orchestrator.
_Avoid_: HQ (in identifiers), base, office

**Recipe** (PL: przepis):
The bill of materials for one hull: per-good quantities across all five goods — much
grain (provisions), medium textiles (rigging) and aether salt (hull infusion), a little
electronics (instruments) and a little timber (the living-wood keel, the recipe's
prestigious top) — plus a flat **labor fee** (PL: robocizna) in thalers, charged when the
Build Order is placed.
_Avoid_: blueprint, cost table

**Build Order** (PL: zlecenie budowy):
The active ship construction at the Headquarters — one at a time in E9. Holds the build
site's own material store and fills it from three sources: **auto-draw** (each tick the
site buys missing materials from the Headquarters port's market at the normal ask,
rate-capped per day, paid from the Company purse — it stalls visibly at the Reserve or
when local stock runs dry), **deliveries** (deliver orders and commands), and **rush** (one-click
instant buy of the remainder at the normal market quote, limited by local stock — money
does not teleport timber). The ship launches the moment the Recipe completes, empty and
routeless.
_Avoid_: construction job, project, queue (E9 has none)

**Reserve** (PL: rezerwa):
The ₸500 floor that no construction spend may cross — founding, labor fee, auto-draw
and rush all stop at it; equal to the Company's starting capital, so the rule reads
"building never touches your last starting-purse". Docking fees are deliberately
outside it (pay-what-you-have, no-debt). Born of the agency guarantee (#122 grill,
2026-07-12: the game may slow down, never die — a dead state is a defect).
Calibration is tuning ≠ spec drift.
_Implementation_: shipped in the #122 fix — `CONSTRUCTION_RESERVE`
(`src/sim/building.ts`), enforced at all four points: `foundHeadquarters` and
`placeBuildOrder` gates (`commands.ts`), the auto-draw skip and the
`computeRushQuote` purse cap; the upfront estimate is `computeBuildEstimate`
(same file) behind the Budowa tab's confirmation step.
_Avoid_: buffer, safety margin, minimum balance

**Docking fee** (PL: opłata dokowa):
A flat per-docking charge, differentiated per Port (by archetype/size); paid on every
docking, manual or routed. Sailing through an intermediate port without docking is free.
No debt in E9: an empty purse pays what it has. Its own Ledger event kind — the fixed
cost that makes route rot legible.
_Implementation_: charged in the docking phase (`DOCKING_FEE` in `region.ts`) shipped in
#80 — active for all docking from tick 0, including pre-Headquarters manual play. Its
Ledger event kind (`dockingFee`) shipped in #82.
_Avoid_: port tax, harbor dues, toll

### Guilds & contracts

Terms locked at the M3 grill (2026-07-09). Axis: the region gains faces — institutions
with addresses and demands; reputation is the long-term currency. None of these exist in
the build yet (M3: E12/E3/E13).

**Guild** (PL: gildia):
An NPC institution, one per non-freeport Port archetype — five in a region (working
names: Granary Guild / agrarian, Weavers' Assembly / urban, Saltworkers' Brotherhood /
mining, Foundry League / industrial, Livingwood Consortium / verdant; names are flavor,
tunable). A Guild expresses needs as Contracts and tracks the Company's Rank. Not an
agent: guilds own no ships and make no trades — they read the same living economy the
player reads.
_Avoid_: faction, NPC company

**Guildhouse** (PL: dom gildii):
A Guild's seat, present at every port of its archetype. World-side (NPC-owned) — not a
Company Building. Enrollment happens here; its PortPanel section shows rank and
cooperation history.
_Avoid_: guild hall, office

**Enrollment** (PL: wstąpienie):
The one-time act (plus thaler fee) of joining a Guild — requires a founded Headquarters
(companies deal with guilds, lone shippers don't) and grants Rank 1. Like founding, it
is paperwork: no ship presence required. Which guilds to join first is a strategic
choice, not a checklist.
_Avoid_: membership (as identifier), subscription

**Rank** (PL: ranga):
The Company's discrete standing with one Guild: four steps, a facade over hidden
progress points (settled period +, missed period −, breach −−; ranks can fall). Rank
gates which Contract tiers the guild offers and which Building permits it grants.
_Avoid_: level, reputation score (as identifiers)

**Reputation** (PL: reputacja):
The substance under Ranks and the *only* currency of contract consequences — no thaler
penalties, ever (no-debt precedent). Earned slower than it is lost; a deliberately
unprofitable contract held for reputation is an investment (the loss-leader play).
_Avoid_: karma, favor

**Contract** (PL: kontrakt):
A continuous service obligation offered by a Guild: *keep delivering* ≥ quota units of a
Good to a Port per Settlement period, for at least K periods. Not a one-shot errand.
Offers are generated deterministically from real shortages (stock far below Equilibrium)
and sized from real geometry (`shortestCourse`, hold capacity) so they are feasible by
construction; the offer shows its own basis ("expected ~2 trips/period, nearest source:
…"). The market pays bid for the goods as in any sale; the Guild pays a flat fee per met
period — the market pays for goods, the guild pays for reliability. Contracts add no
waiting mechanics: fulfilment is read from the Ledger after the fact.
_Avoid_: quest, mission, order (collides with Stop orders)

**Settlement period** (PL: okres rozliczeniowy):
A Contract's repeating window of L world days, settled at its final day boundary: quota
met → fee paid + rank progress; missed → no fee + rank step down. Two consecutive missed
periods → the Guild terminates the contract (breach, large rank hit). The player may
resign any time at the same breach cost, shown before confirming.
_Avoid_: deadline, billing cycle

**Contract board** (PL: tablica kontraktów):
The **Kontrakty** tab of the PriceBoardOverlay (same overlay, same `B` hotkey): open
offers of enrolled Guilds plus active contracts with period progress ("period 3/6:
42/50, settles in 2 d"). Each guild keeps ~2–3 open offers, refreshed at day boundaries;
an offer dies causally when its shortage heals. The board is a barometer of the region,
not a quest log.
_Avoid_: quest log, job board

**Building permit** (PL: pozwolenie budowlane):
A Rank-gated right to construct a Guild's Building variant — at ports of that guild's
archetype or at the Free port, nowhere else. The M3 slice of "buildings introduce
mechanics": reputation buys access to new mechanics, not percentages.
_Avoid_: license, unlock (as identifiers)

**Storehouse** (PL: skład):
The guild Building type (E13): port-side storage for the guild's domain goods, finite
capacity, built via the E9 Build Order machinery. One implementation, five guild
variants (variant = accepted-goods filter + skin); E13 ships one — the **Granary**
(PL: spichlerz, Granary Guild, stores grain). Enables arbitrage over time: buy low,
store, sell after the drift — bounded by capacity, spread and the marginal walk.
_Avoid_: warehouse (as identifier), depot

**Upkeep** (PL: utrzymanie):
The daily per-ship fixed cost (E3), its own Ledger event kind. A ship costs thalers even
when idle — fleets should sail or shrink. Calibration principle: a lone starter ship
stays comfortably viable (upkeep must never feel like an unexplained penalty — it ships
only now because the Ledger makes it legible).
_Avoid_: maintenance, wages (crew wages remain a parked, separate idea)

### Harness & evaluation

Terms for the agent-facing evaluation tooling (epic E11 — spec drafted 2026-07-09,
approval deferred until after E9). None of these exist in the build yet.

**Harness** (PL: poligon):
The headless consumer of the simulation for running games without the UI. Imports
`src/sim` like any other consumer — never the other way around; policies and runner live
outside the sim module.
_Implementation_: E11 ([spec draft](docs/specs/E11-proving-grounds.md)) — not in build yet.
_Avoid_: test rig, sandbox

**Policy** (PL: polityka):
A deterministic, parameterized playing strategy: a pure function
`(world, memory) → { commands, memory }` polled every Tick. May read the full `World`
but is honor-bound to player-visible information; policies that read sim internals
(e.g. flow drift) must be marked diagnostic.
_Avoid_: bot (colloquial in tests is fine), AI, strategy (in identifiers)

**Run** (PL: przebieg):
One full game: Policy + seed + day horizon → outcome metrics + Ledger. Fully
reproducible by construction.
_Avoid_: game, session (in identifiers)

**Batch** (PL: seria):
N Runs over a seed/parameter grid, aggregated into one report (medians, spreads,
head-to-head policy comparisons, anomaly list with replayable seeds).
_Avoid_: sweep, suite (in identifiers)

**Ledger** (PL: księga):
The canonical event stream of a Company's activity: every thaler or goods movement —
trades (manual and routed), docking fees, build-site auto-draw and rush purchases,
deliveries, labor fees, the Headquarters founding, ship launches — tagged with tick,
ship, port and originating Route where applicable, plus daily net-worth snapshots
(thalers + fleet cargo + build-site store, all at mid price; ships and buildings carry
no book value, so the chart tells the honest investment story: a build is a visible dip,
then steeper growth). Full retention. One schema, two consumers: the in-game performance
board (E9) and the Harness (E11).
_Implementation_: event stream + daily net-worth snapshots shipped in #82 (`ledger.ts`,
`World.ledger`); events are appended by `applyCommand`/tick phases at the point of
mutation, full retention, serialized with the save. `routeId` is carried on `trade`
events only (route-driven trades) — the Tech union's exact contract. The in-game
performance board (`LedgerOverlay.tsx`) shipped in #86 — Transakcje (transaction list,
per-ship filter) and Wartość firmy (SVG company-value chart, no library). A **transaction**
(UI-only term, not a distinct sim type) is any Ledger event except a netWorth snapshot —
the Transakcje tab's row unit. The E11 Harness consumer is still pending. M3 extends the
kind union (contract fees, enrollment fees, upkeep, store/withdraw) and adds a third
consumer: contract settlement reads fulfilment from the same stream.
_Avoid_: log, history (as identifiers)

**Direct play** (PL: gra bezpośrednia):
Harness mode where an agent issues Commands step by step (state JSON out, command JSON
in). Every session is logged as a command script, so it becomes a deterministic,
replayable Run.
_Avoid_: interactive mode

**Replay** (PL: powtórka):
Re-execution of a Run or a Direct play session from its recorded script, tick-for-tick
identical (ADR-0003).
_Avoid_: —

**Experiment** (PL: eksperyment):
A research question + its Batches + the agent's written conclusions, filed as a dated
document in `docs/experiments/`. Closes the loop: experiment → findings → grill inputs.
_Avoid_: study

### Simulation

**Tick** (PL: tick):
The atomic simulation step; 1 tick = 1 world hour. All state changes happen on tick boundaries.
_Avoid_: frame, step, update

**Command** (PL: rozkaz):
A player order handed to the simulation and applied at a tick boundary (e.g. buy, sell, assign route).
_Avoid_: action, order, input (in identifiers)

**Speed** (PL: prędkość):
The UI-selected playback rate of world time: paused, 1x, 10x or 100x. Purely presentational — it never changes what a tick does.
_Avoid_: time scale, game speed (in identifiers)

**World** (PL: świat):
The complete simulation state; serializable and deterministic given seed and player commands.
_Avoid_: game state, universe
