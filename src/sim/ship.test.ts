import { describe, expect, it } from "vitest";
import type { Port, Region } from "./region";
import { emptyCargo, etaTicks, courseTicks, type Ship } from "./ship";

function port(id: string): Port {
  return {
    id,
    name: id,
    archetype: "agrarian",
    x: 0,
    y: 0,
    market: {} as Port["market"],
    priceBias: {} as Port["priceBias"],
  };
}

const region: Region = {
  ports: [port("a"), port("b"), port("c")],
  lanes: [
    { id: "ab", a: "a", b: "b", voyageTicks: 10 },
    { id: "bc", a: "b", b: "c", voyageTicks: 4 },
  ],
};

function ship(location: Ship["location"]): Ship {
  return { id: "s0", hold: 50, cargo: emptyCargo(), location };
}

describe("courseTicks", () => {
  it("is zero for an empty course", () => {
    expect(courseTicks(region, [])).toBe(0);
  });

  it("sums the voyage ticks of every lane on the course", () => {
    const course = [
      { laneId: "ab", to: "b" },
      { laneId: "bc", to: "c" },
    ];
    expect(courseTicks(region, course)).toBe(14);
  });
});

describe("etaTicks", () => {
  it("is zero when docked", () => {
    expect(etaTicks(ship({ kind: "docked", portId: "a" }), region)).toBe(0);
  });

  it("counts remaining lanes minus progress on the current voyage", () => {
    const s = ship({
      kind: "underway",
      course: [
        { laneId: "ab", to: "b" },
        { laneId: "bc", to: "c" },
      ],
      voyageIndex: 0,
      voyageProgressTicks: 3,
      destination: "c",
    });
    expect(etaTicks(s, region)).toBe(14 - 3);
  });

  it("ignores already-completed voyages via voyageIndex", () => {
    const s = ship({
      kind: "underway",
      course: [
        { laneId: "ab", to: "b" },
        { laneId: "bc", to: "c" },
      ],
      voyageIndex: 1,
      voyageProgressTicks: 1,
      destination: "c",
    });
    expect(etaTicks(s, region)).toBe(4 - 1);
  });
});
