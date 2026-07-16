import {
  effectiveBase,
  GOODS,
  type GoodId,
  type Port,
  type PortId,
  type Ship,
  type World,
} from "../sim";
// Deviation (flagged in the E9.1 wave-2 completion report): `resolveReferencePort`
// (route.ts) and `unitMargin` (market.ts) are correctly shaped per the E9.1 spec
// but aren't re-exported from the `src/sim` barrel (index.ts) yet — only their
// *types* are. Per the task package, editing src/sim (even the barrel) is out
// of scope for this UI-only pass, so this imports the two functions by direct
// subpath instead. Recommend the Orchestrator fold the two re-exports into the
// barrel so future UI consumers can go through `../sim` like everything else.
import { unitMargin } from "../sim/market";
import { resolveReferencePort } from "../sim/route";

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

/** *"czeka na marżę ≥ X (teraz Y)"* (CONTEXT.md — Margin Gate, ADR-0007): the
 *  one required-by-spec player-facing string. Prefixes the good's name when
 *  more than one gate is holding the same Stop (v1's atomic wait). */
export function formatWaitingGates(gates: readonly WaitingGate[]): string {
  const multi = gates.length > 1;
  return gates
    .map((g) => {
      const live = g.liveMargin === null ? "—" : `₸${g.liveMargin}`;
      const line = `czeka na marżę ≥ ₸${g.minMargin} (teraz ${live})`;
      return multi ? `${GOODS[g.good].name}: ${line}` : line;
    })
    .join("; ");
}
