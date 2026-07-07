import { describe, expect, it } from "vitest";
import { PORT_ARCHETYPES } from "./region";
import { HEARTLAND } from "./template";

describe("HEARTLAND region template", () => {
  it("matches the spec parameters", () => {
    expect(HEARTLAND.portCountRange).toEqual([5, 6]);
    expect(HEARTLAND.laneDensity).toBe(0.6);
    expect(HEARTLAND.voyageTicksPerUnit).toBe(130);
    expect(HEARTLAND.orbitRadiusRange).toEqual([0.18, 0.46]);
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

  it("keeps ranges ordered, density within (0, 1], and voyageTicksPerUnit positive", () => {
    expect(HEARTLAND.portCountRange[0]).toBeLessThanOrEqual(HEARTLAND.portCountRange[1]);
    expect(HEARTLAND.voyageTicksPerUnit).toBeGreaterThan(0);
    expect(HEARTLAND.laneDensity).toBeGreaterThan(0);
    expect(HEARTLAND.laneDensity).toBeLessThanOrEqual(1);
  });

  it("keeps orbitRadiusRange ordered, positive, and fitting the unit plane", () => {
    const [minR, maxR] = HEARTLAND.orbitRadiusRange;
    expect(minR).toBeGreaterThan(0);
    expect(minR).toBeLessThanOrEqual(maxR);
    // Center is (0.5, 0.5); a ring radius must stay under 0.5 to fit the
    // unit plane with margin.
    expect(maxR).toBeLessThan(0.5);
  });
});
