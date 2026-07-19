import type { GoodId } from "./goods";
import { effectiveBase, unitMargin } from "./market";
import type { Port, PortId } from "./region";
import { resolveReferencePort } from "./route";
import type { Ship } from "./ship";
import type { World } from "./world";

/**
 * One active Margin Gate a waiting ship is dwelling on (E9.1, ADR-0007): the
 * good, its threshold, and the live predicted margin — derived from the
 * route + current prices via the same sim functions the gate itself uses,
 * never stored (the sim only persists the `waiting` bit).
 */
export interface WaitingGate {
  readonly good: GoodId;
  readonly minMargin: number;
  /** `null` when `unitMargin` can't evaluate today (e.g. zero local stock) —
   *  matches the sim's own "unevaluable ⇒ keep waiting" reading. */
  readonly liveMargin: number | null;
}

function portById(ports: readonly Port[], id: PortId): Port | undefined {
  return ports.find((p) => p.id === id);
}

/**
 * Active Margin Gates that can be the reason `ship` is dwelling (`waiting`).
 * A gate with no resolvable reference port is *inactive* — `runRouteForShip`
 * treats it as always-passing — so it can never be the cause of a wait and is
 * filtered out here; the editor's own inactive-gate warning is what tells the
 * player about those. Returns `[]` when the ship isn't waiting or its
 * assignment/route/Stop can't be resolved (defensive; shouldn't happen for a
 * genuinely waiting ship).
 */
export function waitingGates(world: World, ship: Ship): WaitingGate[] {
  const assignment = ship.assignment;
  if (!assignment?.waiting) return [];
  const route = world.company.routes.find((r) => r.id === assignment.routeId);
  if (!route) return [];
  const stop = route.stops[assignment.nextStopIndex];
  if (!stop) return [];
  const herePort = portById(world.region.ports, stop.portId);
  if (!herePort) return [];

  const gates: WaitingGate[] = [];
  for (const order of stop.orders) {
    if (order.kind !== "buy" || order.minMargin === undefined) continue;
    const referencePortId = resolveReferencePort(route, assignment.nextStopIndex, order.good);
    if (referencePortId === null) continue;
    const referencePort = portById(world.region.ports, referencePortId);
    if (!referencePort) continue;
    const liveMargin = unitMargin(
      herePort.market[order.good],
      effectiveBase(herePort, order.good),
      referencePort.market[order.good],
      effectiveBase(referencePort, order.good),
    );
    gates.push({ good: order.good, minMargin: order.minMargin, liveMargin });
  }
  return gates;
}
