import { describe, expect, it } from "vitest";
import { priceTrend } from "./priceTrend";

describe("priceTrend", () => {
  it("reports up when the current price is higher than the snapshot", () => {
    expect(priceTrend(12, 10)).toBe("up");
  });

  it("reports down when the current price is lower than the snapshot", () => {
    expect(priceTrend(8, 10)).toBe("down");
  });

  it("reports flat on an exact match", () => {
    expect(priceTrend(10, 10)).toBe("flat");
  });

  it("compares rounded thalers, so sub-thaler drift stays flat", () => {
    expect(priceTrend(10.4, 10.1)).toBe("flat");
    expect(priceTrend(10.6, 10.1)).toBe("up");
  });
});
