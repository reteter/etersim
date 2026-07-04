import { TICKS_PER_DAY } from "../sim";

/**
 * Formats world time for the top bar (docs/specs/E2-trade-loop.md — UI
 * layout: "Day 12, 07:00"). Day 1 starts at tick 0; hour is tick mod
 * TICKS_PER_DAY (24 ticks = 1 world day, ADR-0003).
 */
export function formatWorldDate(tick: number): string {
  const day = Math.floor(tick / TICKS_PER_DAY) + 1;
  const hour = tick % TICKS_PER_DAY;
  return `Day ${day}, ${String(hour).padStart(2, "0")}:00`;
}
