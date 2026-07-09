import type { Region, Ship } from "../sim";

export interface Point {
  readonly x: number;
  readonly y: number;
}

/**
 * Where to draw a ship on the region map, in unit-plane coordinates (0..1,
 * same space as Port.x/y). Docked ships sit on their port; underway ships
 * are interpolated along the current lane by voyage progress
 * (docs/specs/E2-trade-loop.md — RegionMap).
 */
export function shipPosition(ship: Ship, region: Region): Point {
  const location = ship.location;
  if (location.kind === "docked") {
    const port = region.ports.find((p) => p.id === location.portId);
    if (!port) throw new Error(`shipPosition: unknown port "${location.portId}"`);
    return { x: port.x, y: port.y };
  }

  const { course, voyageIndex, voyageProgressTicks } = location;
  const voyage = course[voyageIndex];
  const lane = region.lanes.find((l) => l.id === voyage.laneId);
  if (!lane) throw new Error(`shipPosition: unknown lane "${voyage.laneId}"`);

  // Lanes are undirected (a/b); the voyage's `to` tells us which endpoint
  // is the destination of this leg, so the other one is where we came from.
  const fromId = lane.a === voyage.to ? lane.b : lane.a;
  const fromPort = region.ports.find((p) => p.id === fromId);
  const toPort = region.ports.find((p) => p.id === voyage.to);
  if (!fromPort || !toPort) throw new Error("shipPosition: lane endpoint not found in region");

  const frac = lane.voyageTicks > 0 ? voyageProgressTicks / lane.voyageTicks : 0;
  return {
    x: fromPort.x + (toPort.x - fromPort.x) * frac,
    y: fromPort.y + (toPort.y - fromPort.y) * frac,
  };
}
