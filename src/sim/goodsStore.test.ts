import { describe, expect, it } from "vitest";
import { GOOD_IDS } from "./goods";
import { amountOf, emptyStore, storeOf, totalHeld, withAdded, withRemoved } from "./goodsStore";

/**
 * E13.0 (#307, docs/adr/0008-one-goods-store.md; docs/specs/E13.0-goods-store.md
 * §Tech — the store): `GoodsStore` is an opaque alias over today's on-disk
 * `Record<GoodId, number>` — same JSON, same runtime object, reachable only
 * through these five accessors + `totalHeld`. Compile-time opacity itself is
 * proven by `goodsStore.typeguard.ts`; these tests cover runtime behavior.
 */

describe("goodsStore", () => {
  describe("emptyStore", () => {
    it("zero-fills every GoodId", () => {
      const store = emptyStore();
      for (const good of GOOD_IDS) expect(amountOf(store, good)).toBe(0);
    });

    it("totals to zero", () => {
      expect(totalHeld(emptyStore())).toBe(0);
    });
  });

  describe("storeOf", () => {
    it("fills named goods from the partial and zero-fills the rest", () => {
      const store = storeOf({ grain: 5, timber: 12 });
      expect(amountOf(store, "grain")).toBe(5);
      expect(amountOf(store, "timber")).toBe(12);
      expect(amountOf(store, "textiles")).toBe(0);
      expect(amountOf(store, "aetherSalt")).toBe(0);
      expect(amountOf(store, "electronics")).toBe(0);
    });

    it("zero-fills in GOOD_IDS order — JSON.stringify's key order matches GOOD_IDS", () => {
      // storeOf is given goods out of GOOD_IDS order deliberately, so a
      // faulty implementation that iterated `Object.keys(partial)` instead
      // of `GOOD_IDS` would produce a different key order here.
      const store = storeOf({ timber: 1, grain: 2 });
      expect(JSON.stringify(store)).toBe(JSON.stringify(GOOD_IDS.map((g) => (g === "timber" ? 1 : g === "grain" ? 2 : 0))
        .reduce((acc, qty, i) => ({ ...acc, [GOOD_IDS[i]]: qty }), {})));
    });

    it("an empty partial is the same as emptyStore", () => {
      expect(storeOf({})).toEqual(emptyStore());
    });
  });

  describe("amountOf", () => {
    it("reads back what was added", () => {
      const store = withAdded(emptyStore(), "aetherSalt", 7);
      expect(amountOf(store, "aetherSalt")).toBe(7);
    });
  });

  describe("withAdded", () => {
    it("adds to an existing amount rather than overwriting it", () => {
      let store = storeOf({ grain: 3 });
      store = withAdded(store, "grain", 4);
      expect(amountOf(store, "grain")).toBe(7);
    });

    it("leaves every other good untouched", () => {
      const store = storeOf({ grain: 3, timber: 1 });
      const next = withAdded(store, "grain", 4);
      expect(amountOf(next, "timber")).toBe(1);
    });

    it("is pure — does not mutate the input store", () => {
      const store = storeOf({ grain: 3 });
      withAdded(store, "grain", 4);
      expect(amountOf(store, "grain")).toBe(3);
    });

    it("accepts a negative qty as a decrement (no clamping — the caller validates non-negativity)", () => {
      const store = storeOf({ grain: 10 });
      expect(amountOf(withAdded(store, "grain", -3), "grain")).toBe(7);
    });
  });

  describe("withRemoved", () => {
    it("subtracts from the existing amount", () => {
      const store = storeOf({ grain: 10 });
      expect(amountOf(withRemoved(store, "grain", 4), "grain")).toBe(6);
    });

    it("leaves every other good untouched", () => {
      const store = storeOf({ grain: 10, timber: 2 });
      const next = withRemoved(store, "grain", 4);
      expect(amountOf(next, "timber")).toBe(2);
    });

    it("is pure — does not mutate the input store", () => {
      const store = storeOf({ grain: 10 });
      withRemoved(store, "grain", 4);
      expect(amountOf(store, "grain")).toBe(10);
    });

    it("does not clamp at zero — matches the pre-refactor spread's un-clamped subtraction", () => {
      const store = storeOf({ grain: 2 });
      expect(amountOf(withRemoved(store, "grain", 5), "grain")).toBe(-3);
    });
  });

  describe("totalHeld", () => {
    it("sums every good in GOOD_IDS order (fold order is fixed per spec §Persistence)", () => {
      const store = storeOf({ grain: 3, textiles: 2, aetherSalt: 1, electronics: 4, timber: 5 });
      expect(totalHeld(store)).toBe(15);
    });

    it("is zero for an empty store", () => {
      expect(totalHeld(emptyStore())).toBe(0);
    });
  });
});
