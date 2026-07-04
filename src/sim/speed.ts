/**
 * Speed control hooks for the UI (ADR-0003): pause / 1x / 10x / 100x.
 * Pure time arithmetic only — the actual scheduler (rAF/interval) lives in
 * the UI layer, which feeds elapsed wall-clock time in from outside.
 */

export const SPEEDS = ["paused", 1, 10, 100] as const;

export type Speed = (typeof SPEEDS)[number];

/** Real milliseconds per tick at 1x speed: 1 tick (world hour) per second. */
export const MS_PER_TICK_AT_1X = 1000;

/** Cap per call so a backgrounded tab (or long GC pause) can't demand a
 *  huge burst of ticks in one frame; the excess time is discarded. */
export const MAX_TICKS_PER_CALL = 1000;

/**
 * Converts elapsed real time into whole ticks to run, carrying the
 * sub-tick remainder to the next call. Pausing drops the carry so
 * unpausing never dumps a backlog of ticks.
 */
export function elapsedToTicks(
  speed: Speed,
  elapsedMs: number,
  carryMs: number,
): { ticks: number; carryMs: number } {
  if (speed === "paused") {
    return { ticks: 0, carryMs: 0 };
  }
  const budgetMs = carryMs + elapsedMs * speed;
  const ticks = Math.floor(budgetMs / MS_PER_TICK_AT_1X);
  if (ticks > MAX_TICKS_PER_CALL) {
    return { ticks: MAX_TICKS_PER_CALL, carryMs: 0 };
  }
  return { ticks, carryMs: budgetMs % MS_PER_TICK_AT_1X };
}
