import { describe, expect, it } from "vitest";
import { elapsedToTicks, MAX_TICKS_PER_CALL, SPEEDS } from "./speed";

describe("speed control", () => {
  it("exposes the ADR-0003 speed ladder", () => {
    expect(SPEEDS).toEqual(["paused", 1, 10, 100]);
  });

  it("yields no ticks and drops accumulated time while paused", () => {
    expect(elapsedToTicks("paused", 5000, 900)).toEqual({ ticks: 0, carryMs: 0 });
  });

  it("converts elapsed real time to ticks at 1x (1 tick per second)", () => {
    expect(elapsedToTicks(1, 2500, 0)).toEqual({ ticks: 2, carryMs: 500 });
  });

  it("scales with speed", () => {
    expect(elapsedToTicks(10, 1000, 0)).toEqual({ ticks: 10, carryMs: 0 });
    expect(elapsedToTicks(100, 1000, 0)).toEqual({ ticks: 100, carryMs: 0 });
  });

  it("caps runaway backlogs (backgrounded tab) and discards the excess", () => {
    // 10 minutes away at 100x would be 60,000 ticks in one frame.
    expect(elapsedToTicks(100, 600_000, 0)).toEqual({
      ticks: MAX_TICKS_PER_CALL,
      carryMs: 0,
    });
  });

  it("treats negative elapsed time as zero (rAF first-frame quirk)", () => {
    expect(elapsedToTicks(1, -500, 0)).toEqual({ ticks: 0, carryMs: 0 });
    expect(elapsedToTicks(100, -500, 300)).toEqual({ ticks: 0, carryMs: 300 });
  });

  it("carries the sub-tick remainder across calls", () => {
    const first = elapsedToTicks(1, 600, 0);
    expect(first).toEqual({ ticks: 0, carryMs: 600 });
    const second = elapsedToTicks(1, 600, first.carryMs);
    expect(second).toEqual({ ticks: 1, carryMs: 200 });
  });
});
