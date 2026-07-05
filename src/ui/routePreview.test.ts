import { describe, expect, it } from "vitest";
import type { Port, Region } from "../sim";
import { previewRouteTicks } from "./routePreview";

function port(id: string, x: number, y: number): Port {
  return { id, name: id, archetype: "agrarian", x, y, market: {} as Port["market"] };
}

// a ── b ── c, with a direct a─c lane that is longer than routing via b.
const region: Region = {
  ports: [port("a", 0, 0), port("b", 1, 0), port("c", 2, 0)],
  lanes: [
    { id: "ab", a: "a", b: "b", voyageTicks: 10 },
    { id: "bc", a: "b", b: "c", voyageTicks: 12 },
    { id: "ac", a: "a", b: "c", voyageTicks: 30 },
  ],
};

describe("previewRouteTicks", () => {
  it("sums the ticks of a single-lane route", () => {
    expect(previewRouteTicks(region, "a", "b")).toBe(10);
  });

  it("sums a multi-lane shortest route rather than a longer direct lane", () => {
    expect(previewRouteTicks(region, "a", "c")).toBe(22);
  });

  it("returns null when origin and destination coincide", () => {
    expect(previewRouteTicks(region, "a", "a")).toBeNull();
  });

  it("returns null when no route exists", () => {
    const split: Region = {
      ports: [port("a", 0, 0), port("z", 5, 5)],
      lanes: [],
    };
    expect(previewRouteTicks(split, "a", "z")).toBeNull();
  });
});
