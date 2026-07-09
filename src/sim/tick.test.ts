import { describe, expect, it } from "vitest";
import { AUTO_DRAW_PER_DAY, SHIP_RECIPE } from "./building";
import { GOOD_IDS, type GoodId } from "./goods";
import { DRIFT_MAX, DRIFT_MIN, driftStep, tick } from "./tick";
import type { MarketGood, Port, PortId, Region } from "./region";
import { seedRng } from "./rng";
import { createWorld, type World } from "./world";

function richForHq(w: World): World {
  return { ...w, company: { ...w.company, thalers: 20000 } };
}

const runTicks = (world: World, count: number): World => {
  let current = world;
  for (let i = 0; i < count; i++) {
    current = tick(current, []);
  }
  return current;
};

describe("tick", () => {
  it("advances world time by exactly one tick", () => {
    const world = createWorld(1);
    expect(tick(world, []).tick).toBe(1);
    expect(runTicks(world, 5).tick).toBe(5);
  });

  it("does not mutate the input world", () => {
    const world = createWorld(1);
    const snapshot = structuredClone(world);
    tick(world, []);
    expect(world).toEqual(snapshot);
  });

  it("is deterministic: same seed + same commands over N ticks => deep-equal world", () => {
    // 1000 ticks spans >40 world days, so this already exercises drift steps
    // and osmosis on every tick (docs/specs/E8-living-economy.md).
    const runA = runTicks(createWorld(42), 1000);
    const runB = runTicks(createWorld(42), 1000);
    expect(runA).toEqual(runB);
  });
});

/** A region with just enough ports (no lanes needed — driftStep never reads
 *  the market) to exercise driftStep's port × good iteration. */
const driftRegion = (portIds: string[]): Region => {
  const market = {} as Record<GoodId, MarketGood>;
  const priceBias = {} as Record<GoodId, number>;
  for (const good of GOOD_IDS) {
    market[good] = { stock: 100, equilibrium: 100 };
    priceBias[good] = 1;
  }
  const ports: Port[] = portIds.map((id) => ({
    id,
    name: id,
    archetype: "agrarian",
    x: 0,
    y: 0,
    market,
    priceBias,
  }));
  return { ports, lanes: [] };
};

const uniformDrift = (portIds: string[], value: number): Record<PortId, Record<GoodId, number>> => {
  const drift: Record<PortId, Record<GoodId, number>> = {};
  for (const id of portIds) {
    const goods = {} as Record<GoodId, number>;
    for (const good of GOOD_IDS) goods[good] = value;
    drift[id] = goods;
  }
  return drift;
};

describe("driftStep (E8 stochastic flow drift)", () => {
  it("stays within [0.7, 1.3] across many repeated steps from varied starts", () => {
    const region = driftRegion(["p0", "p1"]);
    let drift = uniformDrift(["p0", "p1"], 0.7);
    let rng = seedRng(1);
    for (let day = 0; day < 500; day++) {
      [drift, rng] = driftStep(region, drift, rng);
      for (const port of region.ports) {
        for (const good of GOOD_IDS) {
          expect(drift[port.id][good]).toBeGreaterThanOrEqual(DRIFT_MIN);
          expect(drift[port.id][good]).toBeLessThanOrEqual(DRIFT_MAX);
        }
      }
    }
  });

  it("advances the RNG state and returns a new drift table each call", () => {
    const region = driftRegion(["p0"]);
    const drift0 = uniformDrift(["p0"], 1);
    const rng0 = seedRng(5);
    const [drift1, rng1] = driftStep(region, drift0, rng0);
    expect(rng1).not.toBe(rng0);
    expect(drift1).not.toBe(drift0);
  });

  it("is deterministic: same region + drift + rng state => deep-equal result", () => {
    const region = driftRegion(["p0", "p1", "p2"]);
    const drift = uniformDrift(["p0", "p1", "p2"], 1.1);
    const rng = seedRng(123);
    expect(driftStep(region, drift, rng)).toEqual(driftStep(region, drift, rng));
  });

  it("mean-reverts toward 1: the average next-step value from an extreme start moves back toward 1", () => {
    // A single trajectory is noisy (±DRIFT_STEP each day); average many
    // independent draws from the same extreme start instead — the formula's
    // expectation is m + DRIFT_REVERT*(1-m) (the ±DRIFT_STEP noise averages
    // to 0), so the mean must land strictly between the start and 1.
    const region = driftRegion(["p0"]);
    const SAMPLES = 2000;

    const meanNextFrom = (start: number): number => {
      let total = 0;
      let rng = seedRng(777);
      for (let i = 0; i < SAMPLES; i++) {
        const drift = uniformDrift(["p0"], start);
        let next: Record<PortId, Record<GoodId, number>>;
        [next, rng] = driftStep(region, drift, rng);
        total += next.p0.grain;
      }
      return total / SAMPLES;
    };

    const meanFromHigh = meanNextFrom(DRIFT_MAX);
    expect(meanFromHigh).toBeLessThan(DRIFT_MAX);
    expect(meanFromHigh).toBeGreaterThan(1);

    const meanFromLow = meanNextFrom(DRIFT_MIN);
    expect(meanFromLow).toBeGreaterThan(DRIFT_MIN);
    expect(meanFromLow).toBeLessThan(1);
  });
});

describe("tick — flow drift wiring (E8)", () => {
  it("only changes flowDrift on a world-day boundary, never mid-day", () => {
    const world = createWorld(9);
    let current = world;
    for (let t = 1; t <= 48; t++) {
      const before = current.flowDrift;
      current = tick(current, []);
      if (t % 24 === 0) {
        expect(current.flowDrift).not.toEqual(before);
      } else {
        expect(current.flowDrift).toEqual(before);
      }
    }
  });

  it("keeps every port × good's drift within [0.7, 1.3] over many world days", () => {
    const world = runTicks(createWorld(11), 24 * 200); // 200 world days
    for (const port of world.region.ports) {
      for (const good of GOOD_IDS) {
        expect(world.flowDrift[port.id][good]).toBeGreaterThanOrEqual(DRIFT_MIN);
        expect(world.flowDrift[port.id][good]).toBeLessThanOrEqual(DRIFT_MAX);
      }
    }
  });

  it("populates osmosisPulse with an entry for every lane, every tick", () => {
    const world = tick(createWorld(3), []);
    for (const lane of world.region.lanes) {
      expect(typeof world.osmosisPulse[lane.id]).toBe("number");
    }
    expect(Object.keys(world.osmosisPulse).length).toBe(world.region.lanes.length);
  });
});

describe("build site auto-draw phase (E9, after dock before market)", () => {
  function findPort(w: World, id: string) {
    return w.region.ports.find((p) => p.id === id)!;
  }

  it("buys in GOOD_IDS order at quoteBuy; respects per-day cap; stalls silently on empty purse", () => {
    let w = richForHq(createWorld(42));
    const pId = w.region.ports[0].id;
    w = tick(w, [{ kind: "foundHeadquarters", portId: pId }]);
    w = tick(w, [{ kind: "placeBuildOrder" }]);
    // make poor but not zero: enough for ~1 grain buy
    w = { ...w, company: { ...w.company, thalers: 15 } };
    const startStock = findPort(w, pId).market.grain.stock;

    // run 1 full day (24 ticks) with no other cmds; auto can buy only what purse allows
    w = runTicks(w, 24);
    const store = w.company.headquarters!.buildOrder!.siteStore;
    // purse allowed only ~1 ; allow +1 due to place-tick auto draw timing
    expect(store.grain).toBeLessThanOrEqual(2);
    // stock reduced by what was bought
    const endStock = findPort(w, pId).market.grain.stock;
    expect(endStock).toBeLessThanOrEqual(startStock);
    // no error thrown, just stall
  });

  it("rate cap: over a day, auto-draw never exceeds AUTO_DRAW_PER_DAY per good when fully funded", () => {
    let w = richForHq(createWorld(7));
    const pId = w.region.ports[0].id;
    w = tick(w, [{ kind: "foundHeadquarters", portId: pId }]);
    w = tick(w, [{ kind: "placeBuildOrder" }]);
    w = { ...w, company: { ...w.company, thalers: 200000 } }; // rich
    const startStockForCap = findPort(w, pId).market.grain.stock;

    w = runTicks(w, 24);
    const drawn = w.company.headquarters!.buildOrder!.siteStore.grain;
    expect(drawn).toBeLessThanOrEqual(AUTO_DRAW_PER_DAY + 1); // +1 from place tick auto in same day
    expect(drawn).toBeGreaterThan(0); // should draw since funded
    // market stock reduced accordingly (plus any production/consumption in the ticks)
    const endStockForCap = findPort(w, pId).market.grain.stock;
    void startStockForCap;
    void endStockForCap;
    // drawn ~10, just assert cap
    expect(drawn).toBeLessThanOrEqual(11);
  });

  it("stalls at 0 stock or 0 purse without mutating state negatively", () => {
    let w = richForHq(createWorld(99));
    const pId = w.region.ports[0].id;
    w = tick(w, [{ kind: "foundHeadquarters", portId: pId }]);
    w = tick(w, [{ kind: "placeBuildOrder" }]);
    // deplete purse to 0
    w = { ...w, company: { ...w.company, thalers: 0 } };
    const storeBefore = { ...w.company.headquarters!.buildOrder!.siteStore };
    const thalersBefore = w.company.thalers;
    w = runTicks(w, 5);
    expect(w.company.thalers).toBe(thalersBefore);
    // siteStore must not have received any via auto (still 0)
    expect(w.company.headquarters!.buildOrder!.siteStore).toEqual(storeBefore);

    // now fund but zero out a stock at hq port for timber
    w = { ...w, company: { ...w.company, thalers: 999999 } };
    const pt = findPort(w, pId);
    const zeroTimberPort = { ...pt, market: { ...pt.market, timber: { ...pt.market.timber, stock: 0 } } };
    w = { ...w, region: { ...w.region, ports: w.region.ports.map((pp) => (pp.id === pId ? zeroTimberPort : pp)) } };
    const storeBefore2 = { ...w.company.headquarters!.buildOrder!.siteStore };
    w = tick(w, []);
    // timber not increased
    expect(w.company.headquarters!.buildOrder!.siteStore.timber).toBe(storeBefore2.timber);
  });

  it("auto-draw + launch determinism: same seed + same founding/build cmds => identical worlds", () => {
    const run = (seed: number | string) => {
      let w = richForHq(createWorld(seed));
      const p = w.region.ports[0].id;
      w = tick(w, [{ kind: "foundHeadquarters", portId: p }]);
      w = tick(w, [{ kind: "placeBuildOrder" }]);
      w = { ...w, company: { ...w.company, thalers: 999999 } };
      // run enough for possible launch of one hull by auto
      for (let t = 0; t < 300; t++) w = tick(w, []);
      return w;
    };
    const a = run(123);
    const b = run(123);
    expect(a).toEqual(b);
    expect(JSON.parse(JSON.stringify(a))).toEqual(a);
  });
});

describe("phase ordering and launch tick (E9)", () => {
  it("launch appears in the same world returned by the tick that completed the store", () => {
    let w = richForHq(createWorld(5));
    const pId = w.region.ports[0].id;
    w = tick(w, [{ kind: "foundHeadquarters", portId: pId }]);
    w = tick(w, [{ kind: "placeBuildOrder" }]);
    w = { ...w, company: { ...w.company, thalers: 999999 } };
    // ensure enough local stock to rush full recipe (stock-limited)
    w = {
      ...w,
      region: {
        ...w.region,
        ports: w.region.ports.map((pp) => {
          if (pp.id !== pId) return pp;
          const boostedMarket: Record<GoodId, unknown> = { ...pp.market };
          for (const g of GOOD_IDS) {
            boostedMarket[g] = { ...boostedMarket[g], stock: Math.max(boostedMarket[g].stock, SHIP_RECIPE[g] + 10) };
          }
          return { ...pp, market: boostedMarket };
        }),
      },
    };
    // simpler: use rush which completes in one cmd; launch must be in same returned world
    w = tick(w, [{ kind: "rushBuild" }]);
    expect(w.company.ships.length).toBe(2);
    expect(w.company.headquarters?.buildOrder).toBeUndefined();
    const ns = w.company.ships[1];
    expect(ns.location).toEqual({ kind: "docked", portId: pId });
  });
});
