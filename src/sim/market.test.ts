import { describe, expect, it } from "vitest";
import { GOOD_IDS, GOODS } from "./goods";
import {
  effectiveBase,
  marketTick,
  price,
  quoteBuy,
  quoteSell,
  SPREAD,
  type FlowModifiers,
} from "./market";
import { ARCHETYPE_BIAS, ARCHETYPE_PROFILES } from "./region";
import type { GoodId } from "./goods";
import type { MarketGood, Port } from "./region";

const mg = (stock: number, equilibrium = 300): MarketGood => ({ stock, equilibrium });

const GRAIN = GOODS.grain.basePrice;
const ELECTRONICS = GOODS.electronics.basePrice;

const fullMarket = (stock = 300, equilibrium = 300): Record<GoodId, MarketGood> => {
  const market = {} as Record<GoodId, MarketGood>;
  for (const good of GOOD_IDS) market[good] = mg(stock, equilibrium);
  return market;
};

const neutralBias = (): Record<GoodId, number> => {
  const bias = {} as Record<GoodId, number>;
  for (const good of GOOD_IDS) bias[good] = 1;
  return bias;
};

const portWith = (priceBias: Partial<Record<GoodId, number>>): Port => ({
  id: "pX",
  name: "Testhaven",
  archetype: "urban",
  x: 0.5,
  y: 0.5,
  market: fullMarket(300),
  priceBias: { ...neutralBias(), ...priceBias },
});

describe("price", () => {
  it("equals the effective base at equilibrium stock", () => {
    expect(price(mg(300), GRAIN)).toBeCloseTo(GRAIN, 10);
  });

  it("rises as stock falls and falls as stock rises (monotonic)", () => {
    expect(price(mg(100), GRAIN)).toBeGreaterThan(price(mg(300), GRAIN));
    expect(price(mg(900), GRAIN)).toBeLessThan(price(mg(300), GRAIN));
  });

  it("scales the whole curve with the effective base (E8 price bias)", () => {
    const biased = GRAIN * ARCHETYPE_BIAS.urban.grain;
    expect(price(mg(300), biased)).toBeCloseTo(biased, 10);
    // The bias multiplies the curve pointwise, at any stock level.
    expect(price(mg(150), biased) / price(mg(150), GRAIN)).toBeCloseTo(
      ARCHETYPE_BIAS.urban.grain,
      10,
    );
  });

  it("clamps to [0.25×, 4×] the effective base — biased ports get biased extremes", () => {
    expect(price(mg(1), GRAIN)).toBe(GRAIN * 4);
    expect(price(mg(1_000_000), GRAIN)).toBe(GRAIN * 0.25);
    const biased = GRAIN * ARCHETYPE_BIAS.urban.grain;
    expect(price(mg(1), biased)).toBeCloseTo(biased * 4, 10);
    expect(price(mg(1_000_000), biased)).toBeCloseTo(biased * 0.25, 10);
    // Playtest-orb #6 regression: zeroed-out markets no longer quote one
    // global ceiling — the ceiling itself differs across archetypes.
    expect(price(mg(0), GRAIN * ARCHETYPE_BIAS.urban.grain)).not.toBeCloseTo(
      price(mg(0), GRAIN * ARCHETYPE_BIAS.agrarian.grain),
      6,
    );
  });

  it("survives stock 0 via max(stock, 1)", () => {
    expect(price(mg(0), GRAIN)).toBe(GRAIN * 4);
  });
});

describe("effectiveBase", () => {
  it("multiplies the good's base price by the port's priceBias", () => {
    const port = portWith({ grain: 1.2825 });
    expect(effectiveBase(port, "grain")).toBeCloseTo(GRAIN * 1.2825, 10);
    expect(effectiveBase(port, "timber")).toBeCloseTo(GOODS.timber.basePrice, 10);
  });
});

describe("two-sided quotes (bid-ask spread)", () => {
  it("asks the marginal price plus the spread for a single unit", () => {
    expect(quoteBuy(mg(300), GRAIN, 1)).toBe(Math.round(price(mg(300), GRAIN) * (1 + SPREAD)));
  });

  it("bids the marginal price minus the spread for a single unit", () => {
    // The sell walk starts one above current stock — the exact mirror level.
    expect(quoteSell(mg(300), GRAIN, 1)).toBe(Math.round(price(mg(301), GRAIN) * (1 - SPREAD)));
  });

  it("charges more per unit as the buy walks the stock down", () => {
    const timber = GOODS.timber.basePrice;
    const small = quoteBuy(mg(60, 60), timber, 10)!;
    const large = quoteBuy(mg(60, 60), timber, 20)!;
    expect(large).toBeGreaterThan(2 * small - 1); // second half costs more than the first
  });

  it("makes an instant buy-then-sell round trip lose ~2×SPREAD of value", () => {
    for (const qty of [1, 7, 50]) {
      const start = mg(120, 300);
      const buy = quoteBuy(start, ELECTRONICS, qty)!;
      const sell = quoteSell(mg(start.stock - qty, 300), ELECTRONICS, qty)!;
      expect(sell).toBeLessThan(buy);
      expect(sell / buy).toBeCloseTo((1 - SPREAD) / (1 + SPREAD), 2);
    }
  });

  it("returns null when buying more than the available stock", () => {
    expect(quoteBuy(mg(5), GRAIN, 6)).toBeNull();
    expect(quoteBuy(mg(5.9), GRAIN, 5)).not.toBeNull();
    expect(quoteBuy(mg(0), GRAIN, 1)).toBeNull();
  });

  it("rejects non-positive and non-integer quantities", () => {
    expect(quoteBuy(mg(300), GRAIN, 0)).toBeNull();
    expect(quoteBuy(mg(300), GRAIN, -3)).toBeNull();
    expect(quoteBuy(mg(300), GRAIN, 1.5)).toBeNull();
    expect(quoteSell(mg(300), GRAIN, 0)).toBeNull();
    expect(quoteSell(mg(300), GRAIN, 2.5)).toBeNull();
  });

  it("returns integer thalers", () => {
    const salt = GOODS.aetherSalt.basePrice;
    expect(Number.isInteger(quoteBuy(mg(123, 300), salt, 7))).toBe(true);
    expect(Number.isInteger(quoteSell(mg(123, 300), salt, 7))).toBe(true);
  });
});

describe("single-port scalp regression (playtest-orb #10)", () => {
  const NEUTRAL: FlowModifiers = { production: 1, consumption: 1 };

  it("makes buy → wait k ticks → sell unprofitable for small k at nominal flows", () => {
    // Urban consumes 30 grain/day (1.25/tick): holding a lot while the port
    // eats through stock captures ~0.3%/tick of price drift — far below the
    // ~5% round-trip spread cost, so short scalps must lose money.
    const qty = 10;
    const buy = quoteBuy(mg(300), GRAIN, qty)!;
    let market = { ...fullMarket(300), grain: mg(300 - qty) };
    for (let k = 1; k <= 8; k++) {
      market = marketTick(market, ARCHETYPE_PROFILES.urban, NEUTRAL);
      const sell = quoteSell(market.grain, GRAIN, qty)!;
      expect(sell, `k=${k}`).toBeLessThanOrEqual(buy);
    }
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

  it("leaves stock already above the cap untouched by the clamp (player sales)", () => {
    // A player dump can push stock past 4×equilibrium; the cap must only
    // stop production, never confiscate the excess.
    const market = fullMarket(1500, 300); // cap = 1200
    const next = marketTick(market, ARCHETYPE_PROFILES.agrarian, NEUTRAL);
    expect(next.grain.stock).toBe(1500); // production blocked, stock kept
    expect(next.textiles.stock).toBeCloseTo(1500 - 6 / 24, 10); // consumption still runs
  });

  it("defaults modifiers to neutral", () => {
    const market = fullMarket(300);
    expect(marketTick(market, ARCHETYPE_PROFILES.agrarian)).toEqual(
      marketTick(market, ARCHETYPE_PROFILES.agrarian, NEUTRAL),
    );
  });

  it("is deterministic: same inputs => deep-equal output", () => {
    const market = fullMarket(287.5, 300);
    expect(marketTick(market, ARCHETYPE_PROFILES.mining, NEUTRAL)).toEqual(
      marketTick(market, ARCHETYPE_PROFILES.mining, NEUTRAL),
    );
    const timber = GOODS.timber.basePrice;
    expect(quoteBuy(mg(97, 300), timber, 13)).toBe(quoteBuy(mg(97, 300), timber, 13));
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
