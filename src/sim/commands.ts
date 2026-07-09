import {
  applyDeliveryToSite,
  emptySiteStore,
  HEADQUARTERS_COST,
  LABOR_FEE,
  launchIfComplete,
  remainingNeed,
  type Headquarters,
} from "./building";
import { GOOD_IDS, type GoodId } from "./goods";
import { effectiveBase, maxAffordableQty, quoteBuy, quoteSell } from "./market";
import { shortestCourse } from "./pathfinding";
import type { Port, PortId } from "./region";
import type { Route, RouteId } from "./route";
import { cargoUsed, type Ship, type ShipId } from "./ship";
import type { World } from "./world";

/**
 * Command: a player order applied at a tick boundary (CONTEXT.md). Invalid
 * commands are rejected without state change — dropped, never partially
 * applied (docs/specs/E2-trade-loop.md — Tech).
 */
export type Command =
  | { readonly kind: "sailTo"; readonly shipId: ShipId; readonly portId: PortId }
  | { readonly kind: "buy"; readonly shipId: ShipId; readonly good: GoodId; readonly qty: number }
  | { readonly kind: "sell"; readonly shipId: ShipId; readonly good: GoodId; readonly qty: number }
  // E9 route commands (all player mutations stay Commands — determinism + E11 replay).
  | { readonly kind: "createRoute"; readonly route: Route }
  | { readonly kind: "updateRoute"; readonly route: Route }
  | { readonly kind: "deleteRoute"; readonly routeId: RouteId }
  | { readonly kind: "assignRoute"; readonly shipId: ShipId; readonly routeId: RouteId }
  | { readonly kind: "unassignRoute"; readonly shipId: ShipId }
  | { readonly kind: "resumeRoute"; readonly shipId: ShipId }
  // E9 Headquarters & construction (found/place/rush need no ship).
  | { readonly kind: "foundHeadquarters"; readonly portId: PortId }
  | { readonly kind: "placeBuildOrder" }
  | { readonly kind: "rushBuild" }
  | { readonly kind: "deliver"; readonly shipId: ShipId; readonly good: GoodId };

/** A Route is assignable iff it has ≥2 Stops spanning ≥2 distinct ports, and no
 *  good appears in more than one order per Stop. The distinct-port rule stops an
 *  all-same-port loop from executing (and never paying a docking fee) forever. */
function isValidRoute(route: Route): boolean {
  if (!route || !route.id || !route.name || !Array.isArray(route.stops)) return false;
  if (route.stops.length < 2) return false;
  const ports = new Set<PortId>();
  for (const stop of route.stops) {
    if (!stop || !stop.portId || !Array.isArray(stop.orders)) return false;
    ports.add(stop.portId);
    const seen = new Set<GoodId>();
    for (const order of stop.orders) {
      if (!order || !order.good) return false;
      if (seen.has(order.good)) return false;
      seen.add(order.good);
    }
  }
  return ports.size >= 2;
}

/** Applies one command, returning the input world unchanged on rejection. */
export function applyCommand(world: World, command: Command): World {
  switch (command.kind) {
    case "createRoute": {
      if (!isValidRoute(command.route)) return world;
      if (world.company.routes.some((r) => r.id === command.route.id)) return world;
      return {
        ...world,
        company: { ...world.company, routes: [...world.company.routes, command.route] },
      };
    }
    case "updateRoute": {
      if (!isValidRoute(command.route)) return world;
      const idx = world.company.routes.findIndex((r) => r.id === command.route.id);
      if (idx < 0) return world;
      const routes = world.company.routes.slice();
      routes[idx] = command.route;
      return { ...world, company: { ...world.company, routes } };
    }
    case "deleteRoute": {
      if (!world.company.routes.some((r) => r.id === command.routeId)) return world;
      return {
        ...world,
        company: {
          ...world.company,
          routes: world.company.routes.filter((r) => r.id !== command.routeId),
        },
      };
    }
    case "assignRoute": {
      // Pure state-setter: the tick route pass (ships[] order) does all dispatch
      // and Stop execution, so routes never introduce a second ordering regime.
      const ship = world.company.ships.find((s) => s.id === command.shipId);
      if (!ship) return world;
      const route = world.company.routes.find((r) => r.id === command.routeId);
      if (!route || route.stops.length < 2) return world;
      return replaceShip(world, {
        ...ship,
        assignment: { routeId: command.routeId, nextStopIndex: 0, suspended: false },
      });
    }
    case "unassignRoute": {
      const ship = world.company.ships.find((s) => s.id === command.shipId);
      if (!ship || !ship.assignment) return world;
      return replaceShip(world, { ...ship, assignment: undefined });
    }
    case "resumeRoute": {
      // Clear the suspend flag and wrap a stale index left out of range by a
      // shortening edit; the route pass re-dispatches to the next Stop in order
      // (predictable, never "nearest").
      const ship = world.company.ships.find((s) => s.id === command.shipId);
      if (!ship || !ship.assignment) return world;
      const route = world.company.routes.find((r) => r.id === ship.assignment!.routeId);
      if (!route || route.stops.length < 2) return world;
      const idx =
        ship.assignment.nextStopIndex >= 0 && ship.assignment.nextStopIndex < route.stops.length
          ? ship.assignment.nextStopIndex
          : 0;
      return replaceShip(world, {
        ...ship,
        assignment: { ...ship.assignment, nextStopIndex: idx, suspended: false },
      });
    }
    case "foundHeadquarters": {
      if (world.company.headquarters) return world;
      if (world.company.thalers < HEADQUARTERS_COST) return world;
      if (!world.region.ports.some((p) => p.id === command.portId)) return world;
      return {
        ...world,
        company: {
          ...world.company,
          thalers: world.company.thalers - HEADQUARTERS_COST,
          headquarters: { portId: command.portId },
        },
      };
    }
    case "placeBuildOrder": {
      const hq = world.company.headquarters;
      if (!hq || hq.buildOrder) return world;
      if (world.company.thalers < LABOR_FEE) return world;
      const nextHq: Headquarters = { portId: hq.portId, buildOrder: { siteStore: emptySiteStore() } };
      return {
        ...world,
        company: {
          ...world.company,
          thalers: world.company.thalers - LABOR_FEE,
          headquarters: nextHq,
        },
      };
    }
    case "rushBuild": {
      const hq = world.company.headquarters;
      if (!hq || !hq.buildOrder) return world;
      const portIdx = world.region.ports.findIndex((p) => p.id === hq.portId);
      if (portIdx < 0) return world;

      let thalers = world.company.thalers;
      let siteStore = { ...hq.buildOrder.siteStore };
      const ports = [...world.region.ports];
      let port = ports[portIdx];

      for (const good of GOOD_IDS) {
        const need = remainingNeed(siteStore, good);
        if (need <= 0) continue;
        const entry = port.market[good];
        const base = effectiveBase(port, good);
        const q = maxAffordableQty(entry, base, need, thalers);
        if (q <= 0) continue;
        thalers -= quoteBuy(entry, base, q)!;
        siteStore = { ...siteStore, [good]: (siteStore[good] ?? 0) + q };
        port = { ...port, market: { ...port.market, [good]: { ...entry, stock: entry.stock - q } } };
        ports[portIdx] = port;
      }

      const rushed: World = {
        ...world,
        company: {
          ...world.company,
          thalers,
          headquarters: { portId: hq.portId, buildOrder: { siteStore } },
        },
        region: { ...world.region, ports },
      };
      return launchIfComplete(rushed);
    }
    case "deliver": {
      const ship = world.company.ships.find((s) => s.id === command.shipId);
      if (!ship || ship.location.kind !== "docked") return world;
      const hq = world.company.headquarters;
      if (!hq || !hq.buildOrder || hq.portId !== ship.location.portId) return world;

      const { siteStore, moved } = applyDeliveryToSite(
        hq.buildOrder.siteStore,
        ship.cargo,
        command.good,
      );
      if (moved <= 0) return launchIfComplete(world);

      const delivered: Ship = {
        ...ship,
        cargo: { ...ship.cargo, [command.good]: ship.cargo[command.good] - moved },
      };
      const withShip = replaceShip(world, delivered);
      return launchIfComplete({
        ...withShip,
        company: {
          ...withShip.company,
          headquarters: { portId: hq.portId, buildOrder: { siteStore } },
        },
      });
    }
    case "buy": {
      const ship = world.company.ships.find((s) => s.id === command.shipId);
      if (!ship || ship.location.kind !== "docked") return world;
      const dockedAt = ship.location.portId;
      const port = world.region.ports.find((p) => p.id === dockedAt)!;
      const total = quoteBuy(port.market[command.good], effectiveBase(port, command.good), command.qty);
      if (total === null) return world;
      if (total > world.company.thalers) return world;
      if (cargoUsed(ship) + command.qty > ship.hold) return world;
      return applyTrade(world, ship, port, command.good, -command.qty, -total);
    }
    case "sell": {
      const ship = world.company.ships.find((s) => s.id === command.shipId);
      if (!ship || ship.location.kind !== "docked") return world;
      const dockedAt = ship.location.portId;
      const port = world.region.ports.find((p) => p.id === dockedAt)!;
      if (!Number.isInteger(command.qty) || command.qty <= 0) return world;
      if (ship.cargo[command.good] < command.qty) return world;
      const total = quoteSell(port.market[command.good], effectiveBase(port, command.good), command.qty);
      if (total === null) return world;
      return applyTrade(world, ship, port, command.good, command.qty, total);
    }
    case "sailTo": {
      const ship = world.company.ships.find((s) => s.id === command.shipId);
      if (!ship || ship.location.kind !== "docked") return world;
      const fromPortId = ship.location.portId;
      if (command.portId === fromPortId) return world;
      const course = shortestCourse(world.region, fromPortId, command.portId);
      if (course === null || course.length === 0) return world;
      // A manual sailTo auto-suspends an active Route — the plan stays assigned,
      // resume picks it up (never destroyed, never a confirmation dialog).
      const assignment =
        ship.assignment && !ship.assignment.suspended
          ? { ...ship.assignment, suspended: true }
          : ship.assignment;
      const underway: Ship = {
        ...ship,
        assignment,
        location: {
          kind: "underway",
          course,
          voyageIndex: 0,
          voyageProgressTicks: 0,
          destination: command.portId,
        },
      };
      return replaceShip(world, underway);
    }
  }
}

/** stockDelta moves the port stock; thalerDelta moves the company purse.
 *  Cargo moves opposite to stock. Positive stockDelta = ship selling. */
function applyTrade(
  world: World,
  ship: Ship,
  port: Port,
  good: GoodId,
  stockDelta: number,
  thalerDelta: number,
): World {
  const tradedShip: Ship = {
    ...ship,
    cargo: { ...ship.cargo, [good]: ship.cargo[good] - stockDelta },
  };
  const tradedPort: Port = {
    ...port,
    market: {
      ...port.market,
      [good]: { ...port.market[good], stock: port.market[good].stock + stockDelta },
    },
  };
  const withShip = replaceShip(world, tradedShip);
  return {
    ...withShip,
    company: { ...withShip.company, thalers: withShip.company.thalers + thalerDelta },
    region: {
      ...withShip.region,
      ports: withShip.region.ports.map((p) => (p.id === port.id ? tradedPort : p)),
    },
  };
}

function replaceShip(world: World, ship: Ship): World {
  return {
    ...world,
    company: {
      ...world.company,
      ships: world.company.ships.map((s) => (s.id === ship.id ? ship : s)),
    },
  };
}
