import {
  effectiveBase,
  GOOD_IDS,
  quoteBuy,
  quoteSell,
  type GoodId,
  type Port,
  type PortId,
} from "../sim";

/**
 * Market-quality signal (docs/specs/E16-workbench.md — Store bridge; CONTEXT.md
 * Market-quality signal): a per-(port, good, direction) rank of how good a
 * market is relative to the region, computed **once** here (Professor Finding
 * 4 discipline — the #319 `resolveRelevantShip` precedent) and read by every
 * surface (board cell emphasis, PortPanel action shading, offer labels) so
 * "best market" means the same thing everywhere by construction.
 *
 * Visual channel is intensity (opacity/weight), deliberately hue-free
 * (ADR-0006) — this module only classifies; it never picks a color.
 */

export type SignalTier = "strong" | "mid" | "weak";

/** Proportional "near-best" band: a quote within 8% of the region's best
 *  ask/bid for a good still reads as a strong-adjacent "mid" market. Tuning,
 *  not semantic law (E16 spec) — safe to retune without touching the tier
 *  rule's shape. Tests pin this value as tuning-pinned, not a spec contract. */
export const NEAR_BEST_BAND = 0.08;

/** One port×good two-sided quote at qty=1 — the exact same quote helpers
 *  `PriceBoardOverlay` uses (`quoteBuy`/`quoteSell`/`effectiveBase`). Sharing
 *  this function is load-bearing: reimplementing quoting here would let the
 *  signal silently drift from what the board displays (E16 spec — Trap 2). */
export function quotePortGood(port: Port, good: GoodId): { bid: number | null; ask: number | null } {
  const entry = port.market[good];
  const base = effectiveBase(port, good);
  return { bid: quoteSell(entry, base, 1), ask: quoteBuy(entry, base, 1) };
}

/** Buy/sell tier for one port×good, plus the region's best-ask/best-bid port
 *  ids for pairing (consumed by a later E16 issue's highlight-only pairing
 *  assist; exposed now so the shape doesn't change under that consumer). */
export interface MarketSignalEntry {
  readonly buyTier: SignalTier | null;
  readonly sellTier: SignalTier | null;
}

export interface MarketSignal {
  readonly entries: Record<PortId, Record<GoodId, MarketSignalEntry>>;
  /** Regional best-ask port per good (ties broken by port iteration order —
   *  arbitrary but deterministic; the tier rule below, not this id, is what
   *  drives "every tied port lights up" — E16 spec Trap 1). */
  readonly bestAskPortId: Record<GoodId, PortId | null>;
  readonly bestBidPortId: Record<GoodId, PortId | null>;
}

/** direction: "buy" ranks a lower ask as better (min); "sell" ranks a higher
 *  bid as better (max). `best` is the regional extreme already computed by
 *  the caller. Equality to the extreme is "strong" — deliberately an exact
 *  match, not "within a tiny epsilon", so every port tied at the true extreme
 *  reads strong (Trap 1: the old `columnExtremes` highlight worked the same
 *  way — `cell.ask === bestAsk[good]`). */
function tierFor(value: number, best: number, direction: "buy" | "sell"): SignalTier {
  if (value === best) return "strong";
  const withinBand =
    direction === "buy" ? value <= best * (1 + NEAR_BEST_BAND) : value >= best * (1 - NEAR_BEST_BAND);
  return withinBand ? "mid" : "weak";
}

/**
 * Computes the market-quality signal for every (port, good) in the region,
 * once. Pure and deterministic: same `ports` (by value) always yields the
 * same tiers — no RNG, no clock (ADR-0003 applies to any consumer relying on
 * this for determinism, though this module itself never touches the sim's
 * seeded RNG).
 *
 * Deviation flagged for the Orchestrator: the spec's Tech section describes
 * the shape as `(region, priceSnapshots)`; `priceSnapshots` carries only the
 * previous tick's mid-price (for the board's trend glyph) and is not needed
 * by the tier rule below (which reads only the live `port.market` quotes,
 * exactly as the `columnExtremes` helper it replaces did). Kept the
 * signature to `(ports)` rather than accept an unused parameter
 * (`noUnusedParameters` is on) — nothing here forecloses a later signature
 * widening if a future signal input needs the snapshot.
 */
export function computeMarketSignal(ports: readonly Port[]): MarketSignal {
  const quotesByPort = new Map<PortId, Record<GoodId, { bid: number | null; ask: number | null }>>();
  for (const port of ports) {
    const quotes = {} as Record<GoodId, { bid: number | null; ask: number | null }>;
    for (const good of GOOD_IDS) quotes[good] = quotePortGood(port, good);
    quotesByPort.set(port.id, quotes);
  }

  const entries = {} as Record<PortId, Record<GoodId, MarketSignalEntry>>;
  for (const port of ports) entries[port.id] = {} as Record<GoodId, MarketSignalEntry>;
  const bestAskPortId = {} as Record<GoodId, PortId | null>;
  const bestBidPortId = {} as Record<GoodId, PortId | null>;

  for (const good of GOOD_IDS) {
    let bestAsk: number | null = null;
    let bestBid: number | null = null;
    for (const port of ports) {
      const q = quotesByPort.get(port.id)![good];
      if (q.ask !== null && (bestAsk === null || q.ask < bestAsk)) bestAsk = q.ask;
      if (q.bid !== null && (bestBid === null || q.bid > bestBid)) bestBid = q.bid;
    }

    let askPortId: PortId | null = null;
    let bidPortId: PortId | null = null;
    for (const port of ports) {
      const q = quotesByPort.get(port.id)![good];
      if (askPortId === null && bestAsk !== null && q.ask === bestAsk) askPortId = port.id;
      if (bidPortId === null && bestBid !== null && q.bid === bestBid) bidPortId = port.id;
    }
    bestAskPortId[good] = askPortId;
    bestBidPortId[good] = bidPortId;

    for (const port of ports) {
      const q = quotesByPort.get(port.id)![good];
      const buyTier = q.ask === null || bestAsk === null ? null : tierFor(q.ask, bestAsk, "buy");
      const sellTier = q.bid === null || bestBid === null ? null : tierFor(q.bid, bestBid, "sell");
      entries[port.id][good] = { buyTier, sellTier };
    }
  }

  return { entries, bestAskPortId, bestBidPortId };
}
