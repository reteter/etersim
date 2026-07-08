import { describe, expect, it } from "vitest";
import { GOOD_IDS, GOODS } from "./goods";
import {
  effectiveBase,
  FLOW_MULT_MAX,
  FLOW_MULT_MIN,
  marketTick,
  price,
  quoteBuy,
  quoteSell,
  SPREAD,
  type FlowModifiers,
} from "./market";
import { ARCHETYPE_BIAS, ARCHETYPE_PROFILES } from "./region";
import type { GoodId } from "./goods";
import type { ArchetypeProfile, MarketGood, Port } from "./region";

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

/** Elasticity ratio at a stock level, via the already-tested base
 *  independence of `price(entry, base) / base` (any base works). */
const ratioAt = (stock: number, equilibrium = 300): number =>
  price(mg(stock, equilibrium), GRAIN) / GRAIN;

const productionMultAt = (stock: number, equilibrium = 300): number =>
  Math.min(FLOW_MULT_MAX, Math.max(FLOW_MULT_MIN, ratioAt(stock, equilibrium)));

const consumptionMultAt = (stock: number, equilibrium = 300): number =>
  Math.min(FLOW_MULT_MAX, Math.max(FLOW_MULT_MIN, 1 / ratioAt(stock, equilibrium)));

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
    // Consumption still runs, at the elastic rate for this glutted stock
    // (well above equilibrium ⇒ low price ⇒ consumption sped up).
    expect(next.textiles.stock).toBeCloseTo(1500 - (6 / 24) * consumptionMultAt(1500), 10);
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

describe("price ratio is base-independent (E8 price-elastic flows)", () => {
  it("price(entry, base) / base is the same regardless of which base is used", () => {
    for (const stock of [1, 50, 150, 300, 900, 1_000_000]) {
      const entry = mg(stock, 300);
      const ratioAtGrain = price(entry, GRAIN) / GRAIN;
      const ratioAtElectronics = price(entry, ELECTRONICS) / ELECTRONICS;
      const ratioAtArbitrary = price(entry, 12345.678) / 12345.678;
      expect(ratioAtElectronics).toBeCloseTo(ratioAtGrain, 10);
      expect(ratioAtArbitrary).toBeCloseTo(ratioAtGrain, 10);
    }
  });
});

describe("elasticity multiplier curve (soft saturation, E8)", () => {
  it("equals 1× at equilibrium stock, for both production and consumption", () => {
    expect(productionMultAt(300)).toBeCloseTo(1, 10);
    expect(consumptionMultAt(300)).toBeCloseTo(1, 10);
  });

  it("clamps production at FLOW_MULT_MAX for scarce stock and FLOW_MULT_MIN for glutted stock", () => {
    expect(productionMultAt(1)).toBeCloseTo(FLOW_MULT_MAX, 10);
    expect(productionMultAt(1_000_000)).toBeCloseTo(FLOW_MULT_MIN, 10);
  });

  it("clamps consumption at FLOW_MULT_MIN for scarce stock and FLOW_MULT_MAX for glutted stock", () => {
    expect(consumptionMultAt(1)).toBeCloseTo(FLOW_MULT_MIN, 10);
    expect(consumptionMultAt(1_000_000)).toBeCloseTo(FLOW_MULT_MAX, 10);
  });

  it("is monotone in the price ratio: production slows and consumption speeds up as stock rises", () => {
    const stocks = [50, 150, 300, 600, 1200];
    for (let i = 1; i < stocks.length; i++) {
      expect(productionMultAt(stocks[i])).toBeLessThanOrEqual(productionMultAt(stocks[i - 1]));
      expect(consumptionMultAt(stocks[i])).toBeGreaterThanOrEqual(
        consumptionMultAt(stocks[i - 1]),
      );
    }
  });
});

describe("marketTick — price-elastic flows (soft saturation, E8)", () => {
  const NEUTRAL: FlowModifiers = { production: 1, consumption: 1 };
  const PRODUCER_ONLY: ArchetypeProfile = {
    productionPerDay: { grain: 24 }, // 1/tick baseline
    consumptionPerDay: {},
  };
  const CONSUMER_ONLY: ArchetypeProfile = {
    productionPerDay: {},
    consumptionPerDay: { grain: 24 }, // 1/tick baseline
  };

  it("scales production by the elasticity multiplier", () => {
    const stock = 120;
    const market = fullMarket(stock, 300);
    const next = marketTick(market, PRODUCER_ONLY, NEUTRAL);
    expect(next.grain.stock - stock).toBeCloseTo(productionMultAt(stock), 10);
  });

  it("scales consumption by the elasticity multiplier", () => {
    const stock = 120;
    const market = fullMarket(stock, 300);
    const next = marketTick(market, CONSUMER_ONLY, NEUTRAL);
    expect(stock - next.grain.stock).toBeCloseTo(consumptionMultAt(stock), 10);
  });

  it("a producer near the stock floor (scarce, high price) speeds production up to 1.5×", () => {
    const stock = 10; // equilibrium 300, headroom (1190) far exceeds any possible flow
    const market = fullMarket(stock, 300);
    const next = marketTick(market, PRODUCER_ONLY, NEUTRAL);
    expect(next.grain.stock - stock).toBeCloseTo(FLOW_MULT_MAX, 10);
  });

  it("a producer near the stock cap (glutted, low price) clamps production down", () => {
    const stock = 1100; // equilibrium 300, cap 1200 — headroom (100) exceeds any possible flow
    const market = fullMarket(stock, 300);
    const next = marketTick(market, PRODUCER_ONLY, NEUTRAL);
    const delta = next.grain.stock - stock;
    expect(delta).toBeCloseTo(productionMultAt(stock), 10);
    expect(delta).toBeLessThan(1); // well below the 1× baseline
  });

  it("an isolated consumer approaches stock 0 strictly slower than the constant-flow model, and still reaches it", () => {
    const initial = 50;
    let elastic = fullMarket(initial, 300);
    let baseline = initial; // old constant-flow model: −1/tick, floored at 0

    for (let tick = 1; baseline > 0; tick++) {
      elastic = marketTick(elastic, CONSUMER_ONLY, NEUTRAL);
      baseline = Math.max(0, baseline - 1);
      // Soft saturation: while the constant-flow model is still depleting,
      // the elastic model — slowed by the rising price — must lag behind it.
      expect(elastic.grain.stock, `tick=${tick}`).toBeGreaterThan(baseline);
    }

    // Elasticity never stops the flow outright (floor, not zero): it must
    // still reach stock 0 eventually — soft saturation, not self-stabilization.
    for (let tick = 0; tick < 1000 && elastic.grain.stock > 0; tick++) {
      elastic = marketTick(elastic, CONSUMER_ONLY, NEUTRAL);
    }
    expect(elastic.grain.stock).toBe(0);
  });
});
