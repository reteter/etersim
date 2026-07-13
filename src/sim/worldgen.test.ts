import { describe, expect, it } from "vitest";
import { GOOD_IDS } from "./goods";
import { ARCHETYPE_BIAS } from "./region";
import type { PortId, Region } from "./region";
import { seedRng } from "./rng";
import { HEARTLAND } from "./template";
import { generateRegion, MIN_PORT_DISTANCE, placePorts } from "./worldgen";

const genAt = (seed: number): Region => generateRegion(seedRng(seed), HEARTLAND)[0];

/** Regions across a spread of seeds — most assertions must hold for all. */
const SEEDS = Array.from({ length: 50 }, (_, i) => i * 37 + 1);

/** Standalone proper-segment-intersection detector (independent copy from
 *  the implementation under test, so the planarity sweep below doesn't just
 *  check the code against itself — see the positive/negative controls). */
type Pt = { x: number; y: number };
const cross = (o: Pt, a: Pt, b: Pt) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
const properlyIntersect = (p1: Pt, p2: Pt, p3: Pt, p4: Pt) => {
  const d1 = cross(p3, p4, p1);
  const d2 = cross(p3, p4, p2);
  const d3 = cross(p1, p2, p3);
  const d4 = cross(p1, p2, p4);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
};

describe("worldgen", () => {
  it("is deterministic: same seed + template => deep-equal region and RNG state", () => {
    expect(generateRegion(seedRng(42), HEARTLAND)).toEqual(generateRegion(seedRng(42), HEARTLAND));
  });

  it("is deterministic on the whole-attempt-retry path", () => {
    // A deliberately tight orbit range (not HEARTLAND's tuned one) forces
    // placePorts to exhaust a ring's attempts and retry the whole placement
    // at least once, regardless of how HEARTLAND's own constants happen to
    // be tuned — pins that the retry path itself is deterministic without
    // depending on a "magic" seed that only retries under today's tuning.
    const tightRange: readonly [number, number] = [0.3, 0.32];
    const portCount = 9;
    const seed = 4;
    const run = () => placePorts(seedRng(seed), portCount, tightRange);
    const [positions1, retries1, state1] = run();
    const [positions2, retries2, state2] = run();
    expect(retries1).toBeGreaterThan(0); // actually exercises the retry path
    expect(positions1).toEqual(positions2);
    expect(retries1).toBe(retries2);
    expect(state1).toBe(state2);
  });

  it("never throws while placing ports, across thousands of seeds", () => {
    // Regression guard: sequential per-ring angle placement has no
    // backtracking, so an early ring can corner a later one. Without a
    // retry-the-whole-attempt fallback this threw for ~1.3% of seeds.
    for (let seed = 0; seed < 2000; seed++) {
      expect(() => generateRegion(seedRng(seed), HEARTLAND)).not.toThrow();
    }
  });

  it("keeps the placement retry rate under a stated bound at every port count, across 500 seeds each (E12 sample test)", () => {
    // Empirical measurement against HEARTLAND's recalibrated constants
    // (worldgen.ts MIN_PORT_DISTANCE = 0.2, orbitRadiusRange = [0.14, 0.48]):
    // over 2000 seeds per port count, the observed worst case (9 ports) was
    // an 8.85% whole-attempt retry rate with at most 3 retries before
    // success. The bounds below give comfortable margin above that
    // measurement while still being a real, falsifiable claim — the old v1
    // MIN_PORT_DISTANCE (0.25) blows both bounds at 9 ports (~97% retry
    // rate, up to 340 retries out of the 1000 hard cap).
    const N = 500;
    const RETRY_RATE_BOUND = 0.15;
    const MAX_RETRIES_BOUND = 50; // hard cap is 1000; this is nowhere close
    const [minPorts, maxPorts] = HEARTLAND.portCountRange;
    for (let portCount = minPorts; portCount <= maxPorts; portCount++) {
      let needingRetry = 0;
      for (let seed = 0; seed < N; seed++) {
        const [, retries] = placePorts(seedRng(seed), portCount, HEARTLAND.orbitRadiusRange);
        expect(retries, `portCount=${portCount} seed=${seed}`).toBeLessThan(MAX_RETRIES_BOUND);
        if (retries > 0) needingRetry++;
      }
      const retryRate = needingRetry / N;
      expect(retryRate, `portCount=${portCount}`).toBeLessThan(RETRY_RATE_BOUND);
    }
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

  it("covers all five economic archetypes plus exactly one freeport in every region (E12 invariants)", () => {
    for (const seed of SEEDS) {
      const region = genAt(seed);
      const distinct = new Set(region.ports.map((p) => p.archetype));
      expect(distinct.size).toBe(6); // 5 economic archetypes + freeport
      const freeports = region.ports.filter((p) => p.archetype === "freeport");
      expect(freeports).toHaveLength(1);
    }
  });

  it("gives the freeport an exact 1.0 price bias for every good, never a jitter (E12)", () => {
    for (const seed of SEEDS) {
      const region = genAt(seed);
      const freeport = region.ports.find((p) => p.archetype === "freeport")!;
      for (const good of GOOD_IDS) {
        expect(freeport.priceBias[good], `${freeport.id}/${good}`).toBe(1);
      }
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

  it("maps lane duration purely proportionally to length: voyageTicks = round(voyageTicksPerUnit * length)", () => {
    for (const seed of SEEDS) {
      const region = genAt(seed);
      const byId = new Map(region.ports.map((p) => [p.id, p]));
      for (const lane of region.lanes) {
        const a = byId.get(lane.a)!;
        const b = byId.get(lane.b)!;
        const length = Math.hypot(a.x - b.x, a.y - b.y);
        expect(lane.voyageTicks).toBe(Math.round(HEARTLAND.voyageTicksPerUnit * length));
        expect(Number.isInteger(lane.voyageTicks)).toBe(true);
      }
    }
  });

  it("planarity detector: positive/negative controls (so the seed sweep below isn't circular)", () => {
    // A known crossing: diagonals of the unit square.
    expect(properlyIntersect({ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }, { x: 1, y: 0 })).toBe(
      true,
    );
    // Clean non-crossing (parallel, disjoint) segments.
    expect(
      properlyIntersect({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }),
    ).toBe(false);
    // Touching only at a shared endpoint is not a proper crossing.
    expect(
      properlyIntersect({ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 0 }),
    ).toBe(false);
  });

  it("keeps the lane network planar: no two lanes properly cross, across many seeds", () => {
    // "Properly cross" = interior intersection; lanes sharing a port are
    // never a crossing regardless of geometry.
    for (let seed = 0; seed < 500; seed++) {
      const region = genAt(seed);
      const byId = new Map(region.ports.map((p) => [p.id, p]));
      const lanes = region.lanes;
      for (let i = 0; i < lanes.length; i++) {
        for (let j = i + 1; j < lanes.length; j++) {
          const l1 = lanes[i];
          const l2 = lanes[j];
          if (l1.a === l2.a || l1.a === l2.b || l1.b === l2.a || l1.b === l2.b) continue;
          const crosses = properlyIntersect(
            byId.get(l1.a)!,
            byId.get(l1.b)!,
            byId.get(l2.a)!,
            byId.get(l2.b)!,
          );
          expect(crosses).toBe(false);
        }
      }
    }
  });

  it("keeps ports on the unit plane with breathing room", () => {
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
          expect(d).toBeGreaterThanOrEqual(MIN_PORT_DISTANCE);
        }
      }
    }
  });

  it("places exactly one port per orbit ring: radii evenly spaced across orbitRadiusRange", () => {
    const [minR, maxR] = HEARTLAND.orbitRadiusRange;
    for (const seed of SEEDS) {
      const { ports } = genAt(seed);
      const n = ports.length;
      const expectedRadii = Array.from(
        { length: n },
        (_, i) => minR + (i * (maxR - minR)) / (n - 1),
      );
      const actualRadii = ports
        .map((p) => Math.hypot(p.x - 0.5, p.y - 0.5))
        .sort((a, b) => a - b);
      for (let i = 0; i < n; i++) {
        expect(actualRadii[i]).toBeCloseTo(expectedRadii[i], 6);
      }
    }
  });

  it("shuffles ring assignment so radius does not correlate with generation order", () => {
    // Track which ring rank (0 = smallest radius) the first-generated port
    // lands on across seeds; a fixed order would always give the same rank.
    const firstPortRanks = new Set<number>();
    for (const seed of SEEDS) {
      const { ports } = genAt(seed);
      const distances = ports.map((p) => Math.hypot(p.x - 0.5, p.y - 0.5));
      const sorted = [...distances].sort((a, b) => a - b);
      firstPortRanks.add(sorted.indexOf(distances[0]));
    }
    expect(firstPortRanks.size).toBeGreaterThan(1);
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

  it("draws priceBias = archetype bias × per-good jitter within [0.95, 1.05] (E8)", () => {
    for (const seed of SEEDS.slice(0, 10)) {
      const region = genAt(seed);
      for (const port of region.ports) {
        for (const good of GOOD_IDS) {
          const jitter = port.priceBias[good] / ARCHETYPE_BIAS[port.archetype][good];
          expect(jitter, `${port.id}/${good}`).toBeGreaterThanOrEqual(0.95);
          expect(jitter, `${port.id}/${good}`).toBeLessThanOrEqual(1.05);
        }
      }
    }
  });

  it("jitters priceBias per port — same-archetype ports never quote twin curves", () => {
    const jitters = new Set<number>();
    for (const seed of SEEDS.slice(0, 5)) {
      const region = genAt(seed);
      for (const port of region.ports) {
        jitters.add(port.priceBias.grain / ARCHETYPE_BIAS[port.archetype].grain);
      }
    }
    expect(jitters.size).toBeGreaterThan(1);
  });
});
