import { describe, expect, it } from "vitest";
import {
  GOOD_IDS,
  type ActiveContract,
  type GoodId,
  type MarketGood,
  type Port,
  type PortArchetype,
  type PortId,
} from "../sim";
import { computeMarketSignal } from "./marketSignal";
import { computeOfferLabels, RARE_PRODUCER_PORT_MAX } from "./offerLabels";

/** Minimal Port builder (mirrors `marketSignal.test.ts`'s `makePort`), with a
 *  settable archetype since offer labels (unlike the market-quality signal)
 *  read `Port.archetype` for producer-scarcity. */
function makePort(
  id: string,
  archetype: PortArchetype,
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
  return { id: id as PortId, name: id, archetype, x: 0, y: 0, market, priceBias };
}

const GOOD: GoodId = "grain"; // produced only by "agrarian" (ARCHETYPE_PROFILES)

function makeContract(overrides: Partial<ActiveContract> & Pick<ActiveContract, "portId" | "good">): ActiveContract {
  return {
    id: `c:${overrides.portId}:${overrides.good}`,
    guildId: "agrarian",
    quotaPerPeriod: 10,
    periodDays: 3,
    minPeriods: 3,
    feePerPeriod: 100,
    tier: 1,
    requiredRank: 1,
    basis: { sourcePortId: overrides.portId, roundTripTicks: 24, expectedTrips: 1 },
    startTick: 0,
    periodIndex: 0,
    deliveredThisPeriod: 0,
    consecutiveMisses: 0,
    ...overrides,
  };
}

describe("computeOfferLabels", () => {
  it("bargain (okazja): fires exactly where the signal's buyTier is strong, nowhere else", () => {
    const cheap = makePort("cheap", "agrarian", { bias: 1 });
    const dear = makePort("dear", "agrarian", { bias: 1.2 });
    const signal = computeMarketSignal([cheap, dear]);
    const labels = computeOfferLabels([cheap, dear], signal, []);

    expect(labels.entries[cheap.id][GOOD].buy).toContain("bargain");
    expect(labels.entries[dear.id][GOOD].buy).not.toContain("bargain");
  });

  it("scarce (rzadkie): fires only at a producer port when the good's region-wide producer count is at/below the threshold", () => {
    // grain: agrarian produces it (RARE_PRODUCER_PORT_MAX=1 producer here);
    // textiles: agrarian does NOT produce it (consumer only) -> never scarce
    // there even though the region also has exactly one producer (urban).
    const agrarian = makePort("agrarian-1", "agrarian");
    const urban = makePort("urban-1", "urban"); // produces textiles
    const signal = computeMarketSignal([agrarian, urban]);
    const labels = computeOfferLabels([agrarian, urban], signal, []);

    expect(RARE_PRODUCER_PORT_MAX).toBe(1); // pin the tuning constant
    expect(labels.entries[agrarian.id]["grain"].buy).toContain("scarce");
    expect(labels.entries[urban.id]["grain"].buy).not.toContain("scarce");
    expect(labels.entries[urban.id]["textiles"].buy).toContain("scarce");
    // Consumption alone never marks a port a producer.
    expect(labels.entries[agrarian.id]["textiles"].buy).not.toContain("scarce");
  });

  it("scarce does not fire once a second port also produces the good (above the rarity threshold)", () => {
    const a = makePort("a", "agrarian");
    const b = makePort("b", "agrarian"); // a second grain producer
    const signal = computeMarketSignal([a, b]);
    const labels = computeOfferLabels([a, b], signal, []);

    expect(labels.entries[a.id]["grain"].buy).not.toContain("scarce");
    expect(labels.entries[b.id]["grain"].buy).not.toContain("scarce");
  });

  it("urgent (pilne): fires on the SELL side for a port+good with an active contract that still has quota outstanding", () => {
    const port = makePort("p", "agrarian");
    const signal = computeMarketSignal([port]);
    const contract = makeContract({ portId: port.id, good: "grain", quotaPerPeriod: 10, deliveredThisPeriod: 4 });
    const labels = computeOfferLabels([port], signal, [contract]);

    expect(labels.entries[port.id]["grain"].sell).toContain("urgent");
    expect(labels.entries[port.id]["grain"].buy).not.toContain("urgent");
  });

  it("urgent does not fire once the contract's quota for this period is already met", () => {
    const port = makePort("p", "agrarian");
    const signal = computeMarketSignal([port]);
    const contract = makeContract({ portId: port.id, good: "grain", quotaPerPeriod: 10, deliveredThisPeriod: 10 });
    const labels = computeOfferLabels([port], signal, [contract]);

    expect(labels.entries[port.id]["grain"].sell).not.toContain("urgent");
  });

  it("urgent does not fire for a different port or a different good than the contract names", () => {
    const target = makePort("target", "agrarian");
    const other = makePort("other", "agrarian");
    const signal = computeMarketSignal([target, other]);
    const contract = makeContract({ portId: target.id, good: "grain", quotaPerPeriod: 10, deliveredThisPeriod: 0 });
    const labels = computeOfferLabels([target, other], signal, [contract]);

    expect(labels.entries[other.id]["grain"].sell).not.toContain("urgent");
    expect(labels.entries[target.id]["textiles"].sell).not.toContain("urgent");
  });

  it("bargain and scarce co-fire in the fixed [bargain, scarce] order on the buy side of the same cell", () => {
    // A single producer port with no competing ask reads both: it's the
    // region's only source (scarce) and, being the only quote, also the
    // cheapest (bargain).
    const lone = makePort("lone", "agrarian");
    const signal = computeMarketSignal([lone]);
    const labels = computeOfferLabels([lone], signal, []);

    expect(labels.entries[lone.id]["grain"].buy).toEqual(["bargain", "scarce"]);
  });

  it("an untradable quote (no stock to buy) never carries 'bargain' even at a scarce producer", () => {
    const empty = makePort("empty", "agrarian", { stock: 0, equilibrium: 1000 });
    const signal = computeMarketSignal([empty]);
    const labels = computeOfferLabels([empty], signal, []);

    expect(labels.entries[empty.id]["grain"].buy).not.toContain("bargain");
    expect(labels.entries[empty.id]["grain"].buy).toContain("scarce");
  });
});
