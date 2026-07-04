import { describe, expect, it } from "vitest";
import { advanceTickCount } from "./index";

describe("sim placeholder", () => {
  it("advances the tick count by one", () => {
    expect(advanceTickCount(0)).toBe(1);
    expect(advanceTickCount(41)).toBe(42);
  });
});
