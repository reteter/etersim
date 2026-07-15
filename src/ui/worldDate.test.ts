import { describe, expect, it } from "vitest";
import { exportFilename, formatWorldDate, sanitizeSeed, worldDay } from "./worldDate";

describe("worldDay", () => {
  it("is Day 1 for the whole first day (ticks 0..23)", () => {
    expect(worldDay(0)).toBe(1);
    expect(worldDay(23)).toBe(1);
  });

  it("rolls to Day 2 at tick 24", () => {
    expect(worldDay(24)).toBe(2);
  });
});

describe("formatWorldDate", () => {
  it("starts at Day 1, 00:00 on tick 0", () => {
    expect(formatWorldDate(0)).toBe("Day 1, 00:00");
  });

  it("pads the hour to two digits", () => {
    expect(formatWorldDate(7)).toBe("Day 1, 07:00");
  });

  it("rolls over to the next day every 24 ticks", () => {
    expect(formatWorldDate(23)).toBe("Day 1, 23:00");
    expect(formatWorldDate(24)).toBe("Day 2, 00:00");
  });

  it("matches the spec example (Day 12, 07:00)", () => {
    expect(formatWorldDate(11 * 24 + 7)).toBe("Day 12, 07:00");
  });
});

describe("sanitizeSeed (#221)", () => {
  it("leaves an already-safe seed untouched", () => {
    expect(sanitizeSeed("etersim")).toBe("etersim");
  });

  it("collapses whitespace to a dash", () => {
    expect(sanitizeSeed("my cool seed")).toBe("my-cool-seed");
  });

  it("replaces each path-hostile character with a dash", () => {
    expect(sanitizeSeed('a/b\\c:d*e?f"g<h>i|j')).toBe("a-b-c-d-e-f-g-h-i-j");
  });

  it("collapses runs of hostile characters into a single dash", () => {
    expect(sanitizeSeed("a///b")).toBe("a-b");
  });

  it("trims leading and trailing dashes produced by sanitizing", () => {
    expect(sanitizeSeed("/../etc/passwd")).toBe("..-etc-passwd");
    expect(sanitizeSeed("   padded   ")).toBe("padded");
  });

  it("reduces an all-hostile seed to the empty string", () => {
    expect(sanitizeSeed("///")).toBe("");
    expect(sanitizeSeed("   ")).toBe("");
  });
});

describe("exportFilename (#221)", () => {
  it("includes the sanitized seed when one is set", () => {
    expect(exportFilename("etersim", 0)).toBe("etersim-etersim-day1.json");
    expect(exportFilename("my cool seed", 23)).toBe("etersim-my-cool-seed-day1.json");
    expect(exportFilename("etersim", 24)).toBe("etersim-etersim-day2.json");
  });

  it("sanitizes path-hostile characters in the seed", () => {
    expect(exportFilename("a/b:c", 0)).toBe("etersim-a-b-c-day1.json");
  });

  it("falls back to the seedless name when seed is null (imported save)", () => {
    expect(exportFilename(null, 0)).toBe("etersim-day1.json");
  });

  it("falls back to the seedless name when the seed sanitizes to empty", () => {
    expect(exportFilename("///", 0)).toBe("etersim-day1.json");
  });
});
