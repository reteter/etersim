import { describe, expect, it } from "vitest";
import type { Port, Region } from "../sim";
import { previewCourseTicks } from "./coursePreview";

function port(id: string, x: number, y: number): Port {
  return {
    id,
    name: id,
    archetype: "agrarian",
    x,
    y,
    market: {} as Port["market"],
    priceBias: {} as Port["priceBias"],
  };
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

describe("previewCourseTicks", () => {
  it("sums the ticks of a single-lane course", () => {
    expect(previewCourseTicks(region, "a", "b")).toBe(10);
  });

  it("sums a multi-lane shortest course rather than a longer direct lane", () => {
    expect(previewCourseTicks(region, "a", "c")).toBe(22);
  });

  it("returns null when origin and destination coincide", () => {
    expect(previewCourseTicks(region, "a", "a")).toBeNull();
  });

  it("returns null when no course exists", () => {
    const split: Region = {
      ports: [port("a", 0, 0), port("z", 5, 5)],
      lanes: [],
    };
    expect(previewCourseTicks(split, "a", "z")).toBeNull();
  });
});
