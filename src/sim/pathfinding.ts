import type { PortId, Region } from "./region";
import type { Voyage } from "./ship";

/**
 * Dijkstra over lane voyage durations. Deterministic: ports and lanes are
 * scanned in array order, and a shorter distance strictly wins — ties keep
 * the earlier port. O(V²), plenty for single-digit port counts.
 *
 * Returns the course (ordered voyages), [] when from === to, null when unreachable.
 */
export function shortestCourse(region: Region, from: PortId, to: PortId): Voyage[] | null {
  if (from === to) return [];

  const dist = new Map<PortId, number>();
  const arrivedBy = new Map<PortId, Voyage & { fromPort: PortId }>();
  const done = new Set<PortId>();
  dist.set(from, 0);

  for (;;) {
    let current: PortId | undefined;
    let best = Infinity;
    for (const port of region.ports) {
      const d = dist.get(port.id);
      if (d !== undefined && !done.has(port.id) && d < best) {
        best = d;
        current = port.id;
      }
    }
    if (current === undefined) return null; // frontier empty: unreachable
    if (current === to) break;
    done.add(current);

    for (const lane of region.lanes) {
      const neighbor = lane.a === current ? lane.b : lane.b === current ? lane.a : null;
      if (neighbor === null || done.has(neighbor)) continue;
      const candidate = best + lane.voyageTicks;
      if (candidate < (dist.get(neighbor) ?? Infinity)) {
        dist.set(neighbor, candidate);
        arrivedBy.set(neighbor, { laneId: lane.id, to: neighbor, fromPort: current });
      }
    }
  }

  const voyages: Voyage[] = [];
  for (let at = to; at !== from; ) {
    const arrival = arrivedBy.get(at)!;
    voyages.unshift({ laneId: arrival.laneId, to: arrival.to });
    at = arrival.fromPort;
  }
  return voyages;
}
