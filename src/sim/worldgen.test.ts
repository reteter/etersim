import { describe, expect, it } from "vitest";
import { GOOD_IDS } from "./goods";
import type { PortId, Region } from "./region";
import { seedRng } from "./rng";
import { HEARTLAND } from "./template";
import { generateRegion } from "./worldgen";

const genAt = (seed: number): Region => generateRegion(seedRng(seed), HEARTLAND)[0];

/** Regions across a spread of seeds — most assertions must hold for all. */
const SEEDS = Array.from({ length: 25 }, (_, i) => i * 37 + 1);

describe("worldgen", () => {
  it("is deterministic: same seed + template => deep-equal region and RNG state", () => {
    expect(generateRegion(seedRng(42), HEARTLAND)).toEqual(generateRegion(seedRng(42), HEARTLAND));
  });

  it("advances the RNG state (does not return it untouched)", () => {
    const start = seedRng(42);
    const [, after] = generateRegion(start, HEARTLAND);
    expect(after).not.toBe(start);
  });

  it("draws port count from the template range", () => {
    const counts = new Set<number>();
    for (const seed of SEEDS) {
      const region = genAt(seed);
      const [min, max] = HEARTLAND.portCountRange;
      expect(region.ports.length).toBeGreaterThanOrEqual(min);
      expect(region.ports.length).toBeLessThanOrEqual(max);
      counts.add(region.ports.length);
    }
    expect(counts.size).toBeGreaterThan(1); // the range is actually sampled
  });

  it("covers distinct archetypes before repeating any (arbitrage invariant)", () => {
    for (const seed of SEEDS) {
      const region = genAt(seed);
      const distinct = new Set(region.ports.map((p) => p.archetype));
      expect(distinct.size).toBe(Math.min(5, region.ports.length));
    }
  });

  it("gives ports unique names from the template pool and unique ids", () => {
    for (const seed of SEEDS) {
      const region = genAt(seed);
      const names = region.ports.map((p) => p.name);
      expect(new Set(names).size).toBe(names.length);
      for (const name of names) expect(HEARTLAND.portNamePool).toContain(name);
      expect(new Set(region.ports.map((p) => p.id)).size).toBe(region.ports.length);
    }
  });

  it("keeps the lane graph connected", () => {
    for (const seed of SEEDS) {
      const region = genAt(seed);
      const reached = new Set<PortId>([region.ports[0].id]);
      let grew = true;
      while (grew) {
        grew = false;
        for (const lane of region.lanes) {
          if (reached.has(lane.a) !== reached.has(lane.b)) {
            reached.add(lane.a);
            reached.add(lane.b);
            grew = true;
          }
        }
      }
      expect(reached.size).toBe(region.ports.length);
    }
  });

  it("builds a sparse simple graph: no self-lanes, no duplicates, not complete", () => {
    let sawIncomplete = false;
    for (const seed of SEEDS) {
      const region = genAt(seed);
      const keys = region.lanes.map((l) => [l.a, l.b].sort().join("|"));
      expect(new Set(keys).size).toBe(keys.length);
      for (const lane of region.lanes) expect(lane.a).not.toBe(lane.b);
      const n = region.ports.length;
      expect(region.lanes.length).toBeGreaterThanOrEqual(n - 1);
      if (region.lanes.length < (n * (n - 1)) / 2) sawIncomplete = true;
    }
    expect(sawIncomplete).toBe(true); // routing must matter at least somewhere
  });

  it("maps lane durations into the template voyage range", () => {
    for (const seed of SEEDS) {
      for (const lane of genAt(seed).lanes) {
        const [min, max] = HEARTLAND.voyageTicksRange;
        expect(lane.voyageTicks).toBeGreaterThanOrEqual(min);
        expect(lane.voyageTicks).toBeLessThanOrEqual(max);
        expect(Number.isInteger(lane.voyageTicks)).toBe(true);
      }
    }
  });

  it("spreads ports on the unit plane with breathing room", () => {
    for (const seed of SEEDS) {
      const { ports } = genAt(seed);
      for (const port of ports) {
        expect(port.x).toBeGreaterThanOrEqual(0);
        expect(port.x).toBeLessThanOrEqual(1);
        expect(port.y).toBeGreaterThanOrEqual(0);
        expect(port.y).toBeLessThanOrEqual(1);
      }
      for (let i = 0; i < ports.length; i++) {
        for (let j = i + 1; j < ports.length; j++) {
          const d = Math.hypot(ports[i].x - ports[j].x, ports[i].y - ports[j].y);
          expect(d).toBeGreaterThanOrEqual(0.2);
        }
      }
    }
  });

  it("sets equilibrium = max(100, 10 × daily gross flow) and stock within ±25% jitter", () => {
    for (const seed of SEEDS.slice(0, 5)) {
      const region = genAt(seed);
      for (const port of region.ports) {
        for (const good of GOOD_IDS) {
          const { stock, equilibrium } = port.market[good];
          expect(stock).toBeGreaterThanOrEqual(Math.floor(equilibrium * 0.75));
          expect(stock).toBeLessThanOrEqual(Math.ceil(equilibrium * 1.25));
          expect(Number.isInteger(stock)).toBe(true);
          expect(equilibrium).toBeGreaterThanOrEqual(100);
        }
      }
    }
    // spot-check the formula on a known profile: urban consumes 30 grain/day
    const region = genAt(SEEDS[0]);
    const urban = region.ports.find((p) => p.archetype === "urban");
    expect(urban).toBeDefined();
    expect(urban!.market.grain.equilibrium).toBe(300);
  });
});
