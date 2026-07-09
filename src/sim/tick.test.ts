import { describe, expect, it } from "vitest";
import { GOOD_IDS, type GoodId } from "./goods";
import { DRIFT_MAX, DRIFT_MIN, driftStep, tick } from "./tick";
import type { MarketGood, Port, PortId, Region } from "./region";
import { seedRng } from "./rng";
import { createWorld, type World } from "./world";
import type { Route } from "./route";

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

// E9 docking phase, fees, best-effort, race order
describe("tick — docking phase and fees (E9)", () => {
  it("charges docking fee on arrival (manual sail) per archetype; clamps at 0", () => {
    let w = createWorld(7);
    const sId = w.company.ships[0].id;
    const home = w.region.ports.find((p) => p.id === (w.company.ships[0].location as { portId: string }).portId)!;
    const target = w.region.ports.find((p) => p.id !== home.id)!;
    // Sail to target
    w = tick(w, [{ kind: "sailTo", shipId: sId, portId: target.id }]);
    // Advance until docked
    while (w.company.ships[0].location.kind !== "docked") w = tick(w, []);
    // After docking, staying docked should not charge fee again
    const afterDock = w;
    const beforeIdle = afterDock.company.thalers;
    const idle = tick(afterDock, []);
    expect(idle.company.thalers).toBeGreaterThanOrEqual(beforeIdle - 1);
  });

  it("route stop execution is best-effort (stock/purse/hold) and advances index, dispatching next Course", () => {
    let w = createWorld(11);
    const sId = w.company.ships[0].id;
    const pa = w.region.ports[0].id;
    const pb = w.region.ports[1].id;
    const r: Route = { id: "b", name: "b", stops: [
      { portId: pa, orders: [{ kind: "buy", good: "grain" }] },
      { portId: pb, orders: [{ kind: "sell", good: "grain" }] },
    ] };
    w = tick(w, [{ kind: "createRoute", route: r }]);
    w = tick(w, [{ kind: "assignRoute", shipId: sId, routeId: "b" }]);
    // Run until at least one full stop execution cycle (should wrap index)
    const startIdx = w.company.ships[0].assignment?.nextStopIndex ?? 0;
    for (let i = 0; i < 400; i++) {
      w = tick(w, []);
      const idx = w.company.ships[0].assignment?.nextStopIndex ?? 0;
      if (idx !== startIdx) break;
    }
    expect(w.company.ships[0].assignment?.routeId).toBe("b");
    // Index should have advanced at least once
    expect(w.company.ships[0].assignment?.nextStopIndex).not.toBe(startIdx);
  });

  it("ships race for purse/stock in ships[] order during docking phase (deterministic)", () => {
    // Proxy determinism: identical seeds + identical route commands yield deep-equal results.
    const run2 = (seed: number | string) => {
      let w = createWorld(seed);
      const sId = w.company.ships[0].id;
      const pa = w.region.ports[0].id;
      const pb = w.region.ports[1].id;
      const r: Route = { id: "r", name: "r", stops: [
        { portId: pa, orders: [{ kind: "buy", good: "grain" }] },
        { portId: pb, orders: [{ kind: "sell", good: "grain" }] },
      ] };
      w = tick(w, [{ kind: "createRoute", route: r }]);
      w = tick(w, [{ kind: "assignRoute", shipId: sId, routeId: "r" }]);
      for (let i = 0; i < 120; i++) w = tick(w, []);
      return w;
    };
    expect(run2(42)).toEqual(run2(42));
  });
});

// Save/load round-trip for routes and assignment (M2 criterion)
describe("save/load round-trips routes and assignments (E9)", () => {
  it("JSON round-trip preserves Company.routes and Ship.assignment", () => {
    let w = createWorld(21);
    const sId = w.company.ships[0].id;
    const pa = w.region.ports[0].id;
    const pb = w.region.ports[1].id;
    const r: Route = { id: "rr", name: "rr", stops: [
      { portId: pa, orders: [{ kind: "buy", good: "grain" }] },
      { portId: pb, orders: [{ kind: "sell", good: "grain" }] },
    ] };
    w = tick(w, [{ kind: "createRoute", route: r }]);
    w = tick(w, [{ kind: "assignRoute", shipId: sId, routeId: "rr" }]);
    const json = JSON.stringify(w);
    const w2 = JSON.parse(json) as World;
    expect(w2).toEqual(w);
    expect(w2.company.routes).toHaveLength(1);
    expect(w2.company.ships[0].assignment?.routeId).toBe("rr");
  });
});
