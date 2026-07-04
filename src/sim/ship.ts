import { GOOD_IDS, type GoodId } from "./goods";
import type { LaneId, PortId, Region } from "./region";

export type ShipId = string;

/** One voyage of a route: traverse `laneId`, arriving at port `to`
 *  (CONTEXT.md: Voyage — one traversal of a lane by a ship). */
export interface Voyage {
  readonly laneId: LaneId;
  readonly to: PortId;
}

export type ShipLocation =
  | { readonly kind: "docked"; readonly portId: PortId }
  | {
      readonly kind: "underway";
      /** Route: the ordered voyages left to the destination (CONTEXT.md). */
      readonly route: readonly Voyage[];
      readonly voyageIndex: number;
      /** Ticks already sailed on the current voyage. */
      readonly voyageProgressTicks: number;
      readonly destination: PortId;
    };

export interface Ship {
  readonly id: ShipId;
  /** Hold: total cargo capacity in units (CONTEXT.md). */
  readonly hold: number;
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

/** Ticks until the ship docks; 0 when already docked. */
export function etaTicks(ship: Ship, region: Region): number {
  if (ship.location.kind !== "underway") return 0;
  const { route, voyageIndex, voyageProgressTicks } = ship.location;
  let eta = -voyageProgressTicks;
  for (let i = voyageIndex; i < route.length; i++) {
    eta += region.lanes.find((l) => l.id === route[i].laneId)!.voyageTicks;
  }
  return eta;
}

/**
 * One tick of travel. Intermediate ports are passed without docking: a
 * finished voyage rolls straight into the next; only the last one docks.
 */
export function advanceShip(ship: Ship, region: Region): Ship {
  if (ship.location.kind !== "underway") return ship;
  const { route, voyageIndex, destination } = ship.location;
  const lane = region.lanes.find((l) => l.id === route[voyageIndex].laneId)!;
  const progress = ship.location.voyageProgressTicks + 1;
  if (progress < lane.voyageTicks) {
    return { ...ship, location: { ...ship.location, voyageProgressTicks: progress } };
  }
  if (voyageIndex + 1 < route.length) {
    return {
      ...ship,
      location: {
        kind: "underway",
        route,
        voyageIndex: voyageIndex + 1,
        voyageProgressTicks: 0,
        destination,
      },
    };
  }
  return { ...ship, location: { kind: "docked", portId: destination } };
}
