import { seedRng, type RngState } from "./rng";

/**
 * World: the complete simulation state (CONTEXT.md) — serializable and
 * deterministic given seed and player commands. Skeleton for now; ports,
 * markets and ships arrive with E2.
 */
export interface World {
  /** Current world time in ticks (1 tick = 1 world hour, ADR-0003). */
  readonly tick: number;
  /** RNG state; every random draw in the sim threads through this. */
  readonly rng: RngState;
}

export function createWorld(seed: number): World {
  return {
    tick: 0,
    rng: seedRng(seed),
  };
}
