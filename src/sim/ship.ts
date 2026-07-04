import { GOOD_IDS, type GoodId } from "./goods";
import type { LaneId, PortId, Region } from "./region";

export type ShipId = string;

/** One leg of a route: traverse `laneId`, arriving at port `to`. */
export interface RouteStep {
  readonly laneId: LaneId;
  readonly to: PortId;
}

export type ShipLocation =
  | { readonly kind: "docked"; readonly portId: PortId }
  | {
      readonly kind: "underway";
      readonly route: readonly RouteStep[];
      readonly legIndex: number;
      /** Ticks already sailed on the current leg. */
      readonly legProgressTicks: number;
      readonly destination: PortId;
    };

export interface Ship {
  readonly id: ShipId;
  /** Hold: total cargo capacity (CONTEXT.md). */
  readonly holdCapacity: number;
  /** Cargo aboard, zero-filled for every good (deterministic iteration). */
  readonly cargo: Record<GoodId, number>;
  readonly location: ShipLocation;
}

export function emptyCargo(): Record<GoodId, number> {
  const cargo = {} as Record<GoodId, number>;
  for (const good of GOOD_IDS) cargo[good] = 0;
  return cargo;
}

export function cargoUsed(ship: Ship): number {
  return GOOD_IDS.reduce((sum, good) => sum + ship.cargo[good], 0);
}

/**
 * One tick of travel. Intermediate ports are passed without docking: a
 * finished leg rolls straight into the next; only the last leg docks.
 */
export function advanceShip(ship: Ship, region: Region): Ship {
  if (ship.location.kind !== "underway") return ship;
  const { route, legIndex, destination } = ship.location;
  const lane = region.lanes.find((l) => l.id === route[legIndex].laneId)!;
  const progress = ship.location.legProgressTicks + 1;
  if (progress < lane.voyageTicks) {
    return { ...ship, location: { ...ship.location, legProgressTicks: progress } };
  }
  if (legIndex + 1 < route.length) {
    return {
      ...ship,
      location: { kind: "underway", route, legIndex: legIndex + 1, legProgressTicks: 0, destination },
    };
  }
  return { ...ship, location: { kind: "docked", portId: destination } };
}
