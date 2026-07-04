import type { GoodId } from "./goods";
import { quoteBuy, quoteSell } from "./market";
import { shortestRoute } from "./pathfinding";
import type { Port, PortId } from "./region";
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
  | { readonly kind: "sell"; readonly shipId: ShipId; readonly good: GoodId; readonly qty: number };

/** Applies one command, returning the input world unchanged on rejection. */
export function applyCommand(world: World, command: Command): World {
  const ship = world.company.ships.find((s) => s.id === command.shipId);
  if (!ship || ship.location.kind !== "docked") return world;
  const dockedAt = ship.location.portId;
  const port = world.region.ports.find((p) => p.id === dockedAt)!;

  switch (command.kind) {
    case "buy": {
      const total = quoteBuy(command.good, port.market[command.good], command.qty);
      if (total === null) return world;
      if (total > world.company.thalers) return world;
      if (cargoUsed(ship) + command.qty > ship.hold) return world;
      return applyTrade(world, ship, port, command.good, -command.qty, -total);
    }
    case "sell": {
      if (!Number.isInteger(command.qty) || command.qty <= 0) return world;
      if (ship.cargo[command.good] < command.qty) return world;
      const total = quoteSell(command.good, port.market[command.good], command.qty);
      if (total === null) return world;
      return applyTrade(world, ship, port, command.good, command.qty, total);
    }
    case "sailTo": {
      if (command.portId === port.id) return world;
      const route = shortestRoute(world.region, port.id, command.portId);
      if (route === null || route.length === 0) return world;
      const underway: Ship = {
        ...ship,
        location: {
          kind: "underway",
          route,
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
