import { describe, expect, it } from "vitest";
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
});
