import { shortestRoute, type PortId, type Region } from "../sim";

/**
 * Total voyage ticks of the shortest route between two ports, for previewing
 * a sailTo ETA before the command is issued (docs/specs/E2-trade-loop.md —
 * Ship & travel). Returns null when no route exists or the ports coincide.
 * Mirrors the summation etaTicks() does over an in-flight ship's route.
 */
export function previewRouteTicks(region: Region, from: PortId, to: PortId): number | null {
  if (from === to) return null;
  const route = shortestRoute(region, from, to);
  if (route === null || route.length === 0) return null;
  let ticks = 0;
  for (const voyage of route) {
    const lane = region.lanes.find((l) => l.id === voyage.laneId);
    if (!lane) return null;
    ticks += lane.voyageTicks;
  }
  return ticks;
}
