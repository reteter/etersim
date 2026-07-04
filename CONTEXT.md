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

**Lane** (PL: szlak):
A navigable connection between two ports; an edge of the region graph.
_Avoid_: path, link, connection

**Aether current** (PL: prąd eteru):
A directional flow along a lane that shortens or lengthens voyage time.
_Avoid_: wind, stream

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

**World** (PL: świat):
The complete simulation state; serializable and deterministic given seed and player commands.
_Avoid_: game state, universe
