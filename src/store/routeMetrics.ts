import {
  courseTicks,
  shortestCourse,
  type LedgerEvent,
  type Region,
  type Route,
  type ShipId,
  type World,
} from "../sim";

/**
 * Per-route loop metrics for the Headquarters panel's Trasy tab
 * (docs/specs/E9-fleet-and-routes.md — Loop metrics, UX skeleton). Pure
 * selectors over a World + Route — the store-side "fold ledger by routeId"
 * work the spec's Tech section assigns to `src/store` rather than `src/sim`.
 */
export interface LoopMetrics {
  /** Sum of Course ticks around the whole loop (static geometry, no Ledger). */
  readonly totalCourseTicks: number;
  /** Net thalers from the loop ship's routeId-tagged trades in the last
   *  complete loop (sells positive, buys negative), or null before one exists. */
  readonly lastLoopTradeResult: number | null;
  /** Docking fees the loop's ship paid within the last loop's tick window,
   *  or null before one exists (see #116 caveat on attribution). */
  readonly lastLoopDockingFees: number | null;
  /** lastLoopTradeResult − lastLoopDockingFees — the route-rot number. */
  readonly lastLoopNet: number | null;
}

/** Sum of `courseTicks` between each consecutive Stop of `route`, looping
 *  back from the last Stop to the first — the loop's total travel time.
 *  A repeated port between consecutive Stops (a co-located Stop pair)
 *  contributes no travel. Pure geometry: independent of the Ledger. */
export function totalCourseTicks(region: Region, route: Route): number {
  let ticks = 0;
  for (let i = 0; i < route.stops.length; i++) {
    const from = route.stops[i].portId;
    const to = route.stops[(i + 1) % route.stops.length].portId;
    if (from === to) continue;
    const course = shortestCourse(region, from, to);
    if (course) ticks += courseTicks(region, course);
  }
  return ticks;
}

/** The most recently completed loop: which ship closed it and its half-open
 *  tick window [from, to). */
interface LoopWindow {
  readonly shipId: ShipId;
  readonly from: number;
  readonly to: number;
}

/**
 * Loop boundaries are routeId-tagged trades at the Route's Stop 0 port
 * (docs/specs/E9 — "ledger fold by routeId between consecutive Stop-0
 * visits"), collected **per ship**: with several ships offset along the same
 * loop, one merged boundary set would slice loops into fragments and sum the
 * ships' trades together — per-ship boundaries keep each ship's loop whole.
 * The last complete loop overall is the per-ship window with the latest
 * closing tick.
 *
 * Only `trade` events carry `routeId` (issue #116), so this needs Stop 0 to
 * have at least one buy/sell order: a deliver-only or order-less Stop 0
 * produces no boundary and the loop can't be resolved from the Ledger alone
 * (a known resolution limit, not a crash — `computeLoopMetrics` just reports
 * "no complete loop yet"). If Stop 0's port recurs later in the same loop
 * (allowed — the distinct-port rule only requires ≥2 distinct ports total),
 * that recurrence is mistaken for a boundary too, splitting one loop's
 * numbers across two reads instead of one — also a resolution limit.
 */
function lastLoopWindow(ledger: readonly LedgerEvent[], route: Route): LoopWindow | null {
  const stop0PortId = route.stops[0]?.portId;
  if (stop0PortId === undefined) return null;
  const boundariesByShip = new Map<ShipId, Set<number>>();
  for (const event of ledger) {
    if (event.kind === "trade" && event.routeId === route.id && event.portId === stop0PortId) {
      const ticks = boundariesByShip.get(event.shipId);
      if (ticks) ticks.add(event.tick);
      else boundariesByShip.set(event.shipId, new Set([event.tick]));
    }
  }
  let latest: LoopWindow | null = null;
  for (const [shipId, tickSet] of boundariesByShip) {
    const ticks = [...tickSet].sort((a, b) => a - b);
    if (ticks.length < 2) continue;
    const to = ticks[ticks.length - 1];
    if (!latest || to > latest.to) {
      latest = { shipId, from: ticks[ticks.length - 2], to };
    }
  }
  return latest;
}

/**
 * Loop metrics for one Route: total Course ticks (always available) plus the
 * last complete loop's trade result, docking fees and net — all `null` until
 * a second Stop-0 visit by the same ship closes a first loop, so the UI can
 * show "no loop yet" instead of a misleading zero.
 *
 * Docking fees have no `routeId` on their Ledger event (#116), so they're
 * attributed to the ship that drove the loop (identified by its routeId-tagged
 * trades) within the loop's tick window — current assignment doesn't matter,
 * but a fee that ship paid inside the window while *off* the route (e.g.
 * assigned mid-window) is still counted, an accepted approximation for a
 * look-back metric.
 */
export function computeLoopMetrics(world: World, route: Route): LoopMetrics {
  const totalTicks = totalCourseTicks(world.region, route);
  const window = lastLoopWindow(world.ledger, route);
  if (!window) {
    return {
      totalCourseTicks: totalTicks,
      lastLoopTradeResult: null,
      lastLoopDockingFees: null,
      lastLoopNet: null,
    };
  }

  let tradeResult = 0;
  let dockingFees = 0;
  for (const event of world.ledger) {
    if (event.tick < window.from || event.tick >= window.to) continue;
    if (event.kind === "trade" && event.routeId === route.id && event.shipId === window.shipId) {
      tradeResult += event.side === "sell" ? event.thalers : -event.thalers;
    } else if (event.kind === "dockingFee" && event.shipId === window.shipId) {
      dockingFees += event.thalers;
    }
  }

  return {
    totalCourseTicks: totalTicks,
    lastLoopTradeResult: tradeResult,
    lastLoopDockingFees: dockingFees,
    lastLoopNet: tradeResult - dockingFees,
  };
}
