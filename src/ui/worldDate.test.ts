import { describe, expect, it } from "vitest";
import { formatWorldDate, worldDay } from "./worldDate";

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
