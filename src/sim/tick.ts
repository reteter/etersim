import { CONSTRUCTION_RESERVE, runBuildSiteAutoDraw } from "./building";
import { applyCommand, type Command } from "./commands";
import { refreshContractOffers, settleContracts } from "./contract";
import { GOOD_IDS, type GoodId } from "./goods";
import { UPKEEP_PER_DAY } from "./guild";
import { appendLedgerEvent, computeNetWorth } from "./ledger";
import { effectiveBase, marketTick, maxAffordableQty, NEUTRAL_MODIFIERS } from "./market";
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
import type { Route, RouteId } from "./route";
import { advanceShip, cargoUsed, type Ship, type ShipId } from "./ship";
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
 *  guarantee). buy fills the affordable share of the Hold; sell empties the
 *  good; deliver moves min(cargo, need) into the build site (no-op off-HQ). */
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
      const qty = maxAffordableQty(
        port.market[order.good],
        effectiveBase(port, order.good),
        holdSpace,
        w.company.thalers,
      );
      if (qty > 0) w = applyCommand(w, { kind: "buy", shipId, good: order.good, qty, routeId });
    } else if (order.kind === "sell") {
      const have = ship.cargo[order.good];
      if (have > 0) w = applyCommand(w, { kind: "sell", shipId, good: order.good, qty: have, routeId });
    } else {
      w = applyCommand(w, { kind: "deliver", shipId, good: order.good });
    }
  }
  return w;
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

/**
 * Route logic for one docked ship, keyed on state (not on "did it just
 * transition") so an assign/resume that leaves the ship already at its next
 * Stop's port is handled by the same seam as a fresh arrival:
 * - not docked / unassigned / suspended → untouched.
 * - route gone → assignment cleared (finished its Course, now routeless).
 * - at its next Stop's port → execute the Stop, advance the index, and dwell
 *   docked for this tick. The dwell mirrors manual play's quantization (a ship
 *   can never depart the tick it arrives) and gives the player a tick-boundary
 *   window to intervene (a manual sailTo auto-suspends the Route).
 * - elsewhere → redirect toward the next Stop's port, no execution. This is
 *   both the normal post-dwell departure and the recovery when a template edit
 *   moved the Stop out from under an in-flight ship (no wrong-port trade).
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
    return replaceShip(world, { ...redirected, assignment: { ...asn, nextStopIndex: idx } });
  }

  // At our next Stop's port: execute best-effort, advance the index, dwell.
  const executed = executeStop(world, shipId, route.stops[idx].orders, route.id);
  const advanced = executed.company.ships.find((s) => s.id === shipId)!;
  const nextIdx = (idx + 1) % route.stops.length;
  return replaceShip(executed, { ...advanced, assignment: { ...asn, nextStopIndex: nextIdx } });
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

/**
 * Day-boundary phase (#168 — extracted, behavior-preserving, from the inline
 * block this replaces; docs/specs/E3-contracts-and-guilds.md — Tick
 * day-boundary order): drift step → price snapshots → upkeep → contract
 * settlements (#94) → offer refresh (#93) → netWorth snapshot. `world` is
 * already advanced to the boundary tick (tick+1, post-osmosis region/pulse
 * folded in) by the caller — the same values the inline block read before
 * extraction. Runs unconditionally; the caller gates on the boundary check
 * (this function does none itself), so it must be called at most once per
 * tick. The netWorth snapshot always stays last, so the day's fees, fines and
 * settlements land inside the day's curve point (docs/specs/E3 — Tick
 * day-boundary order).
 */
function dayBoundary(world: World): World {
  // Every day-boundary consumer (drift, offer generation — #93) draws from
  // its own isolated substream derived from `world.rng` *before* this boundary
  // advances it (deriveSubstream, rng.ts) — so no consumer's draw count can
  // perturb another's. The main stream itself advances exactly once,
  // unconditionally, regardless of how many (if any) draws a substream makes
  // internally; that advanced state is the only one ever threaded back into
  // `World.rng` (docs/specs/E3-contracts-and-guilds.md — Contracts).
  // Offer generation (contract.ts) turned out to need no randomness at all —
  // candidates are picked by largest shortfall with a canonical tie-break,
  // never the RNG — so no "offers" substream is derived here; flagged in the
  // #93 completion report as a deliberate deviation from the spec's literal
  // `deriveSubstream(state, "offers")` wording (nothing would ever consume
  // it). The main stream's single unconditional advance below still holds.
  const [flowDrift] = driftStep(world.region, world.flowDrift, deriveSubstream(world.rng, "drift"));
  const [, rng] = nextUint32(world.rng);

  let next: World = {
    ...world,
    rng,
    priceSnapshots: snapshotPrices(world.region),
    flowDrift,
  };
  next = chargeUpkeep(next);
  // Contract settlements (#94): after upkeep, before offer refresh, per the
  // spec's day-boundary order — a settled period's fee/points land inside
  // this same boundary before the board and the netWorth snapshot see it.
  next = settleContracts(next);
  // Offer refresh (#93): generation + causal expiry, after contract
  // settlements and before the netWorth snapshot, per the spec's day-boundary
  // order. Sized against a fixed reference hold (STARTING_HOLD) rather than
  // any real ship's hold — a guild's offer is a promise to the market, not
  // tailored to the player's current fleet.
  next = {
    ...next,
    contractOffers: refreshContractOffers(next.region, next.contractOffers, STARTING_HOLD),
  };
  // Daily net-worth snapshot (docs/specs/E9 — Ledger): thalers + fleet cargo +
  // build-site store, at region-average mid price; ships/buildings carry no
  // book value. Tagged with the boundary tick, same cadence as the price
  // snapshot above.
  return appendLedgerEvent(next, { kind: "netWorth", tick: world.tick, ...computeNetWorth(next) });
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
