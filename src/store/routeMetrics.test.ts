import { describe, expect, it } from "vitest";
import { createWorld, type LedgerEvent, type Route, type Ship, type World } from "../sim";
import { computeLoopMetrics, totalCourseTicks } from "./routeMetrics";

/** A two-Stop route on a directly-connected port pair (a single-voyage lane
 *  each way), so totalCourseTicks is exactly 2× the lane's voyageTicks. */
function twoStopRoute(w: World): { route: Route; a: string; b: string; laneTicks: number } {
  const lane = w.region.lanes[0];
  const route: Route = {
    id: "r",
    name: "loop",
    stops: [
      { portId: lane.a, orders: [{ kind: "buy", good: "grain" }] },
      { portId: lane.b, orders: [{ kind: "sell", good: "grain" }] },
    ],
  };
  return { route, a: lane.a, b: lane.b, laneTicks: lane.voyageTicks };
}

/** Ship s0 assigned to `route`, docked wherever the base world left it —
 *  location is irrelevant to these selectors (they read the Ledger only). */
function assignedShip(w: World, routeId: string): Ship {
  return { ...w.company.ships[0], assignment: { routeId, nextStopIndex: 0, suspended: false } };
}

describe("totalCourseTicks", () => {
  it("sums the Course ticks around the whole loop, back to Stop 0", () => {
    const w = createWorld("metrics-geometry");
    const { route, laneTicks } = twoStopRoute(w);
    expect(totalCourseTicks(w.region, route)).toBe(2 * laneTicks);
  });

  it("skips a zero-length hop between consecutive Stops at the same port", () => {
    const w = createWorld("metrics-colocated");
    const { route: base, a, laneTicks } = twoStopRoute(w);
    const route: Route = { ...base, stops: [...base.stops, { portId: a, orders: [] }] };
    // A -> B -> A -> A: the last hop (A -> A) contributes nothing.
    expect(totalCourseTicks(w.region, route)).toBe(2 * laneTicks);
  });
});

describe("computeLoopMetrics", () => {
  it("reports null loop fields before a second Stop-0 visit closes a first loop", () => {
    const w0 = createWorld("metrics-nogaps");
    const { route } = twoStopRoute(w0);
    const w: World = { ...w0, company: { ...w0.company, routes: [route] }, ledger: [] };
    const metrics = computeLoopMetrics(w, route);
    expect(metrics.lastLoopTicks).toBeNull();
    expect(metrics.lastLoopTradeResult).toBeNull();
    expect(metrics.lastLoopDockingFees).toBeNull();
    expect(metrics.lastLoopNet).toBeNull();
    expect(metrics.totalCourseTicks).toBeGreaterThan(0);
  });

  it("folds trades + correlates docking fees between the last two Stop-0 visits, by hand-built ledger", () => {
    const w0 = createWorld("metrics-fold");
    const { route, a, b } = twoStopRoute(w0);
    const ship = assignedShip(w0, route.id);

    // Two full loops: buy@A (Stop 0) -> sell@B (Stop 1) -> buy@A (Stop 0, closes
    // loop 1 / opens loop 2) -> sell@B -> buy@A (closes loop 2). Docking fees
    // accompany every dock, tagged with the assigned ship.
    const ledger: LedgerEvent[] = [
      // Loop 1: ticks [10, 30) — not the last loop, must be ignored.
      { kind: "dockingFee", tick: 10, shipId: ship.id, portId: a, thalers: 5 },
      { kind: "trade", tick: 10, shipId: ship.id, portId: a, good: "grain", side: "buy", qty: 10, thalers: 100, routeId: route.id },
      { kind: "dockingFee", tick: 20, shipId: ship.id, portId: b, thalers: 5 },
      { kind: "trade", tick: 20, shipId: ship.id, portId: b, good: "grain", side: "sell", qty: 10, thalers: 130, routeId: route.id },
      // Loop 2 boundary open + close: ticks [30, 50).
      { kind: "dockingFee", tick: 30, shipId: ship.id, portId: a, thalers: 5 },
      { kind: "trade", tick: 30, shipId: ship.id, portId: a, good: "grain", side: "buy", qty: 12, thalers: 150, routeId: route.id },
      { kind: "dockingFee", tick: 40, shipId: ship.id, portId: b, thalers: 5 },
      { kind: "trade", tick: 40, shipId: ship.id, portId: b, good: "grain", side: "sell", qty: 12, thalers: 190, routeId: route.id },
      { kind: "dockingFee", tick: 50, shipId: ship.id, portId: a, thalers: 5 },
      { kind: "trade", tick: 50, shipId: ship.id, portId: a, good: "grain", side: "buy", qty: 8, thalers: 90, routeId: route.id },
    ];
    const w: World = {
      ...w0,
      company: { ...w0.company, routes: [route], ships: [ship] },
      ledger,
    };

    const metrics = computeLoopMetrics(w, route);
    // Last loop window is [30, 50): the tick-50 buy (next loop's opener) is
    // excluded, matching "between consecutive Stop-0 visits".
    expect(metrics.lastLoopTicks).toBe(20);
    // trade result: sell 190 - buy 150 = 40.
    expect(metrics.lastLoopTradeResult).toBe(40);
    // docking fees in [30, 50): tick 30 (5) + tick 40 (5) = 10.
    expect(metrics.lastLoopDockingFees).toBe(10);
    expect(metrics.lastLoopNet).toBe(30);
  });

  it("does not attribute docking fees from ships no longer assigned to this route", () => {
    const w0 = createWorld("metrics-unassigned");
    const { route, a, b } = twoStopRoute(w0);
    // s0 is NOT assigned to the route (e.g. it was unassigned after sailing it).
    const ship = w0.company.ships[0];
    const ledger: LedgerEvent[] = [
      { kind: "trade", tick: 10, shipId: ship.id, portId: a, good: "grain", side: "buy", qty: 5, thalers: 50, routeId: route.id },
      { kind: "dockingFee", tick: 10, shipId: ship.id, portId: a, thalers: 5 },
      { kind: "trade", tick: 20, shipId: ship.id, portId: b, good: "grain", side: "sell", qty: 5, thalers: 65, routeId: route.id },
      { kind: "dockingFee", tick: 20, shipId: ship.id, portId: b, thalers: 5 },
      { kind: "trade", tick: 30, shipId: ship.id, portId: a, good: "grain", side: "buy", qty: 5, thalers: 55, routeId: route.id },
    ];
    const w: World = { ...w0, company: { ...w0.company, routes: [route], ships: [ship] }, ledger };

    const metrics = computeLoopMetrics(w, route);
    expect(metrics.lastLoopTradeResult).toBe(65 - 50); // trades still fold by routeId alone
    expect(metrics.lastLoopDockingFees).toBe(0); // no currently-assigned ship to correlate
  });
});
