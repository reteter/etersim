import { GOOD_IDS, GOODS, type GoodId } from "./goods";
import { TICKS_PER_DAY, type ArchetypeProfile, type MarketGood } from "./region";

/**
 * Market rules (docs/specs/E2-trade-loop.md — Market model). Price is a
 * pure function of stock; trading is marginal per unit; production and
 * consumption move stock every tick, scaled by event modifiers (E6 hook).
 */

const ELASTICITY = 0.75;
const PRICE_FLOOR = 0.25; // × base
const PRICE_CEIL = 4; // × base
/** Warehouses hold at most this multiple of equilibrium stock. */
export const STOCK_CAP_MULTIPLIER = 4;

/** Event-driven flow multipliers; neutral (1, 1) everywhere in E2. */
export interface FlowModifiers {
  readonly production: number;
  readonly consumption: number;
}

export const NEUTRAL_MODIFIERS: FlowModifiers = { production: 1, consumption: 1 };

/** Marginal price of `good` at the current stock level, in thalers (float). */
export function price(good: GoodId, entry: MarketGood): number {
  const base = GOODS[good].basePrice;
  const raw = base * (entry.equilibrium / Math.max(entry.stock, 1)) ** ELASTICITY;
  return Math.min(PRICE_CEIL * base, Math.max(PRICE_FLOOR * base, raw));
}

/** Sum of marginal prices at `count` consecutive stock levels starting at
 *  `fromStock`, ascending. Both quotes use this walk in the same order, so
 *  a buy-then-sell round trip sums bit-identical terms. */
function walkTotal(good: GoodId, entry: MarketGood, fromStock: number, count: number): number {
  let total = 0;
  for (let i = 0; i < count; i++) {
    total += price(good, { ...entry, stock: fromStock + i });
  }
  return Math.round(total);
}

/**
 * Total cost of buying `qty` units, walking the price up as stock falls:
 * unit i is charged at the stock level before its removal. Returns integer
 * thalers, or null when the quantity is invalid or exceeds available stock.
 */
export function quoteBuy(good: GoodId, entry: MarketGood, qty: number): number | null {
  if (!Number.isInteger(qty) || qty <= 0 || qty > Math.floor(entry.stock)) return null;
  return walkTotal(good, entry, entry.stock - qty + 1, qty);
}

/**
 * Total earned selling `qty` units, walking the price down as stock rises:
 * unit i is paid at the stock level after its addition — the exact mirror
 * of quoteBuy, so a buy-then-sell round trip at one market never profits.
 * Returns integer thalers, or null when the quantity is invalid.
 */
export function quoteSell(good: GoodId, entry: MarketGood, qty: number): number | null {
  if (!Number.isInteger(qty) || qty <= 0) return null;
  return walkTotal(good, entry, entry.stock + 1, qty);
}

/**
 * One tick of production and consumption for a port's whole market. Flows
 * are per-day values divided by TICKS_PER_DAY. Consumption stops at stock
 * 0 (unmet demand is lost); production stops at the cap (warehouses full)
 * — stock already above the cap (e.g. after player sales) is untouched.
 */
export function marketTick(
  market: Record<GoodId, MarketGood>,
  profile: ArchetypeProfile,
  modifiers: FlowModifiers = NEUTRAL_MODIFIERS,
): Record<GoodId, MarketGood> {
  const next = {} as Record<GoodId, MarketGood>;
  for (const good of GOOD_IDS) {
    const entry = market[good];
    const produced =
      ((profile.productionPerDay[good] ?? 0) / TICKS_PER_DAY) * modifiers.production;
    const consumed =
      ((profile.consumptionPerDay[good] ?? 0) / TICKS_PER_DAY) * modifiers.consumption;
    const cap = STOCK_CAP_MULTIPLIER * entry.equilibrium;
    const headroom = Math.max(0, cap - entry.stock);
    const stock = Math.max(0, entry.stock + Math.min(produced, headroom) - consumed);
    next[good] = { ...entry, stock };
  }
  return next;
}
