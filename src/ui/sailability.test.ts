import { describe, expect, it } from "vitest";
import { DOCKING_FEE, emptyCargo, type Port, type Region, type Ship } from "../sim";
import { sailability } from "./sailability";

function port(id: string, archetype: Port["archetype"], x: number, y: number): Port {
  return {
    id,
    name: id,
    archetype,
    x,
    y,
    market: {} as Port["market"],
    priceBias: {} as Port["priceBias"],
  };
}

// a (agrarian, docked) ── b (urban) — a single lane, so `b`'s DOCKING_FEE is
// the fee sailing there would charge on arrival (src/sim/tick.ts).
const region: Region = {
  ports: [port("a", "agrarian", 0, 0), port("b", "urban", 1, 0)],
  lanes: [{ id: "ab", a: "a", b: "b", voyageTicks: 10 }],
};

function ship(locationPortId: string): Ship {
  return {
    id: "s1",
    name: "Test Runner",
    hold: 50,
    baseHold: 50,
    cargo: emptyCargo(),
    location: { kind: "docked", portId: locationPortId },
  };
}

describe("sailability — docking fee (#125)", () => {
  it("surfaces DOCKING_FEE[destination.archetype] alongside a live eta", () => {
    const result = sailability(ship("a"), "b", region);
    expect(result.disabledHint).toBeNull();
    expect(result.eta).toBe(10);
    expect(result.dockingFee).toBe(DOCKING_FEE.urban);
    expect(result.dockingFee).toBe(20);
  });

  it("returns null dockingFee when locked (under Refit)", () => {
    const result = sailability(ship("a"), "b", region, true);
    expect(result.dockingFee).toBeNull();
  });

  it("returns null dockingFee when underway", () => {
    const underway: Ship = {
      ...ship("a"),
      location: {
        kind: "underway",
        course: [{ laneId: "ab", to: "b" }],
        voyageIndex: 0,
        voyageProgressTicks: 0,
        destination: "b",
      },
    };
    const result = sailability(underway, "b", region);
    expect(result.dockingFee).toBeNull();
  });

  it("returns null dockingFee when already docked at the target", () => {
    const result = sailability(ship("b"), "b", region);
    expect(result.dockingFee).toBeNull();
  });

  it("returns null dockingFee when no course exists", () => {
    const isolated: Region = {
      ports: [port("a", "agrarian", 0, 0), port("z", "mining", 5, 5)],
      lanes: [],
    };
    const result = sailability(ship("a"), "z", isolated);
    expect(result.dockingFee).toBeNull();
  });
});
