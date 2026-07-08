import { GOOD_IDS, type GoodId } from "./goods";
import {
  ARCHETYPE_BIAS,
  ARCHETYPE_PROFILES,
  PORT_ARCHETYPES,
  type Lane,
  type MarketGood,
  type Port,
  type PortArchetype,
  type Region,
} from "./region";
import { nextFloat, nextInt, nextShuffle, type RngState } from "./rng";
import type { RegionTemplate } from "./template";

/** Ports closer than this on the unit plane are rejected during placement. */
export const MIN_PORT_DISTANCE = 0.25;

/**
 * Procedural region generation (docs/specs/E2-trade-loop.md — Worldgen).
 * Deterministic: same RNG state + template ⇒ deep-equal region. All
 * iteration is over arrays in generation order, never object keys.
 */
export function generateRegion(rng: RngState, template: RegionTemplate): [Region, RngState] {
  const [portCount, s1] = nextInt(rng, template.portCountRange[0], template.portCountRange[1]);
  const [archetypes, s2] = drawArchetypes(s1, portCount, template);
  const [names, s3] = nextShuffle(s2, template.portNamePool);
  const [positions, s4] = placePorts(s3, portCount, template.orbitRadiusRange);

  let state = s4;
  const ports: Port[] = [];
  for (let i = 0; i < portCount; i++) {
    let market: Record<GoodId, MarketGood>;
    [market, state] = seedMarket(state, archetypes[i]);
    let priceBias: Record<GoodId, number>;
    [priceBias, state] = drawPriceBias(state, archetypes[i]);
    ports.push({
      id: `p${i}`,
      name: names[i],
      archetype: archetypes[i],
      x: positions[i].x,
      y: positions[i].y,
      market,
      priceBias,
    });
  }

  const [lanes, s5] = connectPorts(state, ports, template);
  return [{ ports, lanes }, s5];
}

/** Every archetype appears once before any weighted repeat (arbitrage
 *  invariant: producers of all goods exist wherever port count allows). */
function drawArchetypes(
  rng: RngState,
  portCount: number,
  template: RegionTemplate,
): [PortArchetype[], RngState] {
  let [archetypes, state] = nextShuffle(rng, PORT_ARCHETYPES);
  archetypes = archetypes.slice(0, portCount);
  while (archetypes.length < portCount) {
    let extra: PortArchetype;
    [extra, state] = drawWeighted(state, template.archetypeWeights);
    archetypes.push(extra);
  }
  return [archetypes, state];
}

function drawWeighted(
  rng: RngState,
  weights: Record<PortArchetype, number>,
): [PortArchetype, RngState] {
  const total = PORT_ARCHETYPES.reduce((sum, a) => sum + weights[a], 0);
  const [fraction, state] = nextFloat(rng);
  let remaining = fraction * total;
  for (const archetype of PORT_ARCHETYPES) {
    remaining -= weights[archetype];
    if (remaining < 0) return [archetype, state];
  }
  return [PORT_ARCHETYPES[PORT_ARCHETYPES.length - 1], state];
}

/** Evenly spaced ring radii across [min, max], inclusive endpoints — one
 *  ring per port, no RNG draw (docs/specs/E10-orrery-view.md). */
function ringRadii(portCount: number, range: readonly [number, number]): number[] {
  const [min, max] = range;
  if (portCount === 1) return [min];
  return Array.from({ length: portCount }, (_, i) => min + (i * (max - min)) / (portCount - 1));
}

/** Ring assignment + per-port angle draws for one placement attempt.
 *  Returns `undefined` (with the advanced RNG state) if a ring runs out of
 *  attempts — sequential angle placement has no backtracking, so an early
 *  ring can occasionally corner a later one; the caller retries the whole
 *  attempt with fresh draws. */
function tryPlacePorts(
  rng: RngState,
  portCount: number,
  orbitRadiusRange: readonly [number, number],
): [Array<{ x: number; y: number }> | undefined, RngState] {
  const [ringOrder, s1] = nextShuffle(rng, ringRadii(portCount, orbitRadiusRange));

  let state = s1;
  const placed: Array<{ x: number; y: number }> = [];
  for (const radius of ringOrder) {
    let placedOnRing = false;
    for (let attempts = 0; attempts < 1000; attempts++) {
      let angle: number;
      [angle, state] = nextFloat(state);
      angle *= 2 * Math.PI;
      const x = 0.5 + radius * Math.cos(angle);
      const y = 0.5 + radius * Math.sin(angle);
      const tooClose = placed.some((p) => Math.hypot(p.x - x, p.y - y) < MIN_PORT_DISTANCE);
      if (!tooClose) {
        placed.push({ x, y });
        placedOnRing = true;
        break;
      }
    }
    if (!placedOnRing) return [undefined, state];
  }
  return [placed, state];
}

/** Orbital placement: center (0.5, 0.5); one port per orbit ring, radii
 *  evenly spaced across `orbitRadiusRange` (deterministic, no RNG draw).
 *  Ring↔port assignment is shuffled via the seeded RNG so radius carries
 *  no meaning about archetype or generation order; each port then draws a
 *  random angle on its ring, rejecting draws that violate
 *  MIN_PORT_DISTANCE against already-placed ports (bounded attempts).
 *  Sequential angle placement has no backtracking, so a whole attempt can
 *  rarely corner itself; retrying the attempt with fresh draws (bounded)
 *  keeps generation a hard stop away from spinning forever. */
function placePorts(
  rng: RngState,
  portCount: number,
  orbitRadiusRange: readonly [number, number],
): [Array<{ x: number; y: number }>, RngState] {
  let state = rng;
  for (let restart = 0; restart < 1000; restart++) {
    let result: Array<{ x: number; y: number }> | undefined;
    [result, state] = tryPlacePorts(state, portCount, orbitRadiusRange);
    if (result) return [result, state];
  }
  // Statistically unreachable for ≤6 ports at distance 0.25; a hard stop
  // keeps a bad template from spinning forever.
  throw new Error(`worldgen: could not place ${portCount} ports`);
}

/** equilibrium = max(100, 10 × daily gross flow); stock = equilibrium ± 25%. */
function seedMarket(
  rng: RngState,
  archetype: PortArchetype,
): [Record<GoodId, MarketGood>, RngState] {
  const profile = ARCHETYPE_PROFILES[archetype];
  let state = rng;
  const market = {} as Record<GoodId, MarketGood>;
  for (const good of GOOD_IDS) {
    const grossPerDay =
      (profile.productionPerDay[good] ?? 0) + (profile.consumptionPerDay[good] ?? 0);
    const equilibrium = Math.max(100, 10 * grossPerDay);
    let jitter: number;
    [jitter, state] = nextFloat(state);
    market[good] = {
      equilibrium,
      stock: Math.round(equilibrium * (0.75 + 0.5 * jitter)),
    };
  }
  return [market, state];
}

/** priceBias = archetype bias × jitter in [0.95, 1.05] — structural price
 *  gradients with per-port texture (docs/specs/E8-living-economy.md). One
 *  draw per good in GOOD_IDS order (determinism). */
function drawPriceBias(
  rng: RngState,
  archetype: PortArchetype,
): [Record<GoodId, number>, RngState] {
  let state = rng;
  const bias = {} as Record<GoodId, number>;
  for (const good of GOOD_IDS) {
    let u: number;
    [u, state] = nextFloat(state);
    bias[good] = ARCHETYPE_BIAS[archetype][good] * (0.95 + 0.1 * u);
  }
  return [bias, state];
}

type Point = { x: number; y: number };

/** Orientation of `b` relative to the ray `o -> a` (cross product sign). */
function cross(o: Point, a: Point, b: Point): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

/** True if segments `p1-p2` and `p3-p4` **properly** cross: they meet at a
 *  single point interior to both segments. Touching at a shared endpoint or
 *  collinear overlap does not count — callers must check for shared
 *  endpoints themselves (two lanes sharing a port never count as a
 *  crossing, regardless of geometry). */
function segmentsProperlyIntersect(p1: Point, p2: Point, p3: Point, p4: Point): boolean {
  const d1 = cross(p3, p4, p1);
  const d2 = cross(p3, p4, p2);
  const d3 = cross(p1, p2, p3);
  const d4 = cross(p1, p2, p4);
  return (d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)
    ? (d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0)
    : false;
}

/** Geometry-aware, deterministic lane topology (docs/specs/E10-orrery-view.md
 *  — Lane topology): Euclidean minimum spanning tree (Kruskal, ties broken
 *  by canonical candidate index) guarantees connectivity without ever
 *  self-crossing, then extra edges are added shortest-first, skipping any
 *  candidate that properly crosses an already-chosen lane, until the
 *  laneDensity target — best effort, since planarity may run out of
 *  non-crossing candidates first. No RNG draws: topology is fully
 *  determined by port positions, which are already seeded. */
function connectPorts(
  rng: RngState,
  ports: readonly Port[],
  template: RegionTemplate,
): [Lane[], RngState] {
  const candidates: Array<[number, number]> = [];
  for (let i = 0; i < ports.length; i++) {
    for (let j = i + 1; j < ports.length; j++) candidates.push([i, j]);
  }
  const lengths = candidates.map(([i, j]) =>
    Math.hypot(ports[i].x - ports[j].x, ports[i].y - ports[j].y),
  );
  // Ascending by length; ties broken by canonical candidate index.
  const order = candidates
    .map((_, c) => c)
    .sort((a, b) => lengths[a] - lengths[b] || a - b);

  // Union-find over port indices (Kruskal MST).
  const parent = ports.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));

  const chosen = new Set<number>(); // indices into `candidates`
  for (const c of order) {
    const [rootA, rootB] = [find(candidates[c][0]), find(candidates[c][1])];
    if (rootA !== rootB) {
      parent[rootA] = rootB;
      chosen.add(c);
    }
  }

  // Extra edges, shortest first, skipping proper crossings against
  // whatever has been chosen so far (MST edges and earlier extra edges).
  const target = Math.max(ports.length - 1, Math.round(template.laneDensity * candidates.length));
  for (const c of order) {
    if (chosen.size >= target) break;
    if (chosen.has(c)) continue;
    const [i, j] = candidates[c];
    let crosses = false;
    for (const cc of chosen) {
      const [ci, cj] = candidates[cc];
      if (ci === i || ci === j || cj === i || cj === j) continue; // shared endpoint: not a crossing
      if (segmentsProperlyIntersect(ports[i], ports[j], ports[ci], ports[cj])) {
        crosses = true;
        break;
      }
    }
    if (!crosses) chosen.add(c);
  }

  // Emit in canonical candidate order so lane ids are stable and readable.
  const lanes: Lane[] = [];
  for (let c = 0; c < candidates.length; c++) {
    if (!chosen.has(c)) continue;
    const [i, j] = candidates[c];
    lanes.push({
      id: `l${lanes.length}`,
      a: ports[i].id,
      b: ports[j].id,
      voyageTicks: Math.round(template.voyageTicksPerUnit * lengths[c]),
    });
  }
  return [lanes, rng];
}
