import { describe, expect, it } from "vitest";
import { shortestCourse } from "./pathfinding";
import type { Lane, Region } from "./region";

/** Test graph: A—B (10), B—C (10), A—C (25), C—D (10); E isolated.
 *  A→C is cheaper via B (20) than direct (25). */
const lanes: Lane[] = [
  { id: "ab", a: "A", b: "B", voyageTicks: 10 },
  { id: "bc", a: "B", b: "C", voyageTicks: 10 },
  { id: "ac", a: "A", b: "C", voyageTicks: 25 },
  { id: "cd", a: "C", b: "D", voyageTicks: 10 },
];

const region = {
  ports: ["A", "B", "C", "D", "E"].map((id) => ({ id })),
  lanes,
} as unknown as Region;

describe("shortestCourse", () => {
  it("finds the cheapest multi-lane course, not the fewest hops", () => {
    expect(shortestCourse(region, "A", "C")).toEqual([
      { laneId: "ab", to: "B" },
      { laneId: "bc", to: "C" },
    ]);
  });

  it("works against lane direction (lanes are undirected)", () => {
    expect(shortestCourse(region, "D", "B")).toEqual([
      { laneId: "cd", to: "C" },
      { laneId: "bc", to: "B" },
    ]);
  });

  it("returns an empty course for from === to", () => {
    expect(shortestCourse(region, "B", "B")).toEqual([]);
  });

  it("returns null when the target is unreachable", () => {
    expect(shortestCourse(region, "A", "E")).toBeNull();
  });
});
