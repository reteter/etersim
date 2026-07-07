import type { PortArchetype } from "./region";

/**
 * Region template (CONTEXT.md): data describing how to generate a region.
 * Worldgen = seed + template. Future regions (mining-heavy frontiers,
 * bigger port counts) are new templates, not new code.
 */
export interface RegionTemplate {
  readonly portCountRange: readonly [min: number, max: number];
  readonly archetypeWeights: Record<PortArchetype, number>;
  /** Fraction of all candidate edges kept in total (never below the
   *  spanning tree), (0, 1] — sparse on purpose so routing matters. */
  readonly laneDensity: number;
  /** Lane duration is purely proportional to euclidean length: `voyageTicks
   *  = round(voyageTicksPerUnit * length)` — no floor, no clamp. */
  readonly voyageTicksPerUnit: number;
  /** Orbit ring radii (distance from the region center (0.5, 0.5) on the
   *  unit plane) are evenly spaced across this range for the generated
   *  port count — one ring per port (docs/specs/E10-orrery-view.md). */
  readonly orbitRadiusRange: readonly [min: number, max: number];
  readonly portNamePool: readonly string[];
}

/** The default v1 region (docs/specs/E2-trade-loop.md — Worldgen). */
export const HEARTLAND: RegionTemplate = {
  // Min 5: with fewer ports than archetypes one good loses its only
  // producer and turns into dead cargo (arbitrage invariant).
  portCountRange: [5, 6],
  archetypeWeights: { agrarian: 1, industrial: 1, urban: 1, mining: 1, verdant: 1 },
  laneDensity: 0.6,
  voyageTicksPerUnit: 130,
  // Fits the unit plane with margin; ring spacing for 6 ports ≈ 0.056, so
  // MIN_PORT_DISTANCE does real work between neighboring rings.
  orbitRadiusRange: [0.18, 0.46],
  portNamePool: [
    "Velharrow",
    "Kruxhaven",
    "Brassmoor",
    "Gildersey",
    "Thornquay",
    "Palegate",
    "Emberdock",
    "Saltmere",
  ],
};
