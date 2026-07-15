import { TICKS_PER_DAY } from "../sim";

/** World day number for a tick; Day 1 starts at tick 0 (ADR-0003). The single
 *  home for tick→day arithmetic (the top bar and save filenames share it). */
export function worldDay(tick: number): number {
  return Math.floor(tick / TICKS_PER_DAY) + 1;
}

/**
 * Formats world time for the top bar (docs/specs/E2-trade-loop.md — UI
 * layout: "Day 12, 07:00"). Day 1 starts at tick 0; hour is tick mod
 * TICKS_PER_DAY (24 ticks = 1 world day, ADR-0003).
 */
export function formatWorldDate(tick: number): string {
  const hour = tick % TICKS_PER_DAY;
  return `Day ${worldDay(tick)}, ${String(hour).padStart(2, "0")}:00`;
}

/** Path-hostile characters (Windows- and POSIX-reserved) plus whitespace —
 *  anything that could break a downloaded filename or look like a path. */
const FILENAME_HOSTILE = /[/\\:*?"<>|\s]+/g;

/**
 * Strips a free-typed seed down to something safe to embed in a downloaded
 * filename (#221): each run of hostile characters collapses to a single
 * dash, and leading/trailing dashes are trimmed. Can return the empty string
 * if the seed was entirely hostile characters — `exportFilename` treats that
 * the same as no seed.
 */
export function sanitizeSeed(seed: string): string {
  return seed.replace(FILENAME_HOSTILE, "-").replace(/^-+|-+$/g, "");
}

/**
 * The export save filename (#221 — "include the seed name in the exported
 * save filename"). `seed` is the store's `seed` field: the human-readable
 * name the current world was created from, or `null` for a world with no
 * seed name (a JSON import, or a world resumed from autosave — see
 * gameStore.ts). Falls back to the original seedless name whenever there is
 * no seed to show, including when sanitizing empties it out entirely.
 */
export function exportFilename(seed: string | null, tick: number): string {
  const day = worldDay(tick);
  const sanitized = seed === null ? "" : sanitizeSeed(seed);
  return sanitized === "" ? `etersim-day${day}.json` : `etersim-${sanitized}-day${day}.json`;
}
