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
