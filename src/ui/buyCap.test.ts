import { describe, expect, it } from "vitest";
import { buyCapHint, buyCapReason } from "./buyCap";

describe("buyCapReason", () => {
  it("reports hold when hold space is the tighter constraint and the walk reaches it", () => {
    // holdSpace 5 < stock 12, and the walk affords all 5 (buyMax === holdSpace).
    expect(buyCapReason(5, 12, 5)).toBe("hold");
  });

  it("reports hold when the hold is completely full (the reported playtest case)", () => {
    expect(buyCapReason(0, 12, 0)).toBe("hold");
  });

  it("reports stock when stock is the tighter constraint and the walk reaches it", () => {
    // stock 12 < holdSpace 20, and the walk affords all 12 (buyMax === stock).
    expect(buyCapReason(20, 12, 12)).toBe("stock");
  });

  it("reports stock when the port is entirely out of stock", () => {
    expect(buyCapReason(20, 0, 0)).toBe("stock");
  });

  it("reports thalers when the walk breaks before reaching the structural cap", () => {
    // structural cap is min(20, 12) = 12, but only 5 units were affordable.
    expect(buyCapReason(20, 12, 5)).toBe("thalers");
  });

  it("reports thalers when not even a single unit is affordable, despite ample hold and stock", () => {
    expect(buyCapReason(50, 500, 0)).toBe("thalers");
  });

  it("ties between hold and stock favour hold (the constraint the playtest actually hit)", () => {
    expect(buyCapReason(10, 10, 10)).toBe("hold");
    expect(buyCapReason(0, 0, 0)).toBe("hold");
  });
});

describe("buyCapHint", () => {
  it("names the hold constraint as full at zero remaining space", () => {
    expect(buyCapHint("hold", 0, 12)).toBe("Hold full");
  });

  it("quantifies the hold constraint when some space remains", () => {
    expect(buyCapHint("hold", 5, 12)).toBe("Only 5 hold space left");
  });

  it("names the stock constraint as out of stock at zero", () => {
    expect(buyCapHint("stock", 20, 0)).toBe("Out of stock");
  });

  it("quantifies the stock constraint when some stock remains", () => {
    expect(buyCapHint("stock", 20, 12)).toBe("Only 12 in stock");
  });

  it("names the thalers constraint with a flat message", () => {
    expect(buyCapHint("thalers", 20, 12)).toBe("Not enough thalers");
  });
});
