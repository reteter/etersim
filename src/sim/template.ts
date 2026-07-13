import type { EconomicArchetype } from "./region";

/**
 * Region template (CONTEXT.md): data describing how to generate a region.
 * Worldgen = seed + template. Future regions (mining-heavy frontiers,
 * bigger port counts) are new templates, not new code.
 */
export interface RegionTemplate {
  readonly portCountRange: readonly [min: number, max: number];
  /** Weighted draw pool for the non-Free-port slots (E12); the Free port is
   *  structurally excluded — worldgen assigns exactly one outright. */
  readonly archetypeWeights: Record<EconomicArchetype, number>;
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

/** The v2 region (E12, docs/specs/E12-region-v2.md — HEARTLAND v2 template).
 *  v1 was docs/specs/E2-trade-loop.md — Worldgen; 5–6 ports, no Free port. */
export const HEARTLAND: RegionTemplate = {
  // 7-9 (E12): one slot is always the Free port, the rest draw from the five
  // economic archetypes — min 7 leaves 6 non-freeport slots, enough for
  // every economic archetype to appear once before any weighted repeat
  // (arbitrage invariant).
  portCountRange: [7, 9],
  archetypeWeights: { agrarian: 1, industrial: 1, urban: 1, mining: 1, verdant: 1 },
  laneDensity: 0.6,
  voyageTicksPerUnit: 130,
  // Recalibrated for 7-9 ports (E12, was #147): widened from v1's
  // [0.18, 0.46] so 9 rings still have breathing room — ring spacing for 9
  // ports is ~0.0425, versus v1's ~0.056 at 6 ports — so MIN_PORT_DISTANCE
  // (worldgen.ts, retuned from 0.25 to 0.2 alongside this range) still packs
  // acceptably. Both values chosen empirically against the placement sample
  // test (worldgen.test.ts): worst case (9 ports), 500 seeds, ~8% need a
  // whole-attempt retry, none come close to the hard retry cap.
  orbitRadiusRange: [0.14, 0.48],
  portNamePool: [
    "Velharrow",
    "Kruxhaven",
    "Brassmoor",
    "Gildersey",
    "Thornquay",
    "Palegate",
    "Emberdock",
    "Saltmere",
    "Ravenshoal",
    "Coppervale",
    "Duskferry",
  ],
};
