/**
 * Pure simulation module (ADR-0002). No React/DOM imports, no wall-clock
 * time, no non-deterministic randomness — ever. Enforced by ESLint
 * (see eslint.config.js override for `src/sim/**`).
 *
 * Public API of the sim; the UI imports from here only.
 */

export { createWorld, type World } from "./world";
export { tick, type Command } from "./tick";
export { elapsedToTicks, MS_PER_TICK_AT_1X, SPEEDS, type Speed } from "./speed";
export { nextFloat, nextInt, nextUint32, seedRng, type RngState } from "./rng";
