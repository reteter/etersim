import type { Command } from "./commands";
import { TICKS_PER_DAY } from "./region";
import { tick } from "./tick";
import type { World } from "./world";

/**
 * Scenario runner (#232/#202, docs/specs/E11-proving-grounds.md §Re-review):
 * the shared seam for advancing world time by whole days. Two consumers —
 * the Vitest guardrail suites (which grew ad-hoc `for (…TICKS_PER_DAY…)
 * tick(world, [])` loops) and the E11 Harness, which imports it from the sim
 * barrel like any other consumer (ADR-0002: the sim never imports the
 * harness).
 *
 * It lives here rather than in `harness/` for a mechanical reason, not a
 * stylistic one: `src/sim/**` may not import from outside `src/sim`
 * (ADR-0002, enforced by eslint's `no-restricted-imports` `../*` pattern), so
 * a harness-resident helper could never be consumed by the sim's own suites.
 *
 * Pure and deterministic like everything in `src/sim`: no wall clock, no
 * randomness of its own — every draw still happens inside `tick`.
 */

/**
 * A per-tick decision function: given the world as it stands at the start of
 * a tick, the Commands to submit for that tick. Deliberately *not* the E11
 * `Policy` type — Policy (with its `name`/`memory`/`diagnostic`) lives in
 * `harness/`, per CONTEXT.md (Harness: "policies and runner live outside the
 * sim module"); a policy runner threads its own memory and hands this seam a
 * plain closure.
 */
export type TickDecider = (world: World) => readonly Command[];

/**
 * Advances `world` by exactly `days × TICKS_PER_DAY` ticks, polling `decide`
 * once per tick (no decider ⇒ no commands, the world running on its own).
 *
 * `days` must be a non-negative integer; a fractional or negative count is a
 * caller bug, not something to round away. `advanceDays(world, 0)` returns
 * the input world unchanged.
 */
export function advanceDays(world: World, days: number, decide?: TickDecider): World {
  if (!Number.isInteger(days) || days < 0) {
    throw new RangeError(`advanceDays: days must be a non-negative integer, got ${days}`);
  }
  let current = world;
  const ticks = days * TICKS_PER_DAY;
  for (let t = 0; t < ticks; t++) {
    current = tick(current, decide ? decide(current) : []);
  }
  return current;
}
