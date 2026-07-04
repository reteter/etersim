import { describe, expect, it } from "vitest";
import { PORT_ARCHETYPES } from "./region";
import { HEARTLAND } from "./template";

describe("HEARTLAND region template", () => {
  it("matches the spec parameters", () => {
    expect(HEARTLAND.portCountRange).toEqual([5, 6]);
    expect(HEARTLAND.laneDensity).toBe(0.6);
    expect(HEARTLAND.voyageTicksRange).toEqual([48, 120]);
  });

  it("weights every archetype positively (equal weights in v1)", () => {
    for (const archetype of PORT_ARCHETYPES) {
      expect(HEARTLAND.archetypeWeights[archetype]).toBeGreaterThan(0);
    }
  });

  it("has enough unique port names for the largest possible region", () => {
    const [, maxPorts] = HEARTLAND.portCountRange;
    expect(new Set(HEARTLAND.portNamePool).size).toBe(HEARTLAND.portNamePool.length);
    expect(HEARTLAND.portNamePool.length).toBeGreaterThanOrEqual(maxPorts);
  });

  it("keeps ranges ordered and density within (0, 1]", () => {
    expect(HEARTLAND.portCountRange[0]).toBeLessThanOrEqual(HEARTLAND.portCountRange[1]);
    expect(HEARTLAND.voyageTicksRange[0]).toBeLessThanOrEqual(HEARTLAND.voyageTicksRange[1]);
    expect(HEARTLAND.laneDensity).toBeGreaterThan(0);
    expect(HEARTLAND.laneDensity).toBeLessThanOrEqual(1);
  });
});
