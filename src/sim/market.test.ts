import { describe, expect, it } from "vitest";
import { GOOD_IDS, GOODS } from "./goods";
import { marketTick, price, quoteBuy, quoteSell, type FlowModifiers } from "./market";
import { ARCHETYPE_PROFILES } from "./region";
import type { GoodId } from "./goods";
import type { MarketGood } from "./region";

const mg = (stock: number, equilibrium = 300): MarketGood => ({ stock, equilibrium });

const fullMarket = (stock = 300, equilibrium = 300): Record<GoodId, MarketGood> => {
  const market = {} as Record<GoodId, MarketGood>;
  for (const good of GOOD_IDS) market[good] = mg(stock, equilibrium);
  return market;
};

describe("price", () => {
  it("equals base price at equilibrium stock", () => {
    expect(price("grain", mg(300))).toBeCloseTo(GOODS.grain.basePrice, 10);
  });

  it("rises as stock falls and falls as stock rises (monotonic)", () => {
    expect(price("grain", mg(100))).toBeGreaterThan(price("grain", mg(300)));
    expect(price("grain", mg(900))).toBeLessThan(price("grain", mg(300)));
  });

  it("clamps to [0.25×, 4×] base price", () => {
    expect(price("grain", mg(1))).toBe(GOODS.grain.basePrice * 4);
    expect(price("grain", mg(1_000_000))).toBe(GOODS.grain.basePrice * 0.25);
  });

  it("survives stock 0 via max(stock, 1)", () => {
    expect(price("grain", mg(0))).toBe(GOODS.grain.basePrice * 4);
  });
});

describe("marginal quotes", () => {
  it("quotes a single unit at the current marginal price, rounded to a thaler", () => {
    expect(quoteBuy("grain", mg(300), 1)).toBe(Math.round(price("grain", mg(300))));
  });

  it("charges more per unit as the buy walks the stock down", () => {
    const small = quoteBuy("timber", mg(60, 60), 10)!;
    const large = quoteBuy("timber", mg(60, 60), 20)!;
    expect(large).toBeGreaterThan(2 * small - 1); // second half costs more than the first
  });

  it("buy then sell of the same lot at one market never profits", () => {
    for (const qty of [1, 7, 50]) {
      const start = mg(120, 300);
      const buy = quoteBuy("electronics", start, qty)!;
      const afterBuy = mg(start.stock - qty, 300);
      const sell = quoteSell("electronics", afterBuy, qty);
      expect(sell).toBeLessThanOrEqual(buy);
    }
  });

  it("returns null when buying more than the available stock", () => {
    expect(quoteBuy("grain", mg(5), 6)).toBeNull();
    expect(quoteBuy("grain", mg(5.9), 5)).not.toBeNull();
    expect(quoteBuy("grain", mg(0), 1)).toBeNull();
  });

  it("rejects non-positive and non-integer quantities", () => {
    expect(quoteBuy("grain", mg(300), 0)).toBeNull();
    expect(quoteBuy("grain", mg(300), -3)).toBeNull();
    expect(quoteBuy("grain", mg(300), 1.5)).toBeNull();
    expect(quoteSell("grain", mg(300), 0)).toBeNull();
    expect(quoteSell("grain", mg(300), 2.5)).toBeNull();
  });

  it("returns integer thalers", () => {
    expect(Number.isInteger(quoteBuy("aetherSalt", mg(123, 300), 7))).toBe(true);
    expect(Number.isInteger(quoteSell("aetherSalt", mg(123, 300), 7))).toBe(true);
  });
});

describe("marketTick", () => {
  const NEUTRAL: FlowModifiers = { production: 1, consumption: 1 };

  it("applies per-day flows divided by 24 ticks", () => {
    const market = fullMarket(300);
    const next = marketTick(market, ARCHETYPE_PROFILES.agrarian, NEUTRAL);
    expect(next.grain.stock).toBeCloseTo(300 + 96 / 24, 10);
    expect(next.textiles.stock).toBeCloseTo(300 - 6 / 24, 10);
    expect(next.timber.stock).toBe(300); // agrarian neither makes nor uses timber
  });

  it("does not mutate the input market", () => {
    const market = fullMarket(300);
    const snapshot = structuredClone(market);
    marketTick(market, ARCHETYPE_PROFILES.urban, NEUTRAL);
    expect(market).toEqual(snapshot);
  });

  it("stops consumption at stock 0 (unmet demand is lost)", () => {
    const market = fullMarket(0.1);
    const next = marketTick(market, ARCHETYPE_PROFILES.urban, NEUTRAL);
    expect(next.grain.stock).toBe(0);
  });

  it("stops production at the 4× equilibrium cap (warehouses full)", () => {
    const market = fullMarket(1199.9, 300);
    const next = marketTick(market, ARCHETYPE_PROFILES.agrarian, NEUTRAL);
    expect(next.grain.stock).toBe(1200);
  });

  it("scales flows by the event modifiers (E6 hook)", () => {
    const market = fullMarket(300);
    const doubled = marketTick(market, ARCHETYPE_PROFILES.agrarian, {
      production: 2,
      consumption: 0,
    });
    expect(doubled.grain.stock).toBeCloseTo(300 + (2 * 96) / 24, 10);
    expect(doubled.textiles.stock).toBe(300); // consumption zeroed by modifier
  });

  it("keeps stock within [0, cap] over 10 000 ticks for every archetype", () => {
    for (const archetype of ["agrarian", "industrial", "urban", "mining", "verdant"] as const) {
      let market = fullMarket(300);
      for (let t = 0; t < 10_000; t++) {
        market = marketTick(market, ARCHETYPE_PROFILES[archetype], NEUTRAL);
      }
      for (const good of GOOD_IDS) {
        expect(market[good].stock).toBeGreaterThanOrEqual(0);
        expect(market[good].stock).toBeLessThanOrEqual(4 * market[good].equilibrium);
        expect(Number.isFinite(market[good].stock)).toBe(true);
      }
    }
  });
});
