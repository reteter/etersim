import { describe, expect, it } from "vitest";
import { GOOD_IDS } from "./goods";
import { createWorld } from "./world";

describe("world", () => {
  it("starts at tick 0", () => {
    expect(createWorld(42).tick).toBe(0);
  });

  it("is deterministic: same seed yields a deep-equal world", () => {
    expect(createWorld(42)).toEqual(createWorld(42));
  });

  it("survives a JSON round-trip unchanged (ADR-0004)", () => {
    const world = createWorld(7);
    expect(JSON.parse(JSON.stringify(world))).toEqual(world);
  });

  it("starts every port × good's flow drift at 1.0 (E8)", () => {
    const world = createWorld(13);
    for (const port of world.region.ports) {
      for (const good of GOOD_IDS) {
        expect(world.flowDrift[port.id][good]).toBe(1);
      }
    }
  });

  it("starts every lane's osmosis pulse at 0 (E8)", () => {
    const world = createWorld(13);
    for (const lane of world.region.lanes) {
      expect(world.osmosisPulse[lane.id]).toBe(0);
    }
  });
});
