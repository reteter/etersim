/**
 * Seeded, pure-functional RNG (ADR-0003). State is a plain uint32 so it
 * serializes with the World for free (ADR-0004). Every draw returns the
 * value together with the next state — nothing here ever mutates.
 *
 * Algorithm: mulberry32 (32-bit, passes gladman's basic randomness tests,
 * plenty for game economy purposes).
 */

export type RngState = number;

const UINT32_RANGE = 2 ** 32;

/** Scrambles the raw seed (splitmix32 finalizer) so consecutive integer
 *  seeds (1, 2, 3…) start from well-separated states. */
export function seedRng(seed: number): RngState {
  let h = seed >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x21f0aaad);
  h = Math.imul(h ^ (h >>> 15), 0x735a2d97);
  return (h ^ (h >>> 15)) >>> 0;
}

/** Draws a uint32 in [0, 2^32). */
export function nextUint32(state: RngState): [number, RngState] {
  const next = (state + 0x6d2b79f5) >>> 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [(t ^ (t >>> 14)) >>> 0, next];
}

/** Draws a float in [0, 1). */
export function nextFloat(state: RngState): [number, RngState] {
  const [value, next] = nextUint32(state);
  return [value / UINT32_RANGE, next];
}

/** Draws an integer in [min, max], both ends inclusive. */
export function nextInt(state: RngState, min: number, max: number): [number, RngState] {
  const [fraction, next] = nextFloat(state);
  return [min + Math.floor(fraction * (max - min + 1)), next];
}
