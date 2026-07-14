import { CONSTRUCTION_RESERVE, HEADQUARTERS_COST } from "../sim";

/**
 * The founding savings goal shown by PortPanel's pre-founding progress bar
 * (#157). Must stay the exact gate `foundHeadquarters` checks (commands.ts:
 * cost + Reserve) — a bar to the bare cost would read 100% while the button
 * is still disabled, the display-vs-gate drift the #134 grill forbids.
 */
export const FOUNDING_GOAL = HEADQUARTERS_COST + CONSTRUCTION_RESERVE;

/** Fill fraction [0, 1] of the founding savings bar for a given purse. */
export function foundingProgress(thalers: number): number {
  return Math.min(Math.max(thalers, 0), FOUNDING_GOAL) / FOUNDING_GOAL;
}
