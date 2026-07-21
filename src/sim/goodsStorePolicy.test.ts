import { describe, expect, it } from "vitest";
import { storeOf } from "./goodsStore";
import { accepts, type StorePolicy } from "./goodsStorePolicy";

/**
 * E13.0 (#307, docs/adr/0008-one-goods-store.md; docs/specs/E13.0-goods-store.md
 * §Tech — Policy): `StorePolicy` is a discriminated union derived at the
 * point of use, never serialized. `accepts` is the single home for goods
 * filter + capacity + remaining need — given a proposed qty, it returns how
 * much the store would actually take right now.
 */

describe("goodsStorePolicy", () => {
  describe("accepts — constructionSite policy (per-good recipe need)", () => {
    const recipe = { grain: 10, textiles: 5, aetherSalt: 0, electronics: 0, timber: 0 };
    const policy: StorePolicy = { kind: "constructionSite", recipe };

    it("accepts up to the remaining need when the store is empty", () => {
      const store = storeOf({});
      expect(accepts(store, policy, "grain", 10)).toBe(10);
    });

    it("clamps the accepted qty to the remaining need, not the full recipe", () => {
      const store = storeOf({ grain: 7 });
      expect(accepts(store, policy, "grain", 10)).toBe(3);
    });

    it("clamps to the offered qty when it is smaller than the remaining need", () => {
      const store = storeOf({ grain: 0 });
      expect(accepts(store, policy, "grain", 4)).toBe(4);
    });

    it("accepts 0 once the recipe's need for that good is fully met", () => {
      const store = storeOf({ grain: 10 });
      expect(accepts(store, policy, "grain", 5)).toBe(0);
    });

    it("accepts 0 for a good the recipe doesn't call for at all", () => {
      const store = storeOf({});
      expect(accepts(store, policy, "aetherSalt", 5)).toBe(0);
    });

    it("never accepts more than offered, even with unlimited remaining need", () => {
      const bigRecipe = { grain: 1000, textiles: 0, aetherSalt: 0, electronics: 0, timber: 0 };
      const bigPolicy: StorePolicy = { kind: "constructionSite", recipe: bigRecipe };
      expect(accepts(storeOf({}), bigPolicy, "grain", 3)).toBe(3);
    });
  });

  describe("accepts — hold policy (flat total capacity)", () => {
    it("accepts up to remaining capacity (capacity - totalHeld), any good", () => {
      const policy: StorePolicy = { kind: "hold", capacity: 50 };
      const store = storeOf({ grain: 20, timber: 10 }); // totalHeld = 30
      expect(accepts(store, policy, "textiles", 25)).toBe(20); // 50 - 30 = 20 remaining
    });

    it("clamps to the offered qty when capacity headroom is larger", () => {
      const policy: StorePolicy = { kind: "hold", capacity: 50 };
      const store = storeOf({ grain: 5 });
      expect(accepts(store, policy, "grain", 3)).toBe(3);
    });

    it("accepts 0 once the hold is full", () => {
      const policy: StorePolicy = { kind: "hold", capacity: 10 };
      const store = storeOf({ grain: 10 });
      expect(accepts(store, policy, "textiles", 5)).toBe(0);
    });

    it("never returns negative when totalHeld somehow exceeds capacity", () => {
      const policy: StorePolicy = { kind: "hold", capacity: 5 };
      const store = storeOf({ grain: 8 }); // shouldn't happen in practice, but accepts must not go negative
      expect(accepts(store, policy, "textiles", 5)).toBe(0);
    });
  });

  describe("accepts — storehouse policy", () => {
    const policy: StorePolicy = { kind: "storehouse", filter: ["grain"], capacity: 200 };

    it("accepts only filtered goods and clamps by the shared capacity", () => {
      expect(accepts(storeOf({}), policy, "textiles", 10)).toBe(0);
      expect(accepts(storeOf({ grain: 195 }), policy, "grain", 10)).toBe(5);
      expect(accepts(storeOf({ grain: 200 }), policy, "grain", 1)).toBe(0);
    });
  });
});
