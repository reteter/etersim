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
  /** Ticks the last complete loop took, or null before two Stop-0 visits exist. */
  readonly lastLoopTicks: number | null;
  /** Net thalers from routeId-tagged trades in the last complete loop
   *  (sells positive, buys negative), or null before one exists. */
  readonly lastLoopTradeResult: number | null;
  /** Docking fees paid by ships currently assigned to this route within the
   *  last loop's tick window, or null before one exists (see #116 caveat). */
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

/**
 * Ascending, de-duplicated ticks at which a routeId-tagged trade happened at
 * the Route's Stop 0 port — the loop-boundary heuristic (docs/specs/E9 —
 * "ledger fold by routeId between consecutive Stop-0 visits"). Only `trade`
 * events carry `routeId` (issue #116), so this needs Stop 0 to have at least
 * one buy/sell order: a deliver-only or order-less Stop 0 produces no
 * boundary and the loop can't be resolved from the Ledger alone (a known
 * resolution limit, not a crash — `computeLoopMetrics` just reports "no
 * complete loop yet"). If Stop 0's port recurs later in the same loop
 * (allowed — the distinct-port rule only requires ≥2 distinct ports total),
 * that recurrence is mistaken for a boundary too, splitting one loop's
 * numbers across two reads instead of one — also a resolution limit.
 */
function stop0BoundaryTicks(ledger: readonly LedgerEvent[], route: Route): number[] {
  const stop0PortId = route.stops[0]?.portId;
  if (stop0PortId === undefined) return [];
  const ticks = new Set<number>();
  for (const event of ledger) {
    if (event.kind === "trade" && event.routeId === route.id && event.portId === stop0PortId) {
      ticks.add(event.tick);
    }
  }
  return [...ticks].sort((a, b) => a - b);
}

/**
 * Loop metrics for one Route: total Course ticks (always available) plus the
 * last complete loop's trade result, docking fees and net — all `null` until
 * a second Stop-0 visit closes a first loop, so the UI can show "no loop
 * yet" instead of a misleading zero.
 *
 * Docking fees have no `routeId` on their Ledger event (#116), so they're
 * attributed by correlating `shipId` (ships currently assigned to this
 * route) with the loop's tick window — a ship reassigned mid-window would
 * misattribute its fees, an accepted approximation for a look-back metric.
 */
export function computeLoopMetrics(world: World, route: Route): LoopMetrics {
  const totalTicks = totalCourseTicks(world.region, route);
  const boundaries = stop0BoundaryTicks(world.ledger, route);
  if (boundaries.length < 2) {
    return {
      totalCourseTicks: totalTicks,
      lastLoopTicks: null,
      lastLoopTradeResult: null,
      lastLoopDockingFees: null,
      lastLoopNet: null,
    };
  }

  const from = boundaries[boundaries.length - 2];
  const to = boundaries[boundaries.length - 1];

  let tradeResult = 0;
  for (const event of world.ledger) {
    if (event.kind === "trade" && event.routeId === route.id && event.tick >= from && event.tick < to) {
      tradeResult += event.side === "sell" ? event.thalers : -event.thalers;
    }
  }

  const assignedShipIds = new Set<ShipId>(
    world.company.ships.filter((s) => s.assignment?.routeId === route.id).map((s) => s.id),
  );
  let dockingFees = 0;
  for (const event of world.ledger) {
    if (
      event.kind === "dockingFee" &&
      assignedShipIds.has(event.shipId) &&
      event.tick >= from &&
      event.tick < to
    ) {
      dockingFees += event.thalers;
    }
  }

  return {
    totalCourseTicks: totalTicks,
    lastLoopTicks: to - from,
    lastLoopTradeResult: tradeResult,
    lastLoopDockingFees: dockingFees,
    lastLoopNet: tradeResult - dockingFees,
  };
}
