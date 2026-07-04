import { GOOD_IDS, GOODS, type GoodId } from "./goods";
import type { ArchetypeProfile, MarketGood } from "./region";
import { TICKS_PER_DAY } from "./tick";

/**
 * Market rules (docs/specs/E2-trade-loop.md — Market model). Price is a
 * pure function of stock; trading is marginal per unit; production and
 * consumption move stock every tick, scaled by event modifiers (E6 hook).
 */

const ELASTICITY = 0.75;
const PRICE_FLOOR = 0.25; // × base
const PRICE_CEIL = 4; // × base
/** Stock cap as a multiple of equilibrium — warehouses full. */
export const STOCK_CAP = 4;

/** Event-driven flow multipliers; neutral (1, 1) everywhere in E2. */
export interface FlowModifiers {
  readonly production: number;
  readonly consumption: number;
}

export const NEUTRAL_MODIFIERS: FlowModifiers = { production: 1, consumption: 1 };

/** Marginal price of `good` at the current stock level, in thalers (float). */
export function price(good: GoodId, market: MarketGood): number {
  const base = GOODS[good].basePrice;
  const raw = base * (market.equilibrium / Math.max(market.stock, 1)) ** ELASTICITY;
  return Math.min(PRICE_CEIL * base, Math.max(PRICE_FLOOR * base, raw));
}

/**
 * Total cost of buying `qty` units, walking the price up as stock falls:
 * unit i is charged at the stock level before its removal. Returns integer
 * thalers, or null when the quantity is invalid or exceeds available stock.
 */
export function quoteBuy(good: GoodId, market: MarketGood, qty: number): number | null {
  if (!Number.isInteger(qty) || qty <= 0 || qty > Math.floor(market.stock)) return null;
  let total = 0;
  for (let i = 0; i < qty; i++) {
    total += price(good, { ...market, stock: market.stock - i });
  }
  return Math.round(total);
}

/**
 * Total earned selling `qty` units, walking the price down as stock rises:
 * unit i is paid at the stock level after its addition — the exact mirror
 * of quoteBuy, so a buy-then-sell round trip at one market never profits.
 * Returns integer thalers, or null when the quantity is invalid.
 */
export function quoteSell(good: GoodId, market: MarketGood, qty: number): number | null {
  if (!Number.isInteger(qty) || qty <= 0) return null;
  let total = 0;
  for (let i = 1; i <= qty; i++) {
    total += price(good, { ...market, stock: market.stock + i });
  }
  return Math.round(total);
}

/**
 * One tick of production and consumption for a port's whole market. Flows
 * are per-day values divided by TICKS_PER_DAY. Consumption stops at stock
 * 0 (unmet demand is lost); production stops at the cap (warehouses full).
 */
export function marketTick(
  market: Record<GoodId, MarketGood>,
  profile: ArchetypeProfile,
  modifiers: FlowModifiers,
): Record<GoodId, MarketGood> {
  const next = {} as Record<GoodId, MarketGood>;
  for (const good of GOOD_IDS) {
    const entry = market[good];
    const produced =
      ((profile.productionPerDay[good] ?? 0) / TICKS_PER_DAY) * modifiers.production;
    const consumed =
      ((profile.consumptionPerDay[good] ?? 0) / TICKS_PER_DAY) * modifiers.consumption;
    const cap = STOCK_CAP * entry.equilibrium;
    const afterProduction = Math.min(cap, entry.stock + produced);
    const stock = Math.max(0, afterProduction - consumed);
    next[good] = { ...entry, stock };
  }
  return next;
}
