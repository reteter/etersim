import { describe, expect, it } from "vitest";
import { GOOD_IDS, GOODS } from "./goods";

describe("goods table", () => {
  it("defines the five E2 goods with spec base prices", () => {
    expect(GOOD_IDS).toEqual(["grain", "textiles", "aetherSalt", "electronics", "timber"]);
    expect(GOODS.grain.basePrice).toBe(10);
    expect(GOODS.textiles.basePrice).toBe(40);
    expect(GOODS.aetherSalt.basePrice).toBe(60);
    expect(GOODS.electronics.basePrice).toBe(150);
    expect(GOODS.timber.basePrice).toBe(250);
  });

  it("keeps the affordability ladder strictly increasing in GOOD_IDS order", () => {
    const prices = GOOD_IDS.map((id) => GOODS[id].basePrice);
    for (let i = 1; i < prices.length; i++) {
      expect(prices[i]).toBeGreaterThan(prices[i - 1]);
    }
  });

  it("gives every good a display name and its own id", () => {
    for (const id of GOOD_IDS) {
      expect(GOODS[id].id).toBe(id);
      expect(GOODS[id].name.length).toBeGreaterThan(0);
    }
  });
});
