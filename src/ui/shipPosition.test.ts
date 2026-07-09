import { describe, expect, it } from "vitest";
import { emptyCargo, type Port, type Region, type Ship } from "../sim";
import { shipPosition } from "./shipPosition";

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

const portA = port("a", 0, 0);
const portB = port("b", 1, 0.5);

const region: Region = {
  ports: [portA, portB],
  lanes: [{ id: "lane-ab", a: "a", b: "b", voyageTicks: 10 }],
};

function ship(location: Ship["location"]): Ship {
  return { id: "s0", hold: 50, cargo: emptyCargo(), location };
}

describe("shipPosition", () => {
  it("sits on its port when docked", () => {
    expect(shipPosition(ship({ kind: "docked", portId: "a" }), region)).toEqual({ x: 0, y: 0 });
    expect(shipPosition(ship({ kind: "docked", portId: "b" }), region)).toEqual({ x: 1, y: 0.5 });
  });

  it("starts at the origin port when voyage progress is 0", () => {
    const s = ship({
      kind: "underway",
      course: [{ laneId: "lane-ab", to: "b" }],
      voyageIndex: 0,
      voyageProgressTicks: 0,
      destination: "b",
    });
    expect(shipPosition(s, region)).toEqual({ x: 0, y: 0 });
  });

  it("reaches the destination port when voyage progress equals lane duration", () => {
    const s = ship({
      kind: "underway",
      course: [{ laneId: "lane-ab", to: "b" }],
      voyageIndex: 0,
      voyageProgressTicks: 10,
      destination: "b",
    });
    expect(shipPosition(s, region)).toEqual({ x: 1, y: 0.5 });
  });

  it("interpolates proportionally to voyage progress", () => {
    const s = ship({
      kind: "underway",
      course: [{ laneId: "lane-ab", to: "b" }],
      voyageIndex: 0,
      voyageProgressTicks: 5,
      destination: "b",
    });
    expect(shipPosition(s, region)).toEqual({ x: 0.5, y: 0.25 });
  });

  it("flips direction when the destination is the lane's other endpoint", () => {
    const s = ship({
      kind: "underway",
      course: [{ laneId: "lane-ab", to: "a" }],
      voyageIndex: 0,
      voyageProgressTicks: 5,
      destination: "a",
    });
    expect(shipPosition(s, region)).toEqual({ x: 0.5, y: 0.25 });
    // Symmetric midpoint here, so also check a point off-center.
    const nearB = ship({
      kind: "underway",
      course: [{ laneId: "lane-ab", to: "a" }],
      voyageIndex: 0,
      voyageProgressTicks: 2,
      destination: "a",
    });
    expect(shipPosition(nearB, region)).toEqual({ x: 0.8, y: 0.4 });
  });

  it("uses the current voyage leg, not the final route destination", () => {
    const midRegion: Region = {
      ports: [portA, portB, port("c", 0.5, 1)],
      lanes: [
        { id: "lane-ab", a: "a", b: "b", voyageTicks: 10 },
        { id: "lane-bc", a: "b", b: "c", voyageTicks: 4 },
      ],
    };
    const s = ship({
      kind: "underway",
      course: [
        { laneId: "lane-ab", to: "b" },
        { laneId: "lane-bc", to: "c" },
      ],
      voyageIndex: 1,
      voyageProgressTicks: 2,
      destination: "c",
    });
    expect(shipPosition(s, midRegion)).toEqual({ x: 0.75, y: 0.75 });
  });
});
