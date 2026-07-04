import { describe, expect, it } from "vitest";
import { SIM_VERSION, advanceTickCount } from "./index";

describe("sim placeholder", () => {
  it("exposes a sim version", () => {
    expect(SIM_VERSION).toBe(1);
  });

  it("advances the tick count by one", () => {
    expect(advanceTickCount(0)).toBe(1);
    expect(advanceTickCount(41)).toBe(42);
  });
});
