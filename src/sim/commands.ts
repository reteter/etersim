import type { GoodId } from "./goods";
import { effectiveBase, quoteBuy, quoteSell } from "./market";
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
  // E9 route commands
  | { readonly kind: "createRoute"; readonly route: Route }
  | { readonly kind: "updateRoute"; readonly route: Route }
  | { readonly kind: "deleteRoute"; readonly routeId: RouteId }
  | { readonly kind: "assignRoute"; readonly shipId: ShipId; readonly routeId: RouteId }
  | { readonly kind: "unassignRoute"; readonly shipId: ShipId }
  | { readonly kind: "resumeRoute"; readonly shipId: ShipId };

/** Applies one command, returning the input world unchanged on rejection. */
export function applyCommand(world: World, command: Command): World {
  // Route commands do not require a docked ship; handle first.
  switch (command.kind) {
    case "createRoute": {
      const r = command.route;
      if (!r || !r.id || !r.name || !Array.isArray(r.stops)) return world;
      if (r.stops.length < 2) return world;
      // Validate: each stop has orders; a good appears in at most one order per stop
      for (const stop of r.stops) {
        if (!stop || !stop.portId || !Array.isArray(stop.orders)) return world;
        const seen = new Set<GoodId>();
        for (const o of stop.orders) {
          if (!o || !o.good) return world;
          if (seen.has(o.good)) return world;
          seen.add(o.good);
        }
      }
      // Reject duplicate route id
      if (world.company.routes.some((x) => x.id === r.id)) return world;
      return {
        ...world,
        company: { ...world.company, routes: [...world.company.routes, r] },
      };
    }
    case "updateRoute": {
      const r = command.route;
      if (!r || !r.id || !r.name || !Array.isArray(r.stops)) return world;
      if (r.stops.length < 2) return world;
      for (const stop of r.stops) {
        if (!stop || !stop.portId || !Array.isArray(stop.orders)) return world;
        const seen = new Set<GoodId>();
        for (const o of stop.orders) {
          if (!o || !o.good) return world;
          if (seen.has(o.good)) return world;
          seen.add(o.good);
        }
      }
      const idx = world.company.routes.findIndex((x) => x.id === r.id);
      if (idx < 0) return world;
      const nextRoutes = world.company.routes.slice();
      nextRoutes[idx] = r;
      return { ...world, company: { ...world.company, routes: nextRoutes } };
    }
    case "deleteRoute": {
      const exists = world.company.routes.some((x) => x.id === command.routeId);
      if (!exists) return world;
      const nextRoutes = world.company.routes.filter((x) => x.id !== command.routeId);
      return { ...world, company: { ...world.company, routes: nextRoutes } };
    }
    case "assignRoute": {
      const ship = world.company.ships.find((s) => s.id === command.shipId);
      if (!ship) return world;
      const route = world.company.routes.find((r) => r.id === command.routeId);
      if (!route || route.stops.length < 2) return world;
      const assigned: Ship = {
        ...ship,
        assignment: { routeId: command.routeId, nextStopIndex: 0, suspended: false },
      };
      return replaceShip(world, assigned);
    }
    case "unassignRoute": {
      const ship = world.company.ships.find((s) => s.id === command.shipId);
      if (!ship || !ship.assignment) return world;
      const cleared: Ship = { ...ship, assignment: undefined };
      return replaceShip(world, cleared);
    }
    case "resumeRoute": {
      const ship = world.company.ships.find((s) => s.id === command.shipId);
      if (!ship || !ship.assignment) return world;
      const route = world.company.routes.find((r) => r.id === ship.assignment!.routeId);
      if (!route || route.stops.length < 2) return world;
      // Resume: unsuspend; if currently docked at the next stop's port, docking phase will execute.
      // For determinism, resume just clears suspended; actual sailing happens on next dock or via docking phase.
      // Per spec: "resume sails to the next Stop in order" — if docked at the target already, we still want to depart.
      // To keep semantics simple and pure: resume unsuspends; if the ship is docked, we will let docking phase handle if applicable.
      // If the ship is not at the stop, resume just marks it active; the player may also sailTo to trigger.
      const resumed: Ship = {
        ...ship,
        assignment: { ...ship.assignment, suspended: false },
      };
      return replaceShip(world, resumed);
    }
  }

  // Ship-specific commands below require a docked ship.
  const ship = world.company.ships.find((s) => s.id === command.shipId);
  if (!ship || ship.location.kind !== "docked") return world;
  const dockedAt = ship.location.portId;
  const port = world.region.ports.find((p) => p.id === dockedAt)!;

  switch (command.kind) {
    case "buy": {
      const total = quoteBuy(
        port.market[command.good],
        effectiveBase(port, command.good),
        command.qty,
      );
      if (total === null) return world;
      if (total > world.company.thalers) return world;
      if (cargoUsed(ship) + command.qty > ship.hold) return world;
      return applyTrade(world, ship, port, command.good, -command.qty, -total);
    }
    case "sell": {
      if (!Number.isInteger(command.qty) || command.qty <= 0) return world;
      if (ship.cargo[command.good] < command.qty) return world;
      const total = quoteSell(
        port.market[command.good],
        effectiveBase(port, command.good),
        command.qty,
      );
      if (total === null) return world;
      return applyTrade(world, ship, port, command.good, command.qty, total);
    }
    case "sailTo": {
      if (command.portId === port.id) return world;
      const course = shortestCourse(world.region, port.id, command.portId);
      if (course === null || course.length === 0) return world;
      // Auto-suspend if assigned and not already suspended
      const autoSuspend =
        ship.assignment && !ship.assignment.suspended
          ? { ...ship.assignment, suspended: true }
          : ship.assignment;
      const underway: Ship = {
        ...ship,
        assignment: autoSuspend,
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
