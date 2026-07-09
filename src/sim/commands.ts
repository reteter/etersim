import type { GoodId } from "./goods";
import {
  applyDeliveryToSite,
  HEADQUARTERS_COST,
  LABOR_FEE,
  launchIfComplete,
  remainingNeed,
  SHIP_RECIPE,
  type Headquarters,
} from "./building";
import { effectiveBase, quoteBuy, quoteSell } from "./market";
import { shortestCourse } from "./pathfinding";
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
  | { readonly kind: "sell"; readonly shipId: ShipId; readonly good: GoodId; readonly qty: number }
  // E9 HQ & construction (one at a time; no ship required for found/place/rush)
  | { readonly kind: "foundHeadquarters"; readonly portId: PortId }
  | { readonly kind: "placeBuildOrder" }
  | { readonly kind: "rushBuild" }
  | { readonly kind: "deliver"; readonly shipId: ShipId; readonly good: GoodId };

/** Applies one command, returning the input world unchanged on rejection. */
export function applyCommand(world: World, command: Command): World {
  switch (command.kind) {
    case "foundHeadquarters": {
      if (world.company.headquarters) return world;
      if (world.company.thalers < HEADQUARTERS_COST) return world;
      const portExists = world.region.ports.some((p) => p.id === command.portId);
      if (!portExists) return world;
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
      const siteStore = {} as Record<GoodId, number>;
      for (const g of Object.keys(SHIP_RECIPE) as GoodId[]) siteStore[g] = 0;
      const nextHq: Headquarters = { portId: hq.portId, buildOrder: { siteStore } };
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
      const port = world.region.ports.find((p) => p.id === hq.portId);
      if (!port) return world;

      let thalers = world.company.thalers;
      let siteStore = { ...hq.buildOrder.siteStore };
      const ports = [...world.region.ports];
      const pIdx = ports.findIndex((p) => p.id === hq.portId);
      let curPort = ports[pIdx];

      for (const good of Object.keys(SHIP_RECIPE) as GoodId[]) {
        const need = remainingNeed(siteStore, good);
        if (need <= 0) continue;
        const entry = curPort.market[good];
        const stockAvail = Math.floor(entry.stock);
        const buyQty = Math.min(need, stockAvail);
        if (buyQty <= 0) continue;
        const base = effectiveBase(curPort, good);
        const cost = quoteBuy(entry, base, buyQty);
        if (cost === null || cost > thalers) {
          // cannot afford even this partial; try smaller? for exact ≡ we take largest affordable <= buyQty
          let q = buyQty - 1;
          while (q > 0) {
            const c = quoteBuy(entry, base, q);
            if (c !== null && c <= thalers) {
              // use q
              thalers -= c;
              siteStore = { ...siteStore, [good]: (siteStore[good] ?? 0) + q };
              const newEntry = { ...entry, stock: entry.stock - q };
              curPort = { ...curPort, market: { ...curPort.market, [good]: newEntry } };
              ports[pIdx] = curPort;
              break;
            }
            q--;
          }
          continue;
        }
        thalers -= cost;
        siteStore = { ...siteStore, [good]: (siteStore[good] ?? 0) + buyQty };
        const newEntry = { ...entry, stock: entry.stock - buyQty };
        curPort = { ...curPort, market: { ...curPort.market, [good]: newEntry } };
        ports[pIdx] = curPort;
      }

      let next: World = {
        ...world,
        company: {
          ...world.company,
          thalers,
          headquarters: { portId: hq.portId, buildOrder: { siteStore } },
        },
        region: { ...world.region, ports },
      };
      next = launchIfComplete(next);
      return next;
    }
    case "deliver": {
      const ship = world.company.ships.find((s) => s.id === command.shipId);
      if (!ship || ship.location.kind !== "docked") return world;
      const dockedAt = ship.location.portId;
      const hq = world.company.headquarters;
      if (!hq || !hq.buildOrder || hq.portId !== dockedAt) return world;

      const { siteStore: newStore, moved } = applyDeliveryToSite(
        hq.buildOrder.siteStore,
        ship.cargo,
        command.good,
      );
      if (moved <= 0) {
        // no-op but valid command; still check launch in case edge
        return launchIfComplete(world);
      }

      const updatedShip: Ship = {
        ...ship,
        cargo: { ...ship.cargo, [command.good]: ship.cargo[command.good] - moved },
      };
      const withShip = replaceShip(world, updatedShip);
      let next: World = {
        ...withShip,
        company: {
          ...withShip.company,
          headquarters: { portId: hq.portId, buildOrder: { siteStore: newStore } },
        },
      };
      next = launchIfComplete(next);
      return next;
    }

    // ship-requiring commands below
    default: {
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
          const underway: Ship = {
            ...ship,
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
