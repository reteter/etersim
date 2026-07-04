import { GOOD_IDS, type GoodId } from "./goods";
import {
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
const MIN_PORT_DISTANCE = 0.25;
/** Longest possible lane on the unit plane; anchors the duration mapping. */
const MAX_LANE_LENGTH = Math.SQRT2;

/**
 * Procedural region generation (docs/specs/E2-trade-loop.md — Worldgen).
 * Deterministic: same RNG state + template ⇒ deep-equal region. All
 * iteration is over arrays in generation order, never object keys.
 */
export function generateRegion(rng: RngState, template: RegionTemplate): [Region, RngState] {
  const [portCount, s1] = nextInt(rng, template.portCountRange[0], template.portCountRange[1]);
  const [archetypes, s2] = drawArchetypes(s1, portCount, template);
  const [names, s3] = nextShuffle(s2, template.portNamePool);
  const [positions, s4] = placePorts(s3, portCount);

  let state = s4;
  const ports: Port[] = [];
  for (let i = 0; i < portCount; i++) {
    let market: Record<GoodId, MarketGood>;
    [market, state] = seedMarket(state, archetypes[i]);
    ports.push({
      id: `p${i}`,
      name: names[i],
      archetype: archetypes[i],
      x: positions[i].x,
      y: positions[i].y,
      market,
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

/** Rejection sampling on the unit plane with a minimum pairwise distance. */
function placePorts(rng: RngState, portCount: number): [Array<{ x: number; y: number }>, RngState] {
  let state = rng;
  const placed: Array<{ x: number; y: number }> = [];
  let attempts = 0;
  while (placed.length < portCount) {
    if (++attempts > 1000) {
      // Statistically unreachable for ≤6 ports at distance 0.25; a hard
      // stop keeps a bad template from spinning forever.
      throw new Error(`worldgen: could not place ${portCount} ports`);
    }
    let x: number, y: number;
    [x, state] = nextFloat(state);
    [y, state] = nextFloat(state);
    const tooClose = placed.some((p) => Math.hypot(p.x - x, p.y - y) < MIN_PORT_DISTANCE);
    if (!tooClose) placed.push({ x, y });
  }
  return [placed, state];
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

/** Random spanning tree (Kruskal over shuffled candidates), then random
 *  extra edges until laneDensity of all candidate edges is kept. */
function connectPorts(
  rng: RngState,
  ports: readonly Port[],
  template: RegionTemplate,
): [Lane[], RngState] {
  const candidates: Array<[number, number]> = [];
  for (let i = 0; i < ports.length; i++) {
    for (let j = i + 1; j < ports.length; j++) candidates.push([i, j]);
  }
  const [shuffled, state] = nextShuffle(rng, candidates);

  // Union-find over port indices.
  const parent = ports.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));

  const chosen = new Set<number>(); // indices into `candidates`
  for (const edge of shuffled) {
    const [rootA, rootB] = [find(edge[0]), find(edge[1])];
    if (rootA !== rootB) {
      parent[rootA] = rootB;
      chosen.add(candidates.indexOf(edge));
    }
  }
  const target = Math.max(ports.length - 1, Math.round(template.laneDensity * candidates.length));
  for (const edge of shuffled) {
    if (chosen.size >= target) break;
    chosen.add(candidates.indexOf(edge));
  }

  // Emit in canonical candidate order so lane ids are stable and readable.
  const lanes: Lane[] = [];
  const [minTicks, maxTicks] = template.voyageTicksRange;
  for (let c = 0; c < candidates.length; c++) {
    if (!chosen.has(c)) continue;
    const [i, j] = candidates[c];
    const length = Math.hypot(ports[i].x - ports[j].x, ports[i].y - ports[j].y);
    const t = Math.min(
      1,
      Math.max(0, (length - MIN_PORT_DISTANCE) / (MAX_LANE_LENGTH - MIN_PORT_DISTANCE)),
    );
    lanes.push({
      id: `l${lanes.length}`,
      a: ports[i].id,
      b: ports[j].id,
      voyageTicks: Math.round(minTicks + t * (maxTicks - minTicks)),
    });
  }
  return [lanes, state];
}
