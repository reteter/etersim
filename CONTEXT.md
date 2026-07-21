# etersim

Single-player trading and economy simulation set in an aether-punk world where magic openly exists.
The player runs a trading company sailing the aether between ports of a living, simulated economy.

## Language

### World & setting

**Aether** (PL: eter):
The physical medium filling the space between worlds;
ships sail through it like an ocean.
_Avoid_:
space, void, ether

**Region** (PL: region):
A bounded area of aether containing ports and lanes;
the playable map.
v1 has exactly one.
_Avoid_:
sector, galaxy, system

**Lens ladder** (PL: drabina soczewki):
The game's long-term macro-structure (owner grill, 2026-07-15):
four self-similar levels —
Region → Multiregion → Galaxy → the Unknown.
At each step the lens recedes:
the previous level's whole map becomes a single tradable node of the next one, the player's current
job is taken over by a delegate mechanic (administrators, governors, policies — delegation is
optional, manual play always remains), and the new level arrives with its own mechanics layer.
1.0 ends at the first recession of the lens.
See PRD §Long-term fantasy.
_Avoid_:
endgame ladder, meta progression, prestige (as identifiers)

**Great Work** (PL: Wielka Budowa):
The finale mechanic of a Lens ladder level:
a super-construction commissioned by that level's institutions (Region level: the Guilds, via
Contracts) that consumes streams of many Goods at once, generalizing the E9 Build Order machinery.
Completing it opens the next level of the ladder;
the Region's Great Work (working name: the Expedition) is 1.0's ending.
Fractal by design —
each level re-instantiates it with that level's institutions as the commissioner.
_Avoid_:
megaproject, wonder, super-build (as identifiers; "Super Budowa" was the grill-session working name)

**Dispatch** (PL: depesza):
An in-world news item —
the voice of the region's gazette, **Głos Eteru** (Polish proper name, nominative; Victorian-press
tone).
A Dispatch states cause, place and expected duration of a happening —
never price conclusions:
the reader does the pricing.
The one narrative channel that grows with the game:
M4's economic events, M5's guild convocation and construction milestones, M6's second-region news
and administrator nomination all arrive as Dispatches.
Locked at the fantasy-roadmap grill (2026-07-16);
no implementation yet (M4 grill decides the surface — see
docs/design-notes/grill-brief-m4-events-and-ice.md).
_Avoid_:
news, notification, event popup (as identifiers);
gazette (for the item — that's the masthead)

**Administrator** (PL: zarządca):
The delegate mechanic of the first lens recession (M6):
a **character, not sliders** —
nominated by the guild convent, confirmed by the player, given a coarse verbal **mandate** (PL:
mandat; e.g. "don't fear risk", "grow the fleet").
The delegated region folds into reports in the administrator's voice;
manual play always remains (Lens ladder law).
Architectural note, flagged not locked:
E11's Policy is the embryo of this mechanic.
No implementation;
the M6 grill owns it (see docs/design-notes/grill-brief-m6-zoom-out.md).
_Avoid_:
governor (reserved for the Galaxy level), manager, AI player

**Port** (PL: port):
Any dockable location with a market —
a planet harbor, a station, a floating enclave.
_Avoid_:
city, planet, station (as gameplay terms)

**Harbor** (PL: przystań):
The docking area of a Port where Ships reside while docked.
Selecting a Port in the UI displays its Harbor (player's ships separated from others) above the
market;
hover on a listed Ship shows a summary (Hold usage and Cargo).
Docked player Ships are accessed via the Harbor list rather than direct map clicks.
_Implementation_:
shipped in #28 —
the port view shows the Harbor above the market (player's docked ships; other companies' ships not
modelled in E2).
Hover shows Hold + Cargo.
_Avoid_:
dock, berth (as first-class terms)

**Lane** (PL: szlak):
A navigable connection between two ports;
an edge of the region graph.
_Avoid_:
path, link, connection

**Aether current** (PL: prąd eteru):
A directional flow along a lane that shortens or lengthens voyage time.
_Avoid_:
wind, stream

**Port archetype** (PL: archetyp portu):
A port's economic role assigned at worldgen (agrarian, industrial, urban, mining, verdant);
defines its production/consumption profile.
E12 (M3) adds a sixth, the Free port —
the one Port archetype that is not an Economic archetype.
_Avoid_:
port type, class, specialization

**Economic archetype** (PL: archetyp ekonomiczny):
The five producing Port archetypes —
agrarian, industrial, urban, mining, verdant —
each with a production/consumption gradient and (from E3) a Guild.
The worldgen weighted draw pool and the Guild domain are keyed on these five;
the Free port is the one Port archetype that is *not* an Economic archetype (neutral, no gradient,
no Guild).
_Implementation_:
shipped in #146/#147 —
`EconomicArchetype` type + `ECONOMIC_ARCHETYPES` (`region.ts`);
`PortArchetype = EconomicArchetype | "freeport"`,
`PORT_ARCHETYPES = [...ECONOMIC_ARCHETYPES, "freeport"]`.
_Avoid_:
weighted archetype, guild archetype

**Free port** (PL: wolny port):
The sixth Port archetype (E12):
no production, light balanced consumption, price bias exactly 1.0 (no jitter) —
an economic crossroads, not a factory.
Exactly one per region.
No Guild has a seat there and no Contracts originate there —
the region's neutral ground;
the one place any guild Building may be built regardless of archetype.
_Implementation_:
shipped in #146/#147 —
`ARCHETYPE_PROFILES.freeport`, `ARCHETYPE_BIAS.freeport` (exactly 1.0 for every good),
`DOCKING_FEE.freeport` (`region.ts`);
worldgen guarantees exactly one per region and skips its price-bias jitter (`worldgen.ts`).
UI (palette token, icon, PortPanel label) is #148, not yet shipped.
_Avoid_:
neutral port (as identifier), hub, freeport (one word, in prose)

**Archetype palette** (PL: paleta archetypów):
The five design-token colors, one per Port archetype, used consistently across the map (planet disc
tint), panels and future charts.
Color aids recognition;
the archetype icon carries the meaning (colorblind-safe).
_Implementation_:
E10 —
rendered in `src/index.css` (#44);
disc tint is its only consumer so far, panels/charts to follow as they need it.
_Avoid_:
theme colors, port colors (as identifiers)

**Region template** (PL: szablon regionu):
Data describing how to generate a region:
port count range, archetype weights, lane density, name pools.
Worldgen = seed + template.
_Avoid_:
map config, preset

**Orrery view** (PL: widok planetarium):
The map presentation of a Region as a planetary system:
ports on static orbit rings around a central star.
Purely visual in M2 —
positions do not change over world time (real orbital motion is parked; long-crossings candidate,
PRD §Long-term fantasy) and the star has no mechanics.
_Implementation_:
E10 ([spec](docs/specs/E10-orrery-view.md)) —
positions from #43, rendering (star, rings, planet discs, glow) shipped in #44, lane accents + tick
labels in #45.
Epic complete (#43/#25/#34/#44/#45 all merged).
_Avoid_:
solar system, starmap (as identifiers)

**Orbit ring** (PL: pierścień orbity):
A concentric circle around the Region's center on which exactly one Port sits.
Radii are deterministic (evenly spaced across the template's range);
the port's angle is the seeded randomness.
Presentation-side geometry —
a port's radius carries no mechanics.
_Implementation_:
E10 —
placement in worldgen (#43);
rendered as a faint circle per port, radius recovered from its position (#44).
_Avoid_:
orbit (alone, in identifiers), track

### Trade & economy

**Good** (PL: towar):
A tradable commodity type (e.g. grain, aether salt).
_Avoid_:
item, resource, commodity

**Arcane good** (PL: towar magiczny):
A category of goods of magical origin or use.
Flows through the same market mechanisms as any other good —
there is no separate magic system.
_Avoid_:
spell, artifact (as economy terms)

**Aether ice** (PL: eteryczny lód):
The region's first Arcane good (M4, Arcana split installment 1).
Ordinary goods obey four market laws —
elasticity, osmosis, flow drift, storability;
Aether ice visibly breaks exactly one: **it perishes**
(stock decays daily, in Holds and in port markets alike), with a corollary carried by the fiction —
Trade osmosis won't move it (skiffs don't take cargo that dies in transit), so price gradients stay
steep and the player is the only equalizer.
Storage arbitrage is impossible by nature.
Rhyme:
the historical Victorian ice trade —
melt was a line in the margin.
Locked at the fantasy-roadmap grill (2026-07-16);
numbers, source geometry and consumption fiction belong to the M4 grill
(docs/design-notes/grill-brief-m4-events-and-ice.md).
Decay applies everywhere —
Holds, markets, building stores —
no exceptions (E15 grill).
Future industrial role:
chain-3 input (coolant) of the Processing plant.
Polish vocabulary law (owner, 2026-07-16): **eteryczny**
for nature (eteryczny lód), and **eterowy** for industrial products (eterowy superprzewodnik) —
deliberate asymmetry.
_Avoid_:
ether ice, ice (alone, in identifiers)

**Provisions** (PL: prowiant):
The first processed good (E15, chain 1: grain + textiles → provisions):
preserved rations —
hard-labor ports eat tinned, not fresh.
Like every processed good it is a full market citizen (quotes, spread, osmosis, storable) that **no port produces**
—
the world's only producer is industry, i.e. the player;
consumption is narrow (two archetypes).
Workaday chain, and the crew stream of the future Expedition (M5).
_Avoid_:
rations, food (as identifiers)

**Clearwood** (PL: przezroczyste drewno):
The second processed good (E15, chain 2: aether salt + timber → clearwood):
living wood with the pigment drawn out of its structure —
transparent, UV-blocking, naturally warm;
better than glass and priced like it knows it (real transparent-wood material science with the
aether written in).
The super-luxury good;
narrow consumption (metropolitan elite, mining magnates);
premium hull material of the future Expedition (M5) —
the player flies into the unknown first class.
_Avoid_:
transparent wood (in identifiers), glasswood

**Market** (PL: rynek):
The per-port exchange where goods are bought and sold;
prices react to stock changes.
Quotes are two-sided from E8 on:
buying pays the ask, selling receives the bid (see Spread).
_Avoid_:
shop, exchange

**Stock** (PL: zapas):
The quantity of a good present at a port's market.
_Avoid_:
inventory, supply (in identifiers)

**Thaler** (PL: talar):
The currency of the world.
_Avoid_:
credit, gold, money (in identifiers)

**Equilibrium** (PL: równowaga):
A market good's reference stock level;
the price formula compares current Stock against it, and production/consumption push stock toward
it.
Worldgen sets it per port archetype.
_Avoid_:
baseline, target stock

**Price bias** (PL: odchylenie cenowe):
A per-port multiplier on a Good's base price —
authored per Port archetype (consumers value a good above the global base, producers below) plus a
small seeded per-port jitter.
Scales the whole price curve including floor and ceiling;
the source of the region's structural price gradients.
_Implementation_:
shipped in #57 ([spec](docs/specs/E8-living-economy.md)) —
`Port.priceBias`, drawn once in worldgen (`ARCHETYPE_BIAS` × per-good jitter);
`effectiveBase(port, good)` is the anchor the whole price curve scales around.
_Avoid_:
price modifier, base multiplier (as loose synonyms)

**Spread** (PL: spread):
The gap between a Market's two-sided quotes:
buying pays the marginal-price walk plus the spread (ask), selling receives it minus the spread
(bid).
Baked into quotes, shown as two prices;
a money sink —
no one collects it.
Trends track the mid price (spread-free).
_Implementation_:
shipped in #57 ([spec](docs/specs/E8-living-economy.md)) —
`quoteBuy`/ `quoteSell` in `src/sim/market.ts` (`SPREAD = 0.025`);
the port panel shows both quotes per good (#61).
_Avoid_:
fee, tax, commission (for this mechanism)

**Market impact** (PL: wpływ na rynek):
The price movement a Company's own trades cause:
buying walks the marginal price up as it drains Stock, selling walks it down as it floods Stock (the
same curve that anchors on Equilibrium and Price bias).
The effect is durable until elasticity and Trade osmosis restore equilibrium, so concentrating
volume on one Lane has diminishing returns —
two ships on a single Route compress that Route's margin against themselves, and on a thin gradient
a second hull can earn less than one.
Emergent from the price curve, not a separate mechanism;
the reason second-ship payback is lane-conditional (E9 spec — Pacing).
_Avoid_:
slippage, price elasticity (that names the production/consumption response, not this), demand shock

**Elasticity** (PL: elastyczność):
The response of a port's **production and consumption rates to price**:
production speeds up when price is high (scarcity) and slows when it is low (glut);
consumption is the mirror.
Both are linear in the price ratio, equal 1× at Equilibrium stock, and clamp softly rather than
stopping —
a crisis, never a standstill.
This is the market's self-correcting law, and one of the four goods obey (with Trade osmosis, Flow
drift and Storability). **Direction matters**:
elasticity is *quantity answering price*.
The reverse —
price answering stock —
is the price curve's exponent, which is deliberately **not** called elasticity (sweep F13).
_Implementation_:
shipped in #57/#60 ([spec](docs/specs/E8-living-economy.md)) —
`FLOW_MULT_MIN = 0.25` / `FLOW_MULT_MAX = 1.5` in `src/sim/market.ts`, applied as `productionMult` /
`consumptionMult` off `priceRatio`;
the price curve's own exponent is `PRICE_CURVE_EXPONENT`, a separate thing.
_Avoid_:
price elasticity (ambiguous — it reads as the price curve), elasticity of price, slippage;
do **not** name the price-curve exponent with this word

**Storability** (PL: trwałość):
The law that a Good **keeps** —
stock sits in a Market, a Hold or a Goods store without decaying, so buying low and waiting is a
real strategy and storage arbitrage is possible.
Silent for ordinary goods precisely because it never fires;
it becomes visible only where it is broken. **Aether ice is the exception that defines it**
(M4):
it perishes daily, everywhere, no exceptions —
which is why Trade osmosis won't carry it and its gradients stay steep.
One of the four market laws (with Elasticity, Trade osmosis and Flow drift).
_Avoid_:
shelf life, spoilage (as identifiers); **skład**
(that is the Storehouse);
perishability (name the law by what holds, not by its exception)

**Flow drift** (PL: dryf przepływów):
A per-port, per-good mean-reverting multiplier on production/consumption rates, stepped once per
world day from the seeded RNG.
Creates transient disequilibria that elasticity and Trade osmosis chase;
drift breathes, Price bias stands.
_Implementation_:
shipped in #60 ([spec](docs/specs/E8-living-economy.md)) —
`World.flowDrift`, stepped once per world day in `tick.ts` (bounds [0.7, 1.3]);
invariant and dominance-guardrail suites land alongside it.
_Avoid_:
randomness, noise (in identifiers)

**Trade osmosis** (PL: osmoza handlowa):
Background goods flow along Lanes from cheaper ports to more expensive ones, proportional to the
price gap beyond a deadband, attenuated by lane length and capped per tick;
rendered as Osmosis skiffs on lanes, but it is a flow —
no simulated NPC agents.
_Implementation_:
shipped in #59/#60 ([spec](docs/specs/E8-living-economy.md)) —
`osmosisTick` wired into the tick each world hour, `World.osmosisPulse` carries the per-lane signal;
#63 first rendered it as ambient pulses on the map, replaced by Osmosis skiffs in #161 (below).
_Avoid_:
NPC trade, AI traders (as sim terms)

**Osmosis skiff** (PL: skif osmozy):
The display glyph for Trade osmosis (above):
small NPC trader ships sailing a Lane in the flow's direction, one per unit of flow intensity up to
a cap.
A view-local, cosmetic reading of `World.osmosisPulse` —
no sim entities, no state of their own, so it carries the same "no simulated NPC agents" law Trade
osmosis does;
a quiet Lane shows no skiffs.
Sim-time anchored:
motion is a function of the world Tick, not wall-clock, so pausing freezes skiffs and Speed scales
them.
Distinct from the Controlled Ship by scale and silhouette, and never gold (ADR-0006) —
a fresh player must never mistake one for their own ship.
_Implementation_:
shipped in #161 ([grill](docs/design-notes/route-events-2026-07-14.md)), replacing the ambient
pulses of #63 —
`src/ui/skiffPosition.ts` (tick-driven placement, unit-tested), rendered in `RegionMap.tsx` as an
inline hull silhouette (not the vendored `ShipIcon` — this is the same cosmetic ambient layer the
pulses occupied, not a "game-world entity" under ADR-0006's vendored-icon boundary).
`prefers-reduced-motion` freezes each skiff at its spawn phase instead of animating (carried over
from #63/#69).
_Avoid_:
NPC ship, trader ship (as sim terms — this is a UI rendering, not a sim entity)

**Price board** (PL: tablica cen):
The region-wide economic overlay:
all Ports × all Goods in one table with bid/ask and trend per cell, highlighting the cheapest ask
and highest bid per good.
Full information in M2 (fog is a parked E6 candidate).
_Implementation_:
shipped in #62 ([spec](docs/specs/E8-living-economy.md)) —
`PriceBoardOverlay.tsx`, opened from the TopBar button or the `B` hotkey;
rows are ports, columns goods, cheapest-ask / highest-bid highlighted per good, docked row marked.
_Avoid_:
market overview, economy screen (as identifiers)

### Player & ships

**Company** (PL: kompania):
The player's trading enterprise;
owns ships and thalers.
_Avoid_:
player (in sim code), corporation

**Ship** (PL: statek):
A vessel owned by a company;
carries cargo along lanes.
Every Ship carries a display `name` from the moment it exists —
the starting ship on new game and every launched ship alike —
never a raw id.
_Implementation_:
name shipped in #83/#54 —
generated from a fixed cosmetic pool keyed by ship count (`generateShipName`, no sim RNG draw,
ADR-0003), player-editable in the ShipPanel (`renameShip` command).
`FleetList.tsx` and every other UI surface show the name, never `ship.id`.
_Avoid_:
vessel, boat

**Fleet** (PL: flota):
The Company's full set of Ships, listed and status-tracked together —
every Ship's name, status (docked / underway / on route / suspended) and assigned Route, always
visible at the top of the side panel.
A roster view, not a mechanic of its own;
the Fleet list is where the player designates the Controlled Ship.
_Implementation_:
shipped in #83 —
`FleetList.tsx`, replacing the single-ship `ControlledShipHeader` (#32) once the fleet grew past one
ship (E9).
_Avoid_:
fleet-lite (PRD placeholder term, retired), armada, squadron

**Controlled Ship** (PL: kontrolowany statek):
The Ship that the player has designated to receive Commands (e.g. `sailTo`, `buy`, `sell`).
The UI maintains exactly one Controlled Ship at a time.
Designating happens by clicking a player Ship on the map (when appropriate), in the Harbor list, or
in the Fleet list.
_Implementation_:
shipped in #28, #32 —
the store holds `controlledShipId` (distinct from panel `selection`);
designated via map click, Harbor list, or the Fleet list.
Commands target it.
`FleetList.tsx` (#83) replaced the earlier single-ship `ControlledShipHeader` once the fleet grew
past one ship (E9).
_Avoid_:
active ship, selected ship (to distinguish from UI panel selection)

**Hold** (PL: ładownia):
A ship's cargo capacity.
_Avoid_:
capacity, storage

**Cargo** (PL: ładunek):
The goods currently aboard a ship.
_Avoid_:
freight, load

**Route** (PL: trasa):
A Company-level template:
a looping, ordered list of port Stops, created and edited in the Headquarters' Route panel.
Assigned to Ships **by reference** —
one Route can sail on many Ships at once, and editing the template applies to every assigned Ship
from its next Stop (an index left out of range wraps to Stop 0; deleting an assigned Route lets
ships finish their current Course, then leaves them routeless).
A route is a frozen bet that its spreads keep paying —
with one deliberate exception:
a buy order may carry a **Margin Gate** (`minMargin`, E9.1) that makes the Ship *wait* in port until
carrying the good onward is worth it (ADR-0007; otherwise routes carry no price or wait conditions).
A manual order to a routed Ship suspends the Route (it stays assigned);
resuming sails to the next Stop in order.
Ship-side state:
`(routeId, next Stop index, suspended?, waiting?)` —
`waiting?` (E9.1) marks a Ship docked at its own next Stop with a Margin Gate unmet, siblings
already run, the index held.
_Implementation_:
sim model + semantics shipped in #80 (`route.ts`, route Commands, the docking-phase route pass in
`tick.ts`);
assignable Routes need ≥ 2 Stops over ≥ 2 distinct ports.
Route-editor UI shipped in #85 (`HeadquartersPanel.tsx` Trasy tab — list-based Stop editor,
assign/unassign, suspend/resume, loop metrics; `RegionMap.tsx` highlights the selected Route's Stop
ports).
Naming collision with the old internal `route` resolved at the E9 grill (2026-07-09):
the pathfinding concept is now **Course**;
`Route` is reserved for this player-facing loop.
_Avoid_:
itinerary, plan;
template (as identifier — every Route is one)

**Course** (PL: kurs):
A pathfinding result —
the ordered lane Voyages a Ship sails to execute one `sailTo` (or to reach the next Stop of a
Route).
Transient and per-leg, in contrast to the standing, looping Route.
_Implementation_:
rename landed in #79 (E9 keystone PR).
Now `shortestCourse`, `Ship.location.course`, `courseTicks`, `coursePreview.ts`.
E10's UI identifiers (`courseVoyages`, `isCourseAccented`, `.lane--course-accent`) match and were
untouched.
(Old names were in sim code before #79.) _Avoid_:
path, leg sequence;
route (reserved for the player-facing loop)

**Stop** (PL: przystanek):
One entry of a Route:
a Port plus its orders, each naming its economic effect — **buy**
(good → fill available Hold at ask), **sell** (good → sell all at bid), **deliver** (good → transfer
cargo to the local build site, up to the recipe's remaining need).
buy and sell orders may carry an optional **`qty`** ceiling ("up to N", E9.1; absent ⇒ greedy — buy
fills the Hold, sell empties the good);
deliver never takes `qty`.
A buy order may also carry a **Margin Gate** (`minMargin`, see below).
Orders execute best-effort on docking ("do what you can and sail on" — no conditions **except** an
unmet Margin Gate, which withholds stop-advancement, ADR-0007), then the ship departs immediately.
A deliver order at a port with no active build is a no-op.
_Implementation_:
shipped in #80 —
a routed Stop executes by dispatching the same buy/sell/deliver Commands a player issues
(equivalence by construction).
A ship dwells one tick at each Stop before departing (the manual-play quantization + the
intervention window).
Order vocabulary locked at the E9 grill (2026-07-09), replacing the earlier load/unload wording
("unload" became ambiguous once deliver existed).
E13 (M3) adds two order kinds: **store**
and **withdraw** (transfer between Cargo and a Storehouse, market-free — the goods are already
yours).
_Avoid_:
waypoint, leg;
load/unload (pre-E9 wording)

**Margin Gate** (PL: próg marży):
An optional wait condition on a **buy** Stop order (`minMargin`, E9.1):
the Ship dwells docked and re-evaluates each tick, withholding stop-advancement, until the good's **predicted per-unit margin**
—
`sell_price(reference port) − buy_price(here)`, from the same market pricing the real Commands use —
reaches `minMargin`.
The **reference port** is the next *sell*-stop for that good in route order, wrapping the loop
(deliver is never a reference; no sell-stop ⇒ the gate is inactive and the buy executes normally).
Non-gated siblings at the Stop still execute on arrival;
only advancement waits.
Multiple gates at one Stop are **atomic** (v1):
the Ship waits until all pass, then fires all gated buys together.
The wait is indefinite by design —
the player owns the threshold —
made humane by a visible *"czeka na marżę ≥ X (teraz Y)"* indicator and the `sailTo` escape hatch,
and counter-pressured by flat daily upkeep.
The **one deliberate exception** to E9 route equivalence (ADR-0007):
no single manual Command means "wait for margin." Stored as `ShipAssignment.waiting?`;
the UI display is derived.
_Implementation_:
E9.1 (`docs/specs/E9.1-route-qty-and-margin-gate.md`);
`resolveReferencePort`
+ `unitMargin` (pure, sim + UI), the `runRouteForShip` gate state machine, `SAVE_VERSION 11`.
_Avoid_: price floor, limit order (these imply a market order type, not a route wait); stop-loss

**Voyage** (PL: rejs):
One traversal of a lane by a ship, taking a number of ticks.
_Avoid_:
trip, journey

### Buildings & construction

Terms locked at the E9 grill (2026-07-09).
Design principle: **buildings introduce mechanics**
—
a new gameplay layer arrives with a Building, not with a tutorial.
The sim model (Headquarters, Build Order, auto-draw/deliver/rush, launch) shipped in #81;
the Headquarters-panel UI shipped in #84 (`HeadquartersPanel.tsx` Budowa tab — per-good build
progress, auto-draw rate, stall reason, rush quote/execute; `PortPanel.tsx` gains the founding
button and the HQ port's progress section) and #85 (Trasy tab, see Route above).

**Building** (PL: budynek):
A Company-owned structure at a Port.
E9 shipped the first type —
the Headquarters;
E14 adds the Shipyard;
E13 (M3) adds rank-gated guild Buildings (see Storehouse, Building permit);
E15 (M4) adds the third Company type —
the Processing plant.
Per-region *branch offices* stay parked (multi-region hook, PRD).
NPC-owned Guildhouses are world-side and are not Company Buildings.
_Avoid_:
structure, facility

**Headquarters** (PL: siedziba):
The Company's founding Building —
one per Company, placed at a port of the player's choice for a flat thaler price, active
immediately.
Unlocks the orchestration layer:
the Route panel and ship construction.
New ships launch docked at the Headquarters port.
Progression beat:
manual trader → founder → orchestrator.
_Avoid_:
HQ (in identifiers), base, office

**Shipyard** (PL: stocznia):
The Company's second Building type (E14) —
one per Company, commissioned at a port of the player's choice once the Headquarters exists, built
via the Build Order pattern.
Introduces the Refit.
Deliberately not rank-gated (not a guild Building).
_Avoid_:
dock, wharf, dry dock

**Processing** (PL: przetwórstwo):
The mechanic of goods transformation (M4/M5 depth engine; Arcana split as amended 2026-07-16): **Company-owned processing buildings**
consume input Goods and create **processed goods** (PL: towary przetworzone), including arcane ones.
The Great Work consumes mainly processed goods —
the 1.0 funnel is raw goods → Processing → Expedition.
Company-owned, not guild-licensed:
the guilds are a cartel ("honour amongst thieves") and share no mechanics —
your industry you build yourself.
The two building tracks:
guild-licensed (Building permits, rank-gated — Storehouse variants) vs Company-owned (Headquarters,
Shipyard, processing buildings).
Spec:
[E15-processing.md](docs/specs/E15-processing.md) (grilled 2026-07-16);
see Processing plant.
_Avoid_:
crafting, manufacturing, refining (as identifiers — "refining" collides with Refit's semantic field)

**Processing plant** (PL: przetwórnia):
The Company's third Building type (E15):
a continuous works with a chain fixed at construction —
one implementation, chain variants (the Storehouse pattern).
Own finite input and output stores;
converts once per world day up to its rate.
Fed **only by Company deliveries** (the cartel won't supply a competing industry — no auto-draw in
operation; construction auto-draws as usual, the asymmetry is deliberate) and drained **only by withdraw**
(no auto-sell; the plant never spends thalers):
value-add is created in the plant, profit is created on the route.
At most one plant per port;
siting free;
daily building upkeep under the Reserve clamp.
Two legible stalls: **starved**
(PL: głód surowca) and **backlogged** (PL: magazyn pełny).
Spec:
[E15-processing.md](docs/specs/E15-processing.md).
_Avoid_:
factory, manufactory, works (as identifiers)

**Refit** (PL: przebudowa):
The Shipyard's mechanic (E14):
a mini Build Order against a ship docked at the Shipyard port that raises its Hold to the next rung
of a fixed multiplier ladder over the ship's `baseHold` (×2 → ×1.5 → ×1.25, thresholds rounded once
from base; hard cap after three).
One active Refit per Shipyard;
starting one auto-suspends the ship's Route and locks the ship in port;
cargo stays aboard;
no cancellation (v1).
Materials arrive like any construction:
auto-draw, deliver, rush —
all under the Reserve.
`baseHold` is the Hold a ship launched with (all current ships: 50), the anchor for future ship
types.
_Avoid_:
upgrade (reserved for future non-Hold improvements), overhaul, retrofit

**Recipe** (PL: przepis):
The bill of materials for one hull:
per-good quantities across all five goods —
much grain (provisions), medium textiles (rigging) and aether salt (hull infusion), a little
electronics (instruments) and a little timber (the living-wood keel, the recipe's prestigious top) —
plus a flat **labor fee** (PL: robocizna) in thalers, charged when the Build Order is placed.
_Avoid_:
blueprint, cost table

**Build Order** (PL: zlecenie budowy):
The active ship construction at the Headquarters —
one at a time in E9.
Holds the build site's own material store and fills it from three sources: **auto-draw**
(each tick the site buys missing materials from the Headquarters port's market at the normal ask,
rate-capped per day, paid from the Company purse — it stalls visibly at the Reserve or when local
stock runs dry), **deliveries** (deliver orders and commands), and **rush** (one-click instant buy
of the remainder at the normal market quote, limited by local stock — money does not teleport
timber).
The ship launches the moment the Recipe completes, empty and routeless.
_Avoid_:
construction job, project, queue (E9 has none)

**Reserve** (PL: rezerwa):
The ₸500 floor that no construction spend may cross —
founding, labor fee, auto-draw and rush all stop at it;
equal to the Company's starting capital, so the rule reads "building never touches your last
starting-purse".
From E3 (2026-07-14 grill) standing costs respect it too:
Upkeep never takes the purse below the Reserve —
a passive drain must not be able to kill.
Docking fees are deliberately outside it (pay-what-you-have, no-debt — docking is an active player
choice).
Born of the agency guarantee (#122 grill, 2026-07-12: the game may slow down, never die — a dead
state is a defect).
Calibration is tuning ≠ spec drift.
_Implementation_:
shipped in the #122 fix —
`CONSTRUCTION_RESERVE` (`src/sim/building.ts`), enforced at all four points:
`foundHeadquarters` and `placeBuildOrder` gates (`commands.ts`), the auto-draw skip and the
`computeRushQuote` purse cap;
the upfront estimate is `computeBuildEstimate` (same file) behind the Budowa tab's confirmation
step.
_Avoid_:
buffer, safety margin, minimum balance

**Docking fee** (PL: opłata dokowa):
A flat per-docking charge, differentiated per Port (by archetype/size);
paid on every docking, manual or routed.
Sailing through an intermediate port without docking is free.
No debt in E9:
an empty purse pays what it has.
Its own Ledger event kind —
the fixed cost that makes route rot legible.
_Implementation_:
charged in the docking phase (`DOCKING_FEE` in `region.ts`) shipped in #80 —
active for all docking from tick 0, including pre-Headquarters manual play.
Its Ledger event kind (`dockingFee`) shipped in #82.
_Avoid_:
port tax, harbor dues, toll

### Guilds & contracts

Terms locked at the M3 grill (2026-07-09).
Axis:
the region gains faces —
institutions with addresses and demands;
reputation is the long-term currency.
E3 wave 1–2 shipped the sim model for Guilds, Enrollment, Ranks and Upkeep;
wave 3 shipped the full Contract lifecycle and Settlement;
wave 3c the Contract board and guildhouse UI (#96/#97) —
the epic is complete.
Still not in the build:
Building permits (E13).

**Guild** (PL: gildia):
An NPC institution, one per non-freeport Port archetype —
five in a region (working names: Granary Guild / agrarian, Weavers' Assembly / urban, Saltworkers'
Brotherhood / mining, Foundry League / industrial, Livingwood Consortium / verdant; names are
flavor, tunable).
A Guild expresses needs as Contracts and tracks the Company's Rank.
Not an agent:
guilds own no ships and make no trades —
they read the same living economy the player reads.
_Implementation_:
shipped in #168/#170 —
`guild.ts`:
`GuildId = EconomicArchetype`, `GUILDS` (five defs, one per Economic archetype).
Contracts followed in wave 3 (below).
_Avoid_:
faction, NPC company

**Guildhouse** (PL: dom gildii):
A Guild's seat, present at every port of its archetype.
World-side (NPC-owned) —
not a Company Building.
Enrollment happens here;
its PortPanel section shows rank and cooperation history.
_Implementation_:
shipped in #97 —
`GuildhouseSection` in `PortPanel.tsx` at every non-freeport port (enroll with fee and Polish gating
reasons, rank badge on a neutral ramp, points progress).
Settlement notices surface in the TopBar notice strip, derived from `settlement` Ledger events since
a UI-local `lastSeenTick` (seeded to the world tick on mount).
_Avoid_:
guild hall, office

**Enrollment** (PL: wstąpienie):
The one-time act (plus thaler fee) of joining a Guild —
requires a founded Headquarters (companies deal with guilds, lone shippers don't) and grants Rank 1.
Like founding, it is paperwork:
no ship presence required.
Which guilds to join first is a strategic choice, not a checklist.
_Implementation_:
shipped in #92/#170 —
`enroll` command (`commands.ts`), gated on a founded Headquarters and `ENROLLMENT_FEE` (₸400,
`guild.ts`);
pays via the `enrollmentFee` Ledger event kind.
_Avoid_:
membership (as identifier), subscription

**Rank** (PL: ranga):
The Company's discrete standing with one Guild:
four steps, a facade over hidden progress points (settled period +, missed period −, breach −−;
ranks can fall).
Rank gates Contract access (via `requiredRank` — see Desperation clause, #226: decoupled from `tier`
so access is never fully closed) and which Building permits it grants.
_Implementation_:
model shipped in #168/#170 —
`rankOf(points)`, `RANK_THRESHOLDS` and the `POINTS_*` constants (`guild.ts`);
since #94 the points move —
Contract settlements, breach and resignation are the only mutations (floor at 0).
_Avoid_:
level, reputation score (as identifiers)

**Reputation** (PL: reputacja):
The substance under Ranks and the *only* currency of contract consequences —
no thaler penalties, ever (no-debt precedent).
Earned slower than it is lost;
a deliberately unprofitable contract held for reputation is an investment (the loss-leader play).
_Avoid_:
karma, favor

**Contract** (PL: kontrakt):
A continuous service obligation offered by a Guild:
*keep delivering* ≥ quota units of a Good to a Port per Settlement period, for at least K periods.
Not a one-shot errand.
Offers are generated deterministically from real shortages (stock far below Equilibrium) and sized
from real geometry (`shortestCourse`, hold capacity) so they are feasible by construction;
the offer shows its own basis ("expected ~2 trips/period, nearest source: …").
The market pays bid for the goods as in any sale;
the Guild pays a flat fee per met period —
the market pays for goods, the guild pays for reliability.
Contracts add no waiting mechanics:
fulfilment is read from the Ledger after the fact.
_Implementation_:
offers shipped in #93 —
`contract.ts` (`refreshContractOffers`, causal expiry at the day boundary,
feasibility-by-construction basis);
lifecycle in #94 —
`acceptContract` (enrollment + accept-side rank gating on `requiredRank`, see Desperation clause) /
`resignContract` commands, sale attribution on the shared `applyTrade` seam (manual == routed by
construction), settlements in `dayBoundary`.
Guardrail suite:
`e3-guardrails.test.ts` (#98).
_Avoid_:
quest, mission, order (collides with Stop orders)

**Desperation clause** (PL: klauzula desperacji):
The rule that keeps Rank gating access without ever locking a Guild's board shut:
`ContractOffer.requiredRank` is a separate field from `tier`.
Tier stays the honest job description (distance band → fee, minPeriods);
`requiredRank` is what accept actually checks.
At every board refresh each guild's lowest-tier open offer (ties broken by deepest shortfall, same
metric the generator's own candidate sort uses) is stamped `requiredRank = 1`;
every other offer keeps `requiredRank = tier`.
Recomputed idempotently over the full open-offer set (survivors included) every refresh, so the
clause migrates with the board rather than sticking to one offer.
Guarantees every guild with at least one open offer has at least one a rank-1 member can accept —
the rank/tier progression deadlock (docs/design-notes/playtest-2026-07-15-contractor.md) this fixes.
Presented as a "Pilne" story label on the offer card, never a rank badge, and never on a tier-1
offer that is already naturally rank-1 (that offer isn't desperate).
_Implementation_:
shipped in #226 —
`contract.ts`'s `stampRequiredRanks` (the stamp pass, end of `refreshContractOffers`);
`commands.ts`'s `acceptContract` gates on `requiredRank`;
`KontraktyTab.tsx`'s `.kontrakty-offer__label` slot renders "Pilne —
gildia przyjmie każdego" when `requiredRank === 1 && tier > 1`.
SAVE_VERSION 9→10 backfills `requiredRank: tier` onto saved offers/active contracts (self-heals to
the clause at the next refresh).
_Avoid_:
rank discount, apprentice contract (a different, parked idea)

**Settlement period** (PL: okres rozliczeniowy):
A Contract's repeating window of L world days, settled at its final day boundary:
quota met → fee paid + rank progress;
missed → no fee + rank step down.
Two consecutive missed periods → the Guild terminates the contract (breach, large rank hit).
The player may resign any time at the same breach cost, shown before confirming.
_Implementation_:
shipped in #94 —
`settleContracts` runs at the day boundary between Upkeep and offer refresh (fees land inside the
day's netWorth point).
A breach period nets exactly the resign cost, replacing that period's miss penalty (owner decision
2026-07-14: resign = breach parity).
Every outcome leaves a Ledger `settlement` event (`met|missed|breached|resigned`);
folding `pointsDelta` with the per-step floor at 0 reproduces stored points (pinned invariant test).
_Avoid_:
deadline, billing cycle

**Contract board** (PL: tablica kontraktów):
The **Kontrakty** tab of the PriceBoardOverlay (same overlay, same `B` hotkey):
open offers of enrolled Guilds plus active contracts with period progress ("period 3/6: 42/50,
settles in 2 d").
Each guild keeps ~2–3 open offers, refreshed at day boundaries;
an offer dies causally when its shortage heals.
The board is a barometer of the region, not a quest log.
_Implementation_:
shipped in #96 —
the Kontrakty tab of `PriceBoardOverlay` on the shared Tabs component (#181):
offers of enrolled guilds with guild badge (`guildDisplay.tsx`), basis line and board-side locks
("Wymaga rangi N", gated on `requiredRank` since #226);
active contracts with period progress and two-step resign stating −3.
The notice strip (#97) opens it via `initialTab="kontrakty"`.
_Avoid_:
quest log, job board

**Building permit** (PL: pozwolenie budowlane):
A Rank-gated right to construct a Guild's Building variant —
at ports of that guild's archetype or at the Free port, nowhere else.
The M3 slice of "buildings introduce mechanics":
reputation buys access to new mechanics, not percentages.
_Avoid_:
license, unlock (as identifiers)

**Storehouse** (PL: skład):
The guild Building type (E13):
port-side storage for the guild's domain goods, finite capacity, built via the E9 Build Order
machinery.
One implementation, five guild variants (variant = accepted-goods filter + skin);
E13 ships one —
the **Granary** (PL: spichlerz, Granary Guild, stores grain).
Enables arbitrage over time:
buy low, store, sell after the drift —
bounded by capacity, spread and the marginal walk.
_Avoid_:
warehouse (as identifier), depot

**Upkeep** (PL: utrzymanie):
The daily per-ship fixed cost (E3), its own Ledger event kind.
A ship costs thalers even when idle —
fleets should sail or shrink.
Never crosses the Reserve (2026-07-14 grill):
below ₸500 upkeep goes unpaid with no consequence —
no debt, no arrears;
a standing cost may slow the game down, never kill it.
Calibration principle:
a lone starter ship stays comfortably viable (upkeep must never feel like an unexplained penalty —
it ships only now because the Ledger makes it legible).
_Implementation_:
shipped in #95/#172 —
`UPKEEP_PER_DAY` (₸10, `guild.ts`), charged per ship at the day boundary in `tick.ts` as
`min(UPKEEP_PER_DAY, max(0, purse − CONSTRUCTION_RESERVE))`;
its own `upkeep` Ledger event kind.
_Avoid_:
maintenance, wages (crew wages remain a parked, separate idea)

### Harness & evaluation

Terms for the agent-facing evaluation tooling (epic E11 — spec drafted 2026-07-09; re-reviewed
against E9/E12/E3 and **v1 slice approved 2026-07-15**: Batch core + `harness run` CLI; Direct play
and Replay-of-sessions deferred to v2).
None of these exist in the build yet.

**Harness** (PL: poligon):
The headless consumer of the simulation for running games without the UI.
Imports `src/sim` like any other consumer —
never the other way around;
policies and runner live outside the sim module.
_Implementation_:
E11 ([spec draft](docs/specs/E11-proving-grounds.md)) —
not in build yet.
_Avoid_:
test rig, sandbox

**Policy** (PL: polityka):
A deterministic, parameterized playing strategy:
a pure function `(world, memory) → { commands, memory }` polled every Tick.
May read the full `World` but is honor-bound to player-visible information;
policies that read sim internals (e.g. flow drift) must be marked diagnostic.
_Avoid_:
bot (colloquial in tests is fine), AI, strategy (in identifiers)

**Run** (PL: przebieg):
One full game:
Policy + seed + day horizon → outcome metrics + Ledger.
Fully reproducible by construction.
_Avoid_:
game, session (in identifiers)

**Batch** (PL: seria):
N Runs over a seed/parameter grid, aggregated into one report (medians, spreads, head-to-head policy
comparisons, anomaly list with replayable seeds).
_Avoid_:
sweep, suite (in identifiers)

**Ledger** (PL: księga):
The canonical event stream of a Company's activity:
every thaler or goods movement —
trades (manual and routed), docking fees, build-site auto-draw and rush purchases, deliveries, labor
fees, the Headquarters founding, ship launches —
tagged with tick, ship and port where applicable (route-driven trades additionally carry their
Route; other kinds correlate to a Route by ship + time window), plus daily net-worth snapshots
(thalers + fleet cargo + build-site store, all at mid price; ships and buildings carry no book
value, so the chart tells the honest investment story: a build is a visible dip, then steeper
growth).
Full retention.
One schema, two consumers:
the in-game performance board (E9) and the Harness (E11). **Value law**
(E13.0 grill, 2026-07-19):
company value changes **only** through a booked Ledger event.
Moving your own goods between Goods stores you own is not such an event, so a Transfer is
value-neutral —
and mechanics that legitimately change value on movement (storage fees, spoilage, handling loss)
must book an explicit kind rather than letting value leak silently.
Guarded by a value-neutrality property test rather than by an enumeration of stores (ADR-0008).
_Implementation_:
event stream + daily net-worth snapshots shipped in #82 (`ledger.ts`, `World.ledger`);
events are appended by `applyCommand`/tick phases at the point of mutation, full retention,
serialized with the save.
`routeId` is carried on `trade` events only (route-driven trades) —
the Tech union's exact contract.
The in-game performance board (`LedgerOverlay.tsx`) shipped in #86 —
Transakcje (transaction list, per-ship filter) and Wartość firmy (SVG company-value chart, no
library).
A **transaction** (UI-only term, not a distinct sim type) is any Ledger event except a netWorth
snapshot —
the Transakcje tab's row unit.
The E11 Harness consumer is still pending.
M3 extends the kind union —
`enrollmentFee` (#92), `upkeep` (#95), and `contractFee` + the four-outcome `settlement` (#94) are
in;
store/withdraw follows (E13) —
and adds a third consumer:
contract settlement reads fulfilment from the same stream (shipped in #94: sale attribution + the
settlement fold invariant). **Grammar law**
(issue #203):
every thaler-moving kind carries `thalers`;
every rank-moving kind carries `pointsDelta` —
a kind never moves money silently or through a side channel.
`enrollmentFee` was the one violator (moved ₸400 with no field) and was retrofit to carry `thalers`,
with a SAVE_VERSION 8→9 migration backfilling it onto existing saves;
the law is enforced by an exhaustive kind classification in `ledger.test.ts` —
a new kind left unclassified fails to typecheck.
_Avoid_:
log, history (as identifiers)

**Direct play** (PL: gra bezpośrednia):
Harness mode where an agent issues Commands step by step (state JSON out, command JSON in).
Every session is logged as a command script, so it becomes a deterministic, replayable Run.
_Implementation_:
deferred to Harness v2 (2026-07-15 v1 scope lock) —
v1 Runs stay replayable by construction (Policy + seed), only the interactive protocol waits.
_Avoid_:
interactive mode

**Replay** (PL: powtórka):
Re-execution of a Run or a Direct play session from its recorded script, tick-for-tick identical
(ADR-0003).
_Avoid_:
—

**Experiment** (PL: eksperyment):
A research question + its Batches + the agent's written conclusions, filed as a dated document in
`docs/experiments/`.
Closes the loop:
experiment → findings → grill inputs.
_Avoid_:
study

### Simulation

**Tick** (PL: tick):
The atomic simulation step;
1 tick = 1 world hour.
All state changes happen on tick boundaries.
_Avoid_:
frame, step, update

**Command** (PL: rozkaz):
A player order handed to the simulation and applied at a tick boundary (e.g. buy, sell, assign
route).
_Avoid_:
action, order, input (in identifiers)

**Speed** (PL: prędkość):
The UI-selected playback rate of world time:
paused, 1x, 10x or 100x.
Purely presentational —
it never changes what a tick does.
_Avoid_:
time scale, game speed (in identifiers)

**World** (PL: świat):
The complete simulation state;
serializable and deterministic given seed and player commands.
_Avoid_:
game state, universe

**Goods store** (PL: miejsce na towary):
Any place goods can sit:
a Ship's Cargo (a store that moves), a construction site's materials, a Building's contents.
One type, `GoodsStore`.
Its contents are reachable **only** through `amountOf` / `withAdded` / `withRemoved` —
nothing in the codebase touches them directly (ADR-0008).
The receiving store owns the policy:
what it accepts (goods filter + capacity + remaining need), what happens after receipt (held /
consumed at completion / consumed daily), and whether withdrawal is allowed.
Capacity is never a field on the store —
a Ship's capacity is its Hold, which Refit mutates, and a construction site has no scalar capacity
at all.
_Avoid_:
inventory, container, bag, storage; **skład**
(that is the Storehouse);
dobra (a Good is a **towar**)

**Transfer** (PL: przeniesienie towaru):
One movement of a Good between two Goods stores the Company owns.
Value-neutral:
moving your own goods is not a booked Ledger event (see Ledger), so it never changes company value.
Distinct from a trade, which crosses the market boundary and does move thalers.
_Avoid_:
przewóz (implies distance — most Transfers happen within one Port), move, shift
