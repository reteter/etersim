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
  /** Lane euclidean length maps linearly into this tick range. */
  readonly voyageTicksRange: readonly [min: number, max: number];
  readonly portNamePool: readonly string[];
}

/** The default v1 region (docs/specs/E2-trade-loop.md — Worldgen). */
export const HEARTLAND: RegionTemplate = {
  portCountRange: [4, 6],
  archetypeWeights: { agrarian: 1, industrial: 1, urban: 1, mining: 1, verdant: 1 },
  laneDensity: 0.6,
  voyageTicksRange: [48, 120],
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
