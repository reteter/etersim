import type { Point } from "./shipPosition";

/**
 * Osmosis skiff placement (#161, CONTEXT.md: Osmosis skiff — replaces the
 * ambient osmosis pulses, #63): small NPC trader ships sailing a Lane in the
 * flow's direction, purely derived from `World.osmosisPulse`. No sim
 * entities, no state of their own — a pure rendering of existing sim data,
 * the same layer the pulses occupied.
 *
 * Sim-time anchoring (issue AC): position is a function of `tick` only,
 * never wall-clock — the caller re-renders once per world tick (via the
 * store's `world` object), so pausing the game (ticks stop advancing) freezes
 * skiffs for free, and a higher game speed (more ticks per real second)
 * scales their apparent speed for free. No CSS animation, unlike the pulses
 * it replaces (whose wall-clock CSS animation was the #72 misreading this
 * glyph is meant to resolve).
 */

/** Lanes at or under this |osmosisPulse| magnitude are quiet: no skiffs (the
 *  map never lies about the economy, pillar 4) — same threshold value the
 *  pulses used (RegionMap.tsx `PULSE_DISPLAY_THRESHOLD` before #161), same
 *  value-weighted units (thalers moved this tick). */
export const SKIFF_DISPLAY_THRESHOLD = 1;

/** Skiff count and travel speed both grow with |magnitude|, one extra skiff
 *  (and a proportionally shorter cycle) per this many units of flow — same
 *  shape as the pulses' intensity scaling, repurposed for skiff count/cycle
 *  instead of dot-count/CSS-duration. */
const INTENSITY_SCALE = 4;
const MAX_COUNT = 4;

/** Ticks for one full lane traversal at low intensity; shrinks toward
 *  CYCLE_TICKS_MIN as intensity grows. Tuning, not contract (mirrors the
 *  pulses' PULSE_DURATION_BASE/MIN, in ticks instead of seconds). */
const CYCLE_TICKS_BASE = 30;
const CYCLE_TICKS_MIN = 8;

export interface SkiffGlyph {
  readonly x: number;
  readonly y: number;
  /** Heading in degrees, `from` -> `to` (0 = +x/east, 90 = +y/south in
   *  viewBox space), for a directional silhouette that visibly "sails". */
  readonly angleDeg: number;
}

function intensityOf(magnitude: number): number {
  return Math.abs(magnitude) / INTENSITY_SCALE;
}

/** How many skiffs an active lane shows, 0 when quiet (at/under the display
 *  threshold). Exported standalone so the display threshold/count contract
 *  is unit-testable without a lane's endpoints. */
export function skiffCount(magnitude: number): number {
  if (Math.abs(magnitude) <= SKIFF_DISPLAY_THRESHOLD) return 0;
  const intensity = intensityOf(magnitude);
  return Math.min(MAX_COUNT, Math.max(1, Math.floor(1 + intensity)));
}

function cycleTicks(magnitude: number): number {
  return Math.max(CYCLE_TICKS_MIN, CYCLE_TICKS_BASE / (1 + intensityOf(magnitude)));
}

/** Fractional position (0..1) of skiff `index` of `count`, evenly spaced by
 *  spawn phase. Reduced motion freezes the fraction at that spawn phase
 *  instead of advancing with `tick` — still visible, no motion (#69 review
 *  precedent, carried over from the pulses this glyph replaces). */
function skiffFrac(
  tick: number,
  index: number,
  count: number,
  cycle: number,
  reducedMotion: boolean,
): number {
  const phase = index / count;
  if (reducedMotion) return phase;
  const raw = tick / cycle + phase;
  return raw - Math.floor(raw);
}

/** Ambient osmosis skiffs for one lane at a given sim `tick`. `from`/`to` are
 *  the lane's projected endpoints, already oriented by the flow's sign (the
 *  caller's job, same convention the pulses used: positive magnitude = lane's
 *  `a` sent goods to `b`, src/sim/osmosis.ts). Returns `[]` for a quiet lane. */
export function skiffGlyphs(
  tick: number,
  magnitude: number,
  from: Point,
  to: Point,
  reducedMotion: boolean,
): SkiffGlyph[] {
  const count = skiffCount(magnitude);
  if (count === 0) return [];
  const cycle = cycleTicks(magnitude);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
  return Array.from({ length: count }, (_, i) => {
    const frac = skiffFrac(tick, i, count, cycle, reducedMotion);
    return { x: from.x + dx * frac, y: from.y + dy * frac, angleDeg };
  });
}
