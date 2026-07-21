import { autoDrawCapForDayTick, CONSTRUCTION_RESERVE, drawConstructionSite, isSiteComplete, runBuildSiteAutoDraw, STOREHOUSE_RECIPE } from "./building";
import { applyCommand, type Command } from "./commands";
import { refreshContractOffers, settleContracts } from "./contract";
import { GOOD_IDS, type GoodId } from "./goods";
import { amountOf } from "./goodsStore";
import { UPKEEP_PER_DAY } from "./guild";
import { appendLedgerEvent, appendLedgerEvents, computeNetWorth } from "./ledger";
import { effectiveBase, marketTick, maxAffordableQty, NEUTRAL_MODIFIERS, unitMargin } from "./market";
import { osmosisTick } from "./osmosis";
import { shortestCourse } from "./pathfinding";
import {
  ARCHETYPE_PROFILES,
  DOCKING_FEE,
  TICKS_PER_DAY,
  type PortId,
  type Region,
} from "./region";
import { deriveSubstream, nextFloat, nextUint32, type RngState } from "./rng";
import { resolveReferencePort, type Route, type RouteId, type StopOrder } from "./route";
import { advanceShip, cargoUsed, type Ship, type ShipId } from "./ship";
import { runShipyardAutoDraw, runShipyardConstructionAutoDraw } from "./shipyard";
import { replaceShip, snapshotPrices, STARTING_HOLD, type World } from "./world";

export type { Command };

/** Mean-reversion pull per day: how far a drift multiplier moves back
 *  toward 1.0 before the random step is added (docs/specs/E8-living-economy.md
 *  — Stochastic flow drift). */
export const DRIFT_REVERT = 0.2;
/** Half-width of the daily random step, before mean reversion and clamping. */
export const DRIFT_STEP = 0.15;
/** Drift multiplier bounds — "a lean harvest" to "a good week at the mines". */
export const DRIFT_MIN = 0.7;
export const DRIFT_MAX = 1.3;

/**
 * One mean-reverting random step of every port × good's flow drift
 * multiplier, in canonical port × good order (region.ports order ×
 * GOOD_IDS order) so the same seed always draws in the same sequence
 * (ADR-0003). `m' = clamp(m + DRIFT_REVERT*(1-m) + DRIFT_STEP*(2u-1),
 * DRIFT_MIN, DRIFT_MAX)`. Pure: returns the next drift table and the
 * advanced RNG state, never mutates its inputs.
 */
export function driftStep(
  region: Region,
  flowDrift: Record<PortId, Record<GoodId, number>>,
  rng: RngState,
): [Record<PortId, Record<GoodId, number>>, RngState] {
  let state = rng;
  const next: Record<PortId, Record<GoodId, number>> = {};
  for (const port of region.ports) {
    const goods = {} as Record<GoodId, number>;
    for (const good of GOOD_IDS) {
      const m = flowDrift[port.id][good];
      let u: number;
      [u, state] = nextFloat(state);
      const stepped = m + DRIFT_REVERT * (1 - m) + DRIFT_STEP * (2 * u - 1);
      goods[good] = Math.min(DRIFT_MAX, Math.max(DRIFT_MIN, stepped));
    }
    next[port.id] = goods;
  }
  return [next, state];
}

/** Deduct the docking fee for `portId` from the shared purse (min(fee, thalers),
 *  no debt). Charged once per docking transition, manual or routed. A paid-0
 *  docking (empty purse, or a hypothetically fee-less archetype) moves no
 *  thalers, so it appends no Ledger event. */
function chargeDockingFee(world: World, portId: PortId, shipId: ShipId): World {
  const port = world.region.ports.find((p) => p.id === portId)!;
  const paid = Math.min(DOCKING_FEE[port.archetype] ?? 0, world.company.thalers);
  if (paid <= 0) return world;
  const charged: World = {
    ...world,
    company: { ...world.company, thalers: world.company.thalers - paid },
  };
  return appendLedgerEvent(charged, {
    kind: "dockingFee",
    tick: world.tick,
    shipId,
    portId,
    thalers: paid,
  });
}

/** Execute one Stop's orders best-effort, in list order, by dispatching the
 *  *same* Commands a player would — routes get no special math, so a Route can
 *  never out- or under-perform the identical manual trades (E9 equivalence
 *  guarantee). buy fills the affordable share of the Hold, capped at
 *  `order.qty` if set (E9.1 "up to N"; absent ⇒ today's greedy fill); sell
 *  empties the good, capped at `order.qty` if set (remainder carried
 *  onward — E9.1 sell-dosing); deliver moves min(cargo, need) into the build
 *  site (no-op off-HQ), never taking `qty`. */
function executeStop(
  world: World,
  shipId: ShipId,
  orders: Route["stops"][number]["orders"],
  routeId: RouteId,
): World {
  let w = world;
  for (const order of orders) {
    const ship = w.company.ships.find((s) => s.id === shipId)!;
    if (ship.location.kind !== "docked") break;
    const dockedAt = ship.location.portId;
    if (order.kind === "buy") {
      const port = w.region.ports.find((p) => p.id === dockedAt)!;
      const holdSpace = ship.hold - cargoUsed(ship);
      const maxQty = order.qty === undefined ? holdSpace : Math.min(order.qty, holdSpace);
      const qty = maxAffordableQty(
        port.market[order.good],
        effectiveBase(port, order.good),
        maxQty,
        w.company.thalers,
      );
      if (qty > 0) w = applyCommand(w, { kind: "buy", shipId, good: order.good, qty, routeId });
    } else if (order.kind === "sell") {
      const have = amountOf(ship.cargo, order.good);
      const qty = order.qty === undefined ? have : Math.min(order.qty, have);
      if (qty > 0) w = applyCommand(w, { kind: "sell", shipId, good: order.good, qty, routeId });
      } else if (order.kind === "deliver") {
        w = applyCommand(w, { kind: "deliver", shipId, good: order.good, target: order.target });
      } else if (order.kind === "store") {
        w = applyCommand(w, { kind: "storeGood", shipId, good: order.good, target: order.target });
      } else if (order.kind === "withdraw") {
        w = applyCommand(w, { kind: "withdrawGood", shipId, good: order.good, source: order.target });
      }
  }
  return w;
}

/** A gated buy at a Stop: the order plus its resolved reference port (E9.1
 *  Margin Gate). Only buy orders that carry `minMargin` *and* have a live
 *  reference (a sell-stop for the same good exists somewhere on the route)
 *  land here — a `minMargin` with no reference is inactive and stays an
 *  ordinary sibling. */
interface GatedBuy {
  readonly order: StopOrder;
  readonly referencePort: PortId;
}

/** Splits a Stop's orders into its active gated buys (in list order). */
function activeGatedBuys(route: Route, stopIndex: number, orders: readonly StopOrder[]): GatedBuy[] {
  const gated: GatedBuy[] = [];
  for (const order of orders) {
    if (order.kind !== "buy" || order.minMargin === undefined) continue;
    const referencePort = resolveReferencePort(route, stopIndex, order.good);
    if (referencePort !== null) gated.push({ order, referencePort });
  }
  return gated;
}

/** Whether a gated buy's Margin Gate currently passes: the reference port's
 *  unit sell price minus the unit ask here (`unitMargin`, market.ts — the
 *  same pricing functions the buy/sell Commands use) meets `minMargin`.
 *  `null` (zero local stock, either side) means unevaluable ⇒ fails ⇒ keep
 *  waiting. Reads pre-`marketTick` prices, same as the docking-phase
 *  Commands (this runs inside the same docking phase, before the tick's
 *  market step). */
function gatePasses(world: World, dockedPortId: PortId, gated: GatedBuy): boolean {
  const buyPort = world.region.ports.find((p) => p.id === dockedPortId)!;
  const sellPort = world.region.ports.find((p) => p.id === gated.referencePort)!;
  const margin = unitMargin(
    buyPort.market[gated.order.good],
    effectiveBase(buyPort, gated.order.good),
    sellPort.market[gated.order.good],
    effectiveBase(sellPort, gated.order.good),
  );
  return margin !== null && margin >= gated.order.minMargin!;
}

/** Put a docked ship underway toward `targetPortId` on the shortest Course. A
 *  no-op when the ship is already there or the target is unreachable. */
function dispatchToStop(region: Region, ship: Ship, targetPortId: PortId): Ship {
  if (ship.location.kind !== "docked" || ship.location.portId === targetPortId) return ship;
  const course = shortestCourse(region, ship.location.portId, targetPortId);
  if (course === null || course.length === 0) return ship;
  return {
    ...ship,
    location: {
      kind: "underway",
      course,
      voyageIndex: 0,
      voyageProgressTicks: 0,
      destination: targetPortId,
    },
  };
}

/** Builds the assignment for a ship that has just advanced past a Stop, with
 *  `waiting` genuinely absent (not `false`) — "not waiting" must be the same
 *  shape as before E9.1 (byte-identical saves/tests for ungated routes),
 *  never a stored `false`. */
function advancedAssignment(
  asn: NonNullable<Ship["assignment"]>,
  nextStopIndex: number,
): Ship["assignment"] {
  return { routeId: asn.routeId, nextStopIndex, suspended: asn.suspended };
}

/** Executes `orders` at the current Stop, advances past it (mod the Route
 *  length), and clears `waiting`. Shared by both "fire and move on" paths in
 *  `runRouteForShip`: a fresh arrival whose gates already clear, and a
 *  waiting poll whose gates just cleared — both end the same way. */
function executeAndAdvance(
  world: World,
  shipId: ShipId,
  orders: readonly StopOrder[],
  route: Route,
  stopIndex: number,
  asn: NonNullable<Ship["assignment"]>,
): World {
  const executed = executeStop(world, shipId, orders, route.id);
  const advanced = executed.company.ships.find((s) => s.id === shipId)!;
  const nextIdx = (stopIndex + 1) % route.stops.length;
  return replaceShip(executed, { ...advanced, assignment: advancedAssignment(asn, nextIdx) });
}

/**
 * Route logic for one docked ship, keyed on state (not on "did it just
 * transition") so an assign/resume that leaves the ship already at its next
 * Stop's port is handled by the same seam as a fresh arrival:
 * - not docked / unassigned / suspended → untouched.
 * - route gone → assignment cleared (finished its Course, now routeless).
 * - at its next Stop's port, `!asn.waiting` (fresh arrival): a Stop's active
 *   Margin Gates (E9.1 — buy orders with `minMargin` and a live reference)
 *   are evaluated. All pass (or none active) → execute the whole Stop,
 *   advance the index, dwell (identical to today for ungated routes). Any
 *   gated buy unmet → execute only the non-gated siblings, hold the index,
 *   set `waiting = true`, fire no gated buy.
 * - at its next Stop's port, `asn.waiting` (poll): re-evaluate the gated
 *   buys' gates only — siblings already ran and never re-run. All pass →
 *   fire the gated buys once as a deferred atomic group, advance, clear
 *   `waiting`. Otherwise dwell unchanged, still waiting.
 * - elsewhere → redirect toward the next Stop's port, no execution, `waiting`
 *   cleared. This is both the normal post-dwell departure and the recovery
 *   when a template edit moved the Stop out from under an in-flight ship (no
 *   wrong-port trade). The dwell mirrors manual play's quantization (a ship
 *   can never depart the tick it arrives) and gives the player a
 *   tick-boundary window to intervene (a manual sailTo auto-suspends the
 *   Route, ADR-0007).
 */
function runRouteForShip(world: World, shipId: ShipId): World {
  const ship = world.company.ships.find((s) => s.id === shipId)!;
  if (ship.location.kind !== "docked") return world;
  const asn = ship.assignment;
  if (!asn || asn.suspended) return world;

  const route = world.company.routes.find((r) => r.id === asn.routeId);
  if (!route || route.stops.length < 2) {
    return replaceShip(world, { ...ship, assignment: undefined });
  }

  const arrivalPortId = ship.location.portId;
  const idx =
    asn.nextStopIndex >= 0 && asn.nextStopIndex < route.stops.length ? asn.nextStopIndex : 0;

  if (route.stops[idx].portId !== arrivalPortId) {
    const redirected = dispatchToStop(world.region, ship, route.stops[idx].portId);
    return replaceShip(world, { ...redirected, assignment: advancedAssignment(asn, idx) });
  }

  const orders = route.stops[idx].orders;
  const gatedBuys = activeGatedBuys(route, idx, orders);
  const gatedOrders = new Set<StopOrder>(gatedBuys.map((g) => g.order));
  const siblings = orders.filter((o) => !gatedOrders.has(o));

  if (!asn.waiting) {
    if (gatedBuys.length === 0 || gatedBuys.every((g) => gatePasses(world, arrivalPortId, g))) {
      // No active gate, or every gate already clears: run the whole Stop,
      // exactly as today.
      return executeAndAdvance(world, shipId, orders, route, idx, asn);
    }
    // At least one gated buy unmet: run only the non-gated siblings, hold
    // the index, start waiting. No gated buy fires this tick.
    const executed = executeStop(world, shipId, siblings, route.id);
    const advanced = executed.company.ships.find((s) => s.id === shipId)!;
    return replaceShip(executed, {
      ...advanced,
      assignment: { routeId: asn.routeId, nextStopIndex: idx, suspended: asn.suspended, waiting: true },
    });
  }

  // Waiting poll: siblings already ran on arrival — never touch them again.
  // Re-evaluate only the gated buys' gates.
  if (gatedBuys.length > 0 && !gatedBuys.every((g) => gatePasses(world, arrivalPortId, g))) {
    return world; // still unmet: dwell unchanged, still waiting.
  }
  return executeAndAdvance(
    world,
    shipId,
    gatedBuys.map((g) => g.order),
    route,
    idx,
    asn,
  );
}

/** Docking phase (#80): in ships[] array order — the deterministic race for the
 *  shared purse and stock. Interleaved per ship: each ship pays its docking fee
 *  (only if it transitioned underway→docked this tick) and then runs its Route,
 *  before the next ship is touched — so a fee paid now limits what a later ship
 *  can afford, exactly as "each ship docks, pays, does its business". The fee
 *  gates on the transition, execution on ship state, so a resume/assign at the
 *  Stop port trades without a second fee. */
function runDockingPhase(world: World, before: readonly Ship[], advanced: readonly Ship[]): World {
  let w: World = { ...world, company: { ...world.company, ships: advanced } };
  for (let i = 0; i < advanced.length; i++) {
    const transitioned =
      before[i].location.kind === "underway" && advanced[i].location.kind === "docked";
    if (transitioned) {
      const loc = advanced[i].location;
      if (loc.kind === "docked") w = chargeDockingFee(w, loc.portId, advanced[i].id);
    }
    w = runRouteForShip(w, advanced[i].id);
  }
  return w;
}

function runStorehouseConstruction(world: World): World {
  const building = (world.company.buildings ?? []).find((candidate) => "siteStore" in candidate);
  if (!building || !("siteStore" in building)) return world;
  const portIndex = world.region.ports.findIndex((port) => port.id === building.portId);
  if (portIndex < 0) return world;
  const cap = autoDrawCapForDayTick(world.tick % TICKS_PER_DAY);
  const result = drawConstructionSite({ recipe: STOREHOUSE_RECIPE, siteStore: building.siteStore, portId: building.portId }, world.region.ports[portIndex], world.company.thalers, cap, world.tick);
  const completed = isSiteComplete({ recipe: STOREHOUSE_RECIPE, siteStore: result.siteStore });
  const buildings = (world.company.buildings ?? []).map((candidate) => candidate === building ? (completed ? { type: "storehouse" as const, variant: building.variant, portId: building.portId, store: result.siteStore } : { ...building, siteStore: result.siteStore }) : candidate);
  const ports = [...world.region.ports]; ports[portIndex] = result.port;
  let next: World = { ...world, company: { ...world.company, thalers: result.thalers, buildings }, region: { ...world.region, ports } };
  next = appendLedgerEvents(next, result.events);
  return completed ? appendLedgerEvent(next, { kind: "completed", tick: world.tick, portId: building.portId, building: "storehouse" }) : next;
}

/**
 * Daily per-ship upkeep charge (#95, docs/specs/E3-contracts-and-guilds.md —
 * Upkeep): `min(UPKEEP_PER_DAY, max(0, purse - CONSTRUCTION_RESERVE))` per
 * ship, applied sequentially in fleet-array order so an earlier ship's charge
 * limits what a later ship can be charged (deterministic, no ordering
 * ambiguity). The unpaid remainder below the Reserve simply evaporates — no
 * debt, no arrears, no penalty (the agency guarantee: a standing cost must
 * never be able to kill). A zero-amount charge (purse already at or below the
 * Reserve) mutates nothing and emits no Ledger event.
 */
function chargeUpkeep(world: World): World {
  let w = world;
  for (const ship of w.company.ships) {
    const charge = Math.min(UPKEEP_PER_DAY, Math.max(0, w.company.thalers - CONSTRUCTION_RESERVE));
    if (charge <= 0) continue;
    w = { ...w, company: { ...w.company, thalers: w.company.thalers - charge } };
    w = appendLedgerEvent(w, { kind: "upkeep", tick: w.tick, shipId: ship.id, thalers: charge });
  }
  return w;
}

/** One named step of the day-boundary sequence (#204 — refactored from a
 *  call-sequence into explicit data so the order is pinned by a structural
 *  test rather than prose; docs/specs/E3-contracts-and-guilds.md — Tick
 *  day-boundary order). Pure: `apply` never mutates its input. */
export interface DayBoundaryPhase {
  readonly name: string;
  readonly apply: (world: World) => World;
}

/**
 * Mean-reverting drift step (docs/specs/E8 — Stochastic flow drift;
 * docs/specs/E3 — Tick day-boundary order, step 1 of 6: "drift step"): every
 * day-boundary consumer (drift, offer generation — #93) draws from its own
 * isolated substream derived from `world.rng` *before* this boundary advances
 * it (deriveSubstream, rng.ts) — so no consumer's draw count can perturb
 * another's. The main stream itself advances exactly once, unconditionally,
 * regardless of how many (if any) draws a substream makes internally; that
 * advanced state is the only one ever threaded back into `World.rng`
 * (docs/specs/E3-contracts-and-guilds.md — Contracts). Offer generation
 * (contract.ts) turned out to need no randomness at all — candidates are
 * picked by largest shortfall with a canonical tie-break, never the RNG — so
 * no "offers" substream is derived anywhere in this sequence; flagged in the
 * #93 completion report as a deliberate deviation from the spec's literal
 * `deriveSubstream(state, "offers")` wording (nothing would ever consume it).
 * The main stream's single unconditional advance here still holds.
 */
function driftPhase(world: World): World {
  const [flowDrift] = driftStep(world.region, world.flowDrift, deriveSubstream(world.rng, "drift"));
  const [, rng] = nextUint32(world.rng);
  return { ...world, rng, flowDrift };
}

/** Price snapshot (docs/specs/E3 — Tick day-boundary order, step 2 of 6:
 *  "price snapshots"), a distinct step from the drift step per the spec's
 *  own enumeration even though nothing here reads `flowDrift` — the market's
 *  own tick (already applied earlier in `tick()`) is what the snapshot
 *  captures. */
function snapshotPricesPhase(world: World): World {
  return { ...world, priceSnapshots: snapshotPrices(world.region) };
}

/** Offer refresh (#93): generation + causal expiry. Sized against a fixed
 *  reference hold (STARTING_HOLD) rather than any real ship's hold — a
 *  guild's offer is a promise to the market, not tailored to the player's
 *  current fleet. Must run after `settleContracts` in the phase list:
 *  `world.company.contracts` here needs to already be post-settlement, so a
 *  contract that terminated at this same boundary is correctly no longer
 *  excluded (#200 — exclusion keys on contracts still active *after*
 *  settlement). */
function refreshOffers(world: World): World {
  return {
    ...world,
    contractOffers: refreshContractOffers(
      world.region,
      world.contractOffers,
      STARTING_HOLD,
      world.company.contracts,
    ),
  };
}

/** Daily net-worth snapshot (docs/specs/E9 — Ledger): thalers + fleet cargo +
 *  build-site store, at region-average mid price; ships/buildings carry no
 *  book value. Tagged with the boundary tick, same cadence as the price
 *  snapshot phase. Must stay last in the phase list, so the day's fees, fines
 *  and settlements land inside the day's curve point (docs/specs/E3 — Tick
 *  day-boundary order). */
function snapshotNetWorth(world: World): World {
  // `tick` is read from the world accumulated through the phase reduce: no
  // prior phase may mutate `tick`, or this event mistags to the wrong day.
  return appendLedgerEvent(world, { kind: "netWorth", tick: world.tick, ...computeNetWorth(world) });
}

/**
 * The day-boundary sequence (#168 — originally extracted as a call sequence
 * from the inline block this replaces; #204 — refactored into this explicit
 * ordered list): drift step + price snapshots → upkeep → contract settlements
 * (#94) → offer refresh (#93) → netWorth snapshot. The order here is the
 * spec's Tick day-boundary order verbatim (docs/specs/E3-contracts-and-guilds.md
 * — Tick day-boundary order) — a new boundary phase (E13 Storehouses and
 * beyond) slots into this array, consciously choosing where it sits relative
 * to the others, rather than being appended to a call-sequence a reader has
 * to trace through prose.
 */
export const DAY_BOUNDARY_PHASES: readonly DayBoundaryPhase[] = [
  { name: "drift", apply: driftPhase },
  { name: "priceSnapshot", apply: snapshotPricesPhase },
  { name: "upkeep", apply: chargeUpkeep },
  { name: "settleContracts", apply: settleContracts },
  { name: "refreshOffers", apply: refreshOffers },
  { name: "netWorth", apply: snapshotNetWorth },
];

/**
 * Runs the day-boundary phase list in order (#204). `world` is already
 * advanced to the boundary tick (tick+1, post-osmosis region/pulse folded in)
 * by the caller. Runs unconditionally; the caller gates on the boundary check
 * (this function does none itself), so it must be called at most once per
 * tick.
 */
function dayBoundary(world: World): World {
  return DAY_BOUNDARY_PHASES.reduce((w, phase) => phase.apply(w), world);
}

/**
 * Advances the World by exactly one tick (ADR-0003). Pure: never mutates its
 * input. Phase order per docs/specs/E9-fleet-and-routes.md (extends E8):
 * apply commands → advance ships → docking phase (#80) → build-site auto-draw
 * (#81) → market tick → osmosis → tick+1 → day boundary (drift + snapshots).
 */
export function tick(world: World, commands: readonly Command[]): World {
  let w = world;
  for (const command of commands) w = applyCommand(w, command);

  const before = w.company.ships;
  const advanced = before.map((ship) => advanceShip(ship, w.region));
  w = runDockingPhase(w, before, advanced);
  w = runBuildSiteAutoDraw(w);
  // The Shipyard's own construction site (E14 #286 fix): same tick phase as
  // the HQ build site, drawing next in the fixed order (mutually exclusive
  // with the Refit site below — a Refit cannot be active before the
  // Shipyard itself has built).
  w = runShipyardConstructionAutoDraw(w);
  // Shipyard's Refit site (E14 #275): same tick phase as the HQ build site,
  // drawing sequentially from the same shared purse — HQ first, so a thin
  // purse's Reserve floor is respected by both in a fixed, deterministic order.
  w = runShipyardAutoDraw(w);
  w = runStorehouseConstruction(w);

  const ports = w.region.ports.map((port) => ({
    ...port,
    market: marketTick(
      port.market,
      ARCHETYPE_PROFILES[port.archetype],
      NEUTRAL_MODIFIERS,
      w.flowDrift[port.id],
    ),
  }));

  const { region, pulse } = osmosisTick({ ...w.region, ports });

  const nextTick = w.tick + 1;
  const stepped: World = { ...w, tick: nextTick, region, osmosisPulse: pulse };
  if (nextTick % TICKS_PER_DAY === 0) return dayBoundary(stepped);

  return stepped;
}
