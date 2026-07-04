import { describe, expect, it } from "vitest";
import { tick } from "./tick";
import { createWorld, type World } from "./world";

const runTicks = (world: World, count: number): World => {
  let current = world;
  for (let i = 0; i < count; i++) {
    current = tick(current, []);
  }
  return current;
};

describe("tick", () => {
  it("advances world time by exactly one tick", () => {
    const world = createWorld(1);
    expect(tick(world, []).tick).toBe(1);
    expect(runTicks(world, 5).tick).toBe(5);
  });

  it("does not mutate the input world", () => {
    const world = createWorld(1);
    const snapshot = structuredClone(world);
    tick(world, []);
    expect(world).toEqual(snapshot);
  });

  it("is deterministic: same seed + same commands over N ticks => deep-equal world", () => {
    const runA = runTicks(createWorld(42), 1000);
    const runB = runTicks(createWorld(42), 1000);
    expect(runA).toEqual(runB);
  });
});
