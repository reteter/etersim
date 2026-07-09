import { courseTicks, shortestCourse, type PortId, type Region } from "../sim";

/**
 * Total voyage ticks of the shortest course between two ports, for previewing
 * a sailTo ETA before the command is issued (docs/specs/E2-trade-loop.md —
 * Ship & travel). Returns null when no course exists or the ports coincide.
 */
export function previewCourseTicks(region: Region, from: PortId, to: PortId): number | null {
  if (from === to) return null;
  const course = shortestCourse(region, from, to);
  if (course === null || course.length === 0) return null;
  return courseTicks(region, course);
}
