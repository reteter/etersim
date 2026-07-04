/**
 * Pure simulation module (ADR-0002). No React/DOM imports, no wall-clock
 * time, no non-deterministic randomness — ever. Enforced by ESLint
 * (see eslint.config.js override for `src/sim/**`).
 *
 * This is a placeholder. The real tick engine lands in issue #3.
 */

/** Version of the sim's internal state shape, for future save migrations. */
export const SIM_VERSION = 1;

/** Advances a tick counter by one. A trivial, honest placeholder. */
export function advanceTickCount(current: number): number {
  return current + 1;
}
