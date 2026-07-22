import { describe, expect, it } from "vitest";
import { GOOD_IDS, type GoodId, type MarketGood, type Port, type PortId } from "../sim";
import { computeMarketSignal, NEAR_BEST_BAND } from "./marketSignal";

/** Good under test: timber (basePrice 250) — large enough that the
 *  quote-rounding (integer thalers) doesn't blur the 8% band boundary the
 *  way a cheap good like grain (basePrice 10) would. */
const GOOD: GoodId = "timber";

/** A minimal Port with every good's market/priceBias filled identically
 *  (`stock`/`equilibrium` default to equal, so the price curve's ratio is
 *  exactly 1 and `ask = round(base * 1.025)` has no curve-shape noise —
 *  only `bias` moves the price). Only `GOOD` is ever asserted on. */
function makePort(
  id: string,
  opts: { bias?: number; stock?: number; equilibrium?: number } = {},
): Port {
  const bias = opts.bias ?? 1;
  const equilibrium = opts.equilibrium ?? 1000;
  const stock = opts.stock ?? equilibrium;
  const market = GOOD_IDS.reduce(
    (m, g) => ({ ...m, [g]: { stock, equilibrium } satisfies MarketGood }),
    {} as Record<GoodId, MarketGood>,
  );
  const priceBias = GOOD_IDS.reduce((m, g) => ({ ...m, [g]: bias }), {} as Record<GoodId, number>);
  return { id: id as PortId, name: id, archetype: "freeport", x: 0, y: 0, market, priceBias };
}

describe("computeMarketSignal", () => {
  it("is pure/deterministic — same ports (by value) yield the same signal", () => {
    const ports = [makePort("a", { bias: 1 }), makePort("b", { bias: 1.2 })];
    const first = computeMarketSignal(ports);
    const second = computeMarketSignal(ports);
    expect(second).toEqual(first);
  });

  it("marks the single cheapest ask 'strong' and reports it as bestAskPortId (reproduces the old columnExtremes cheapest-ask pick)", () => {
    const cheapest = makePort("cheap", { bias: 1 }); // ask = round(250*1.025) = 256
    const dearer = makePort("dear", { bias: 1.2 }); // ask = round(300*1.025) = 308, far outside the band
    const signal = computeMarketSignal([cheapest, dearer]);

    expect(signal.bestAskPortId[GOOD]).toBe(cheapest.id);
    expect(signal.entries[cheapest.id][GOOD].buyTier).toBe("strong");
    expect(signal.entries[dearer.id][GOOD].buyTier).toBe("weak");
  });

  it("a tie at the regional extreme marks every tied port 'strong' (Trap 1 — the board highlight must not key off a singular bestAskPortId)", () => {
    const tiedA = makePort("tied-a", { bias: 1 });
    const tiedB = makePort("tied-b", { bias: 1 }); // identical bias/stock ⇒ identical ask
    const signal = computeMarketSignal([tiedA, tiedB]);

    expect(signal.entries[tiedA.id][GOOD].buyTier).toBe("strong");
    expect(signal.entries[tiedB.id][GOOD].buyTier).toBe("strong");
    // bestAskPortId only names one of the tied ports (pairing needs a single
    // id) — the tier, not this id, is what the board must read for highlight.
    expect([tiedA.id, tiedB.id]).toContain(signal.bestAskPortId[GOOD]);
  });

  it("NEAR_BEST_BAND (tuning-pinned, not semantic) draws the mid/weak line at a proportional 8% of the best ask", () => {
    expect(NEAR_BEST_BAND).toBe(0.08); // pin the tuning constant itself

    const best = makePort("best", { bias: 1 }); // ask = 256
    // bias 1.077 -> base 269.25 -> ask = round(275.97825) = 276 = 256*1.08 - 0.48 -> inside the band (mid)
    const justInsideBand = makePort("inside", { bias: 1.077 });
    // bias 1.081 -> base 270.25 -> ask = round(277.00625) = 277 -> outside the 276.48 threshold (weak)
    const justOutsideBand = makePort("outside", { bias: 1.081 });

    const signal = computeMarketSignal([best, justInsideBand, justOutsideBand]);

    expect(signal.entries[best.id][GOOD].buyTier).toBe("strong");
    expect(signal.entries[justInsideBand.id][GOOD].buyTier).toBe("mid");
    expect(signal.entries[justOutsideBand.id][GOOD].buyTier).toBe("weak");
  });

  it("an untradable quote (no stock to buy) is excluded from the extreme and carries no buyTier", () => {
    const tradable = makePort("tradable", { bias: 1 });
    const empty = makePort("empty", { bias: 1, stock: 0, equilibrium: 1000 }); // ask = null (qty 1 > floor(stock) 0)
    const signal = computeMarketSignal([tradable, empty]);

    expect(signal.bestAskPortId[GOOD]).toBe(tradable.id);
    expect(signal.entries[tradable.id][GOOD].buyTier).toBe("strong");
    expect(signal.entries[empty.id][GOOD].buyTier).toBeNull();
  });

  it("sellTier mirrors buyTier's rule on the bid side (higher bid = better)", () => {
    // stock = equilibrium - 1 so quoteSell's fromStock (stock+1) lands exactly
    // at equilibrium — ratio 1, bid = round(base * 0.975), no curve noise.
    const bestBid = makePort("best-bid", { bias: 1.2, equilibrium: 1000, stock: 999 }); // base 300 -> bid = round(292.5) = 293
    const worseBid = makePort("worse-bid", { bias: 1, equilibrium: 1000, stock: 999 }); // base 250 -> bid = round(243.75) = 244, far below

    const signal = computeMarketSignal([bestBid, worseBid]);

    expect(signal.bestBidPortId[GOOD]).toBe(bestBid.id);
    expect(signal.entries[bestBid.id][GOOD].sellTier).toBe("strong");
    expect(signal.entries[worseBid.id][GOOD].sellTier).toBe("weak");
  });
});
