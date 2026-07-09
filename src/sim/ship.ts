import { GOOD_IDS, type GoodId } from "./goods";
import type { RouteId } from "./route";
import type { LaneId, PortId, Region } from "./region";

export type ShipId = string;

/** One voyage of a course: traverse `laneId`, arriving at port `to`
 *  (CONTEXT.md: Voyage — one traversal of a lane by a ship). */
export interface Voyage {
  readonly laneId: LaneId;
  readonly to: PortId;
}

export type ShipLocation =
  | { readonly kind: "docked"; readonly portId: PortId }
  | {
      readonly kind: "underway";
      /** Course: the ordered voyages left to the destination (CONTEXT.md). */
      readonly course: readonly Voyage[];
      readonly voyageIndex: number;
      /** Ticks already sailed on the current voyage. */
      readonly voyageProgressTicks: number;
      readonly destination: PortId;
    };

/** Assignment of a Route to a Ship (E9). */
export interface ShipAssignment {
  readonly routeId: RouteId;
  readonly nextStopIndex: number;
  readonly suspended: boolean;
}

export interface Ship {
  readonly id: ShipId;
  /** Display name (E9 #54); may be minimal (e.g., id) until UI layer. */
  readonly name?: string;
  /** Hold: total cargo capacity in units (CONTEXT.md). */
  readonly hold: number;
  /** Cargo aboard, zero-filled for every good (deterministic iteration). */
  readonly cargo: Record<GoodId, number>;
  readonly location: ShipLocation;
  /** Route assignment, if any (E9). */
  readonly assignment?: ShipAssignment;
}

export function emptyCargo(): Record<GoodId, number> {
  const cargo = {} as Record<GoodId, number>;
  for (const good of GOOD_IDS) cargo[good] = 0;
  return cargo;
}

export function cargoUsed(ship: Ship): number {
  return GOOD_IDS.reduce((sum, good) => sum + ship.cargo[good], 0);
}

/** Total voyage duration of a course, in ticks — the sum of its lanes'
 *  durations. The single home for course→ticks arithmetic (etaTicks and the
 *  UI's sailTo preview both build on it). */
export function courseTicks(region: Region, course: readonly Voyage[]): number {
  let ticks = 0;
  for (const voyage of course) {
    ticks += region.lanes.find((l) => l.id === voyage.laneId)!.voyageTicks;
  }
  return ticks;
}

/** Ticks until the ship docks; 0 when already docked. */
export function etaTicks(ship: Ship, region: Region): number {
  if (ship.location.kind !== "underway") return 0;
  const { course, voyageIndex, voyageProgressTicks } = ship.location;
  return courseTicks(region, course.slice(voyageIndex)) - voyageProgressTicks;
}

/**
 * One tick of travel. Intermediate ports are passed without docking: a
 * finished voyage rolls straight into the next; only the last one docks.
 */
export function advanceShip(ship: Ship, region: Region): Ship {
  if (ship.location.kind !== "underway") return ship;
  const { course, voyageIndex, destination } = ship.location;
  const lane = region.lanes.find((l) => l.id === course[voyageIndex].laneId)!;
  const progress = ship.location.voyageProgressTicks + 1;
  if (progress < lane.voyageTicks) {
    return { ...ship, location: { ...ship.location, voyageProgressTicks: progress } };
  }
  if (voyageIndex + 1 < course.length) {
    return {
      ...ship,
      location: {
        kind: "underway",
        course,
        voyageIndex: voyageIndex + 1,
        voyageProgressTicks: 0,
        destination,
      },
    };
  }
  return { ...ship, location: { kind: "docked", portId: destination } };
}
