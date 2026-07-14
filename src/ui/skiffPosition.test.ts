import { describe, expect, it } from "vitest";
import { skiffCount, skiffGlyphs, SKIFF_DISPLAY_THRESHOLD } from "./skiffPosition";

describe("skiffCount", () => {
  it("is 0 at the display threshold (a quiet lane shows no skiffs)", () => {
    expect(skiffCount(SKIFF_DISPLAY_THRESHOLD)).toBe(0);
    expect(skiffCount(-SKIFF_DISPLAY_THRESHOLD)).toBe(0);
    expect(skiffCount(0)).toBe(0);
  });

  it("is 1 just above the threshold", () => {
    expect(skiffCount(SKIFF_DISPLAY_THRESHOLD + 0.01)).toBe(1);
    expect(skiffCount(-(SKIFF_DISPLAY_THRESHOLD + 0.01))).toBe(1);
  });

  it("grows with magnitude and caps at 4", () => {
    expect(skiffCount(5)).toBe(2); // intensity 1.25 -> floor(2.25) = 2
    expect(skiffCount(20)).toBe(4); // intensity 5 -> floor(6) = 6, capped at 4
  });
});

describe("skiffGlyphs", () => {
  const from = { x: 0, y: 0 };
  const to = { x: 10, y: 0 };

  it("returns no glyphs for a quiet lane", () => {
    expect(skiffGlyphs(0, SKIFF_DISPLAY_THRESHOLD, from, to, false)).toEqual([]);
    expect(skiffGlyphs(123, 0, from, to, false)).toEqual([]);
  });

  it("places a single-skiff lane at the source when tick is 0", () => {
    // magnitude 2 -> intensity 0.5 -> count = floor(1.5) = 1
    const glyphs = skiffGlyphs(0, 2, from, to, false);
    expect(glyphs).toEqual([{ x: 0, y: 0, angleDeg: 0 }]);
  });

  it("advances proportionally to tick (sim-time anchored, not wall-clock)", () => {
    // magnitude 2 -> intensity 0.5 -> cycle = max(8, 30 / 1.5) = 20 ticks
    const at5 = skiffGlyphs(5, 2, from, to, false);
    expect(at5).toEqual([{ x: 2.5, y: 0, angleDeg: 0 }]);

    const at10 = skiffGlyphs(10, 2, from, to, false);
    expect(at10).toEqual([{ x: 5, y: 0, angleDeg: 0 }]);
  });

  it("wraps around after a full cycle, looping the lane", () => {
    // cycle 20 ticks (see above): tick 25 is one full cycle past tick 5.
    const at5 = skiffGlyphs(5, 2, from, to, false);
    const at25 = skiffGlyphs(25, 2, from, to, false);
    expect(at25).toEqual(at5);
  });

  it("spaces multiple skiffs evenly by phase at tick 0", () => {
    // magnitude 5 -> count 2 (see skiffCount test above).
    const glyphs = skiffGlyphs(0, 5, from, to, false);
    expect(glyphs).toHaveLength(2);
    expect(glyphs[0].x).toBe(0); // phase 0
    expect(glyphs[1].x).toBe(5); // phase 1/2 of the 0..10 lane
  });

  it("under reduced motion, freezes at spawn phase regardless of tick", () => {
    const atTick0 = skiffGlyphs(0, 5, from, to, true);
    const atTick999 = skiffGlyphs(999, 5, from, to, true);
    expect(atTick999).toEqual(atTick0);
    expect(atTick0[0].x).toBe(0);
    expect(atTick0[1].x).toBe(5);
  });

  it("without reduced motion, the same lane visibly moves as tick advances (motion is real, not a no-op)", () => {
    const atTick0 = skiffGlyphs(0, 5, from, to, false);
    const atTick3 = skiffGlyphs(3, 5, from, to, false);
    expect(atTick3).not.toEqual(atTick0);
  });

  it("orients the glyph angle toward the flow direction (from -> to)", () => {
    // Pointing south (+y).
    const south = skiffGlyphs(0, 2, { x: 0, y: 0 }, { x: 0, y: 10 }, false);
    expect(south[0].angleDeg).toBe(90);
    // Pointing west (-x).
    const west = skiffGlyphs(0, 2, { x: 0, y: 0 }, { x: -10, y: 0 }, false);
    expect(west[0].angleDeg).toBe(180);
  });
});
