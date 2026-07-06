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
_Implementation_: UI follow-up #28 — not in build yet; baseline uses port/ship panel toggle.
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

**Region template** (PL: szablon regionu):
Data describing how to generate a region: port count range, archetype weights, lane density, name pools. Worldgen = seed + template.
_Avoid_: map config, preset

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

### Player & ships

**Company** (PL: kompania):
The player's trading enterprise; owns ships and thalers.
_Avoid_: player (in sim code), corporation

**Ship** (PL: statek):
A vessel owned by a company; carries cargo along lanes.
_Avoid_: vessel, boat

**Controlled Ship** (PL: kontrolowany statek):
The Ship that the player has designated to receive Commands (e.g. `sailTo`, `buy`, `sell`). The UI maintains exactly one Controlled Ship at a time. Designating happens by clicking a player Ship on the map (when appropriate) or in the Harbor list, or by opening its ShipPanel. A small always-visible header shows the current Controlled Ship.
_Implementation_: UI follow-ups #28, #32 — not in build yet; baseline hardcodes `ships[0]` and uses panel `selection` for focus only.
_Avoid_: active ship, selected ship (to distinguish from UI panel selection)

**Hold** (PL: ładownia):
A ship's cargo capacity.
_Avoid_: capacity, storage

**Cargo** (PL: ładunek):
The goods currently aboard a ship.
_Avoid_: freight, load

**Route** (PL: trasa):
An ordered sequence of lanes a ship is assigned to follow.
_Avoid_: itinerary, plan

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
