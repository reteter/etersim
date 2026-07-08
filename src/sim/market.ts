import { GOOD_IDS, GOODS, type GoodId } from "./goods";
import { TICKS_PER_DAY, type ArchetypeProfile, type MarketGood, type Port } from "./region";

/**
 * Market rules (docs/specs/E2-trade-loop.md — Market model;
 * docs/specs/E8-living-economy.md — Price bias, Bid-ask spread). Price is a
 * pure function of stock around the port's effective base; quotes are
 * two-sided (ask above the marginal walk, bid below); production and
 * consumption move stock every tick, scaled by event modifiers (E6 hook).
 */

const ELASTICITY = 0.75;
const PRICE_FLOOR = 0.25; // × effective base
const PRICE_CEIL = 4; // × effective base
/** Warehouses hold at most this multiple of equilibrium stock. */
export const STOCK_CAP_MULTIPLIER = 4;
/** Bid-ask spread per side: buys pay the marginal walk × (1 + SPREAD),
 *  sells receive × (1 − SPREAD). The game's first money sink. */
export const SPREAD = 0.025;
/** Price-elastic flow multiplier bounds (soft saturation): a flow never
 *  drops below the floor (crisis, not standstill) nor exceeds the ceiling. */
export const FLOW_MULT_MIN = 0.25;
export const FLOW_MULT_MAX = 1.5;

/** Event-driven flow multipliers; neutral (1, 1) everywhere in E2. */
export interface FlowModifiers {
  readonly production: number;
  readonly consumption: number;
}

export const NEUTRAL_MODIFIERS: FlowModifiers = { production: 1, consumption: 1 };

/** Neutral flow drift (no daily variance) — every good's multiplier at 1×.
 *  marketTick's default, so call sites predating E8 drift are unaffected. */
export const NEUTRAL_DRIFT: Record<GoodId, number> = GOOD_IDS.reduce(
  (drift, good) => ({ ...drift, [good]: 1 }),
  {} as Record<GoodId, number>,
);

/** The port's effective base price for a good: the global base × the
 *  port's priceBias (E8) — the anchor the whole price curve scales around. */
export function effectiveBase(port: Port, good: GoodId): number {
  return GOODS[good].basePrice * port.priceBias[good];
}

/** Marginal mid price at the current stock level, in thalers (float), around
 *  the port's effective `base`. Spread-free: trend snapshots track this. */
export function price(entry: MarketGood, base: number): number {
  const raw = base * (entry.equilibrium / Math.max(entry.stock, 1)) ** ELASTICITY;
  return Math.min(PRICE_CEIL * base, Math.max(PRICE_FLOOR * base, raw));
}

/** Sum of marginal mid prices at `count` consecutive stock levels starting
 *  at `fromStock`, ascending. Both quotes use this walk in the same order;
 *  the spread is applied to the raw total before rounding. */
function walkTotal(entry: MarketGood, base: number, fromStock: number, count: number): number {
  let total = 0;
  for (let i = 0; i < count; i++) {
    total += price({ ...entry, stock: fromStock + i }, base);
  }
  return total;
}

/**
 * Total cost of buying `qty` units: the marginal walk up as stock falls
 * (unit i charged at the stock level before its removal), ×(1 + SPREAD).
 * Returns integer thalers, or null when the quantity is invalid or exceeds
 * available stock.
 */
export function quoteBuy(entry: MarketGood, base: number, qty: number): number | null {
  if (!Number.isInteger(qty) || qty <= 0 || qty > Math.floor(entry.stock)) return null;
  return Math.round(walkTotal(entry, base, entry.stock - qty + 1, qty) * (1 + SPREAD));
}

/**
 * Total earned selling `qty` units: the marginal walk down as stock rises
 * (unit i paid at the stock level after its addition — the exact mirror of
 * quoteBuy), ×(1 − SPREAD). The spread guarantee: an instant buy-then-sell
 * round trip loses ~2×SPREAD of value, so inter-tick price drift is not a
 * free scalp. Returns integer thalers, or null when the quantity is invalid.
 */
export function quoteSell(entry: MarketGood, base: number, qty: number): number | null {
  if (!Number.isInteger(qty) || qty <= 0) return null;
  return Math.round(walkTotal(entry, base, entry.stock + 1, qty) * (1 - SPREAD));
}

/**
 * Mid price ÷ effective base at the entry's stock level, independent of the
 * base (docs/specs/E8-living-economy.md — Price-elastic flows): `price`'s
 * raw term and its floor/ceiling clamp are both linear in `base`, so the
 * ratio cancels it out — see the "is base-independent" test in
 * market.test.ts for the equivalence to `price(entry, base) / base`. Evaluated
 * as `price(entry, 1)` so the elasticity curve (exponent and floor/ceiling
 * clamp) has a single source, letting marketTick derive the multiplier without
 * threading a `Port`/`effectiveBase` through its signature.
 */
function priceRatio(entry: MarketGood): number {
  return price(entry, 1);
}

/**
 * One tick of production and consumption for a port's whole market. Flows
 * are per-day values divided by TICKS_PER_DAY, then scaled by the
 * price-elastic multiplier (soft saturation, E8): production speeds up
 * to FLOW_MULT_MAX when price is high (scarcity) and slows to FLOW_MULT_MIN
 * when low (glut); consumption is the mirror, keyed to the inverse ratio.
 * Both are linear in the price ratio and equal 1× at equilibrium stock.
 * `drift` (docs/specs/E8-living-economy.md — Stochastic flow drift) is a
 * per-good multiplier on top of elasticity, stepped daily by the caller
 * (tick.ts) — it multiplies both production and consumption alike.
 * Consumption stops at stock 0 (unmet demand is lost); production stops at
 * the cap (warehouses full) — stock already above the cap (e.g. after
 * player sales) is untouched. These hard limits are unchanged by elasticity
 * or drift.
 */
export function marketTick(
  market: Record<GoodId, MarketGood>,
  profile: ArchetypeProfile,
  modifiers: FlowModifiers = NEUTRAL_MODIFIERS,
  drift: Record<GoodId, number> = NEUTRAL_DRIFT,
): Record<GoodId, MarketGood> {
  const next = {} as Record<GoodId, MarketGood>;
  for (const good of GOOD_IDS) {
    const entry = market[good];
    const ratio = priceRatio(entry);
    const productionMult = Math.min(FLOW_MULT_MAX, Math.max(FLOW_MULT_MIN, ratio));
    const consumptionMult = Math.min(FLOW_MULT_MAX, Math.max(FLOW_MULT_MIN, 1 / ratio));
    const driftMult = drift[good];
    const produced =
      ((profile.productionPerDay[good] ?? 0) / TICKS_PER_DAY) *
      modifiers.production *
      productionMult *
      driftMult;
    const consumed =
      ((profile.consumptionPerDay[good] ?? 0) / TICKS_PER_DAY) *
      modifiers.consumption *
      consumptionMult *
      driftMult;
    const cap = STOCK_CAP_MULTIPLIER * entry.equilibrium;
    const headroom = Math.max(0, cap - entry.stock);
    const stock = Math.max(0, entry.stock + Math.min(produced, headroom) - consumed);
    next[good] = { ...entry, stock };
  }
  return next;
}
