import { describe, expect, it } from "vitest";
import { GOOD_IDS, type GoodId } from "./goods";
import { effectiveBase, price, STOCK_CAP_MULTIPLIER } from "./market";
import { OSMOSIS_CAP, OSMOSIS_DEADBAND, OSMOSIS_RATE, osmosisTick } from "./osmosis";
import type { Lane, MarketGood, Port, Region } from "./region";

const neutralBias = (): Record<GoodId, number> => {
  const bias = {} as Record<GoodId, number>;
  for (const good of GOOD_IDS) bias[good] = 1;
  return bias;
};

const mg = (stock: number, equilibrium = 100): MarketGood => ({ stock, equilibrium });

/** A port whose whole market sits at equilibrium (stock 100 / eq 100 for
 *  every good), except for overrides supplied for specific goods. */
const makePort = (
  id: string,
  overrides: Partial<Record<GoodId, MarketGood>> = {},
  biasOverrides: Partial<Record<GoodId, number>> = {},
): Port => {
  const market = {} as Record<GoodId, MarketGood>;
  for (const good of GOOD_IDS) market[good] = overrides[good] ?? mg(100);
  return {
    id,
    name: id,
    archetype: "agrarian",
    x: 0,
    y: 0,
    market,
    priceBias: { ...neutralBias(), ...biasOverrides },
  };
};

const lane = (id: string, a: string, b: string, voyageTicks: number): Lane => ({
  id,
  a,
  b,
  voyageTicks,
});

const regionOf = (ports: Port[], lanes: Lane[]): Region => ({ ports, lanes });

const midPrice = (port: Port, good: GoodId): number =>
  price(port.market[good], effectiveBase(port, good));

describe("osmosisTick", () => {
  it("moves nothing when the relative price gap is at or below the deadband", () => {
    // Small, symmetric offset around equilibrium — gap must land well
    // under 15% for these stock levels (price-curve exponent 0.75).
    const a = makePort("a", { grain: mg(105) });
    const b = makePort("b", { grain: mg(95) });
    const region = regionOf([a, b], [lane("l1", "a", "b", 5)]);

    const gap =
      (Math.max(midPrice(a, "grain"), midPrice(b, "grain")) -
        Math.min(midPrice(a, "grain"), midPrice(b, "grain"))) /
      Math.min(midPrice(a, "grain"), midPrice(b, "grain"));
    expect(gap).toBeLessThanOrEqual(OSMOSIS_DEADBAND);

    const { region: next, pulse } = osmosisTick(region);
    expect(pulse.l1).toBe(0);
    expect(next.ports.find((p) => p.id === "a")!.market.grain.stock).toBe(105);
    expect(next.ports.find((p) => p.id === "b")!.market.grain.stock).toBe(95);
  });

  it("every lane gets a pulse entry, even lanes with no flow", () => {
    const a = makePort("a");
    const b = makePort("b");
    const region = regionOf([a, b], [lane("quiet", "a", "b", 5)]);
    const { pulse } = osmosisTick(region);
    expect(pulse).toEqual({ quiet: 0 });
  });

  it("moves stock from the cheap port to the expensive port", () => {
    // Large gap: a is glutted (cheap), b is scarce (expensive).
    const a = makePort("a", { grain: mg(200) });
    const b = makePort("b", { grain: mg(50) });
    const region = regionOf([a, b], [lane("l1", "a", "b", 5)]);

    const pA = midPrice(a, "grain");
    const pB = midPrice(b, "grain");
    expect(pA).toBeLessThan(pB);

    const { region: next, pulse } = osmosisTick(region);
    const nextA = next.ports.find((p) => p.id === "a")!.market.grain.stock;
    const nextB = next.ports.find((p) => p.id === "b")!.market.grain.stock;

    expect(nextA).toBeLessThan(200); // cheap port loses stock
    expect(nextB).toBeGreaterThan(50); // expensive port gains stock
    expect(200 - nextA).toBeCloseTo(nextB - 50, 10); // conservation of goods
    expect(pulse.l1).toBeGreaterThan(0); // flow a -> b, lane's `a` sent goods
  });

  it("flow direction flips (and pulse sign flips) when the expensive port is `a`", () => {
    const a = makePort("a", { grain: mg(50) }); // expensive
    const b = makePort("b", { grain: mg(200) }); // cheap
    const region = regionOf([a, b], [lane("l1", "a", "b", 5)]);

    const { region: next, pulse } = osmosisTick(region);
    const nextA = next.ports.find((p) => p.id === "a")!.market.grain.stock;
    const nextB = next.ports.find((p) => p.id === "b")!.market.grain.stock;

    expect(nextA).toBeGreaterThan(50);
    expect(nextB).toBeLessThan(200);
    expect(pulse.l1).toBeLessThan(0); // flow b -> a is negative by convention
  });

  it("respects the per-tick cap (OSMOSIS_CAP × eqAvg) for a very large gap on a short lane", () => {
    const a = makePort("a", { grain: mg(400) });
    const b = makePort("b", { grain: mg(25) });
    const region = regionOf([a, b], [lane("l1", "a", "b", 1)]);

    const pA = midPrice(a, "grain");
    const pB = midPrice(b, "grain");
    const gap = (pB - pA) / pA;
    const eqAvg = 100; // both ports' grain equilibrium is 100
    const rateTerm = (OSMOSIS_RATE * (gap - OSMOSIS_DEADBAND) * eqAvg) / 1;
    const capTerm = OSMOSIS_CAP * eqAvg;
    expect(rateTerm).toBeGreaterThan(capTerm); // the cap must actually bind here

    const { region: next } = osmosisTick(region);
    const moved = 400 - next.ports.find((p) => p.id === "a")!.market.grain.stock;
    expect(moved).toBeCloseTo(capTerm, 10);
  });

  it("attenuates by voyageTicks: a longer lane moves strictly fewer units for the same gap", () => {
    // Keep the rate term (not the cap) binding on both lanes so the
    // difference is attributable to voyageTicks alone.
    const makeGapPorts = (): [Port, Port] => [
      makePort("a", { grain: mg(150) }),
      makePort("b", { grain: mg(70) }),
    ];

    const [aShort, bShort] = makeGapPorts();
    const shortRegion = regionOf([aShort, bShort], [lane("l1", "a", "b", 4)]);
    const [aLong, bLong] = makeGapPorts();
    const longRegion = regionOf([aLong, bLong], [lane("l1", "a", "b", 40)]);

    const { region: shortNext } = osmosisTick(shortRegion);
    const { region: longNext } = osmosisTick(longRegion);

    const shortMoved = 150 - shortNext.ports.find((p) => p.id === "a")!.market.grain.stock;
    const longMoved = 150 - longNext.ports.find((p) => p.id === "a")!.market.grain.stock;

    expect(shortMoved).toBeGreaterThan(0);
    expect(longMoved).toBeGreaterThan(0);
    expect(longMoved).toBeLessThan(shortMoved);
  });

  it("computes all flows from the pre-tick snapshot: lane processing order does not change the result", () => {
    // Three ports in a chain, two lanes sharing port b so that, if flows
    // were applied sequentially instead of from a snapshot, processing
    // a-b before b-c would change b's price (and thus the a-b/b-c gap)
    // seen by the other lane.
    const a = makePort("a", { grain: mg(200) });
    const b = makePort("b", { grain: mg(90) });
    const c = makePort("c", { grain: mg(30) });

    const forward = regionOf(
      [a, b, c],
      [lane("ab", "a", "b", 3), lane("bc", "b", "c", 3)],
    );
    const reversed = regionOf(
      [a, b, c],
      [lane("bc", "b", "c", 3), lane("ab", "a", "b", 3)],
    );

    const forwardResult = osmosisTick(forward);
    const reversedResult = osmosisTick(reversed);

    const stocksOf = (region: Region) =>
      Object.fromEntries(region.ports.map((p) => [p.id, p.market.grain.stock]));

    expect(stocksOf(forwardResult.region)).toEqual(stocksOf(reversedResult.region));
    expect(forwardResult.pulse.ab).toBeCloseTo(reversedResult.pulse.ab, 10);
    expect(forwardResult.pulse.bc).toBeCloseTo(reversedResult.pulse.bc, 10);
  });

  it("is deterministic: the same region produces a deep-equal result across repeated calls", () => {
    const a = makePort("a", { grain: mg(180), textiles: mg(60) });
    const b = makePort("b", { grain: mg(40), textiles: mg(150) });
    const region = regionOf([a, b], [lane("l1", "a", "b", 6)]);

    const first = osmosisTick(region);
    const second = osmosisTick(region);

    expect(second).toEqual(first);
  });

  it("does not mutate the input region", () => {
    const a = makePort("a", { grain: mg(200) });
    const b = makePort("b", { grain: mg(50) });
    const region = regionOf([a, b], [lane("l1", "a", "b", 5)]);
    const snapshotBefore = JSON.parse(JSON.stringify(region));

    osmosisTick(region);

    expect(region).toEqual(snapshotBefore);
  });

  it("never drains the cheap port's stock below 0", () => {
    // "Cheap" means stock well above the port's own equilibrium, so to
    // have almost nothing physically left to give while still reading as
    // the cheap endpoint, its equilibrium must be tiny too (abundant
    // relative to a near-zero baseline, but a near-zero absolute amount).
    const a = makePort("a", { grain: mg(0.002, 0.001) }); // cheap, nearly empty
    const b = makePort("b", { grain: mg(20, 100) }); // expensive, scarce
    const region = regionOf([a, b], [lane("l1", "a", "b", 1)]);

    expect(midPrice(a, "grain")).toBeLessThan(midPrice(b, "grain")); // a is the cheap side

    const { region: next } = osmosisTick(region);
    const nextA = next.ports.find((p) => p.id === "a")!.market.grain.stock;
    expect(nextA).toBeGreaterThanOrEqual(0);
    expect(nextA).toBeCloseTo(0, 10); // fully drained, not negative
  });

  it("never overfills the expensive port past its stock cap", () => {
    const eq = 100;
    const cap = STOCK_CAP_MULTIPLIER * eq; // 400
    // Absolute price also scales with priceBias, so a port can carry a
    // stock near its own cap yet still be the "expensive" endpoint if its
    // bias is high enough — that's the only way an expensive port (which
    // is normally scarce, i.e. far from its cap) can be near full.
    const a = makePort("a", { grain: mg(400, eq) }); // cheap, glutted
    const b = makePort("b", { grain: mg(cap - 0.005, eq) }, { grain: 20 }); // expensive via bias, nearly full
    const region = regionOf([a, b], [lane("l1", "a", "b", 1)]);

    expect(midPrice(a, "grain")).toBeLessThan(midPrice(b, "grain")); // b is the expensive side

    const { region: next } = osmosisTick(region);
    const nextB = next.ports.find((p) => p.id === "b")!.market.grain.stock;
    expect(nextB).toBeLessThanOrEqual(cap);
    expect(nextB).toBeCloseTo(cap, 10);
  });
});
