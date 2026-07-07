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
A port's economic role assigned at worldgen (agrarian, industrial, urban, mining, verdant); defines its production/consumption profile.
_Avoid_: port type, class, specialization

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

**Trade osmosis** (PL: osmoza handlowa):
Background goods flow along Lanes from cheaper ports to more expensive ones, proportional
to the price gap. The region's self-balancing mechanism; rendered as ambient ships on
lanes, but it is a flow — no simulated NPC agents.
_Implementation_: E8 (PRD M2) — not in build yet.
_Avoid_: NPC trade, AI traders (as sim terms)

### Player & ships

**Company** (PL: kompania):
The player's trading enterprise; owns ships and thalers.
_Avoid_: player (in sim code), corporation

**Ship** (PL: statek):
A vessel owned by a company; carries cargo along lanes.
_Avoid_: vessel, boat

**Controlled Ship** (PL: kontrolowany statek):
The Ship that the player has designated to receive Commands (e.g. `sailTo`, `buy`, `sell`). The UI maintains exactly one Controlled Ship at a time. Designating happens by clicking a player Ship on the map (when appropriate) or in the Harbor list, or by opening its ShipPanel. A small always-visible header shows the current Controlled Ship.
_Implementation_: shipped in #28, #32 — the store holds `controlledShipId` (distinct from panel `selection`); designated via map click, Harbor list, or the always-visible header. Commands target it. E2 has a single ship.
_Avoid_: active ship, selected ship (to distinguish from UI panel selection)

**Hold** (PL: ładownia):
A ship's cargo capacity.
_Avoid_: capacity, storage

**Cargo** (PL: ładunek):
The goods currently aboard a ship.
_Avoid_: freight, load

**Route** (PL: trasa):
A looping, ordered list of port Stops assigned to a Ship; the ship sails them in order and
starts over after the last. Routes carry no price or wait conditions — a route is a frozen
bet that its spreads keep paying.
_Implementation_: E9 (PRD M2) — not in build yet. ⚠ Naming collision to resolve in the E9
spec: current sim code uses `route` (`shortestRoute`, `Ship.location.route`, `routeTicks`)
for a pathfinding result — a lane sequence for one `sailTo`. That internal concept needs a
new name (candidate: **Course**, PL: kurs) so `Route` can mean the player-facing loop.
⚠ E10 (#45) already used "course" as a UI-only identifier prefix (`RegionMap.tsx`:
`courseVoyages`, `isCourseAccented`, CSS `.lane--course-accent`) for "the Controlled Ship's
active course" (spec wording) — a presentational read of the same `Ship.location.route`
data. Not a domain-term lock, but the E9 grill should account for it when resolving the
collision (rename together, or confirm the UI usage stays compatible with the final name).
_Avoid_: itinerary, plan

**Stop** (PL: przystanek):
One entry of a Route: a Port plus its load/unload orders (unload good → all; load good →
fill available Hold). Executed on docking, then the ship sails on immediately.
_Implementation_: E9 (PRD M2) — not in build yet.
_Avoid_: waypoint, leg

**Voyage** (PL: rejs):
One traversal of a lane by a ship, taking a number of ticks.
_Avoid_: trip, journey

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
