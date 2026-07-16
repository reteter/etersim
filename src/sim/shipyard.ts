import { SHIP_RECIPE } from "./building";
import { GOOD_IDS, type GoodId } from "./goods";
import type { Ship } from "./ship";

/**
 * The Hold ladder (E14 spec — "The Hold ladder"): pure math only. No
 * Shipyard building state, no RefitOrder, no commands, no World mutation —
 * those land with the Shipyard building (#275) and RefitOrder commands
 * (#276). This module only answers "what are the thresholds" and "what does
 * a step cost", given a ship.
 */

/** Cumulative multipliers over `baseHold`, applied in order (tuning ≠ spec
 *  drift — the *shape*, a fixed multiplier ladder with a hard cap, is
 *  spec). */
export const HOLD_LADDER: readonly number[] = [2, 1.5, 1.25];

/** Material cost of a refit step scales `SHIP_RECIPE` by the fraction of a
 *  full hull's worth of Hold gained; 1.0 keeps it a straight proportion
 *  (tuning). */
export const REFIT_MATERIAL_FACTOR = 1.0;

/** Flat per-refit labor fee, charged up front (tuning). */
export const REFIT_LABOR_FEE = 500;

/**
 * The Hold ladder's thresholds for a given `baseHold`, cumulative and each
 * rounded to the nearest integer from the base directly — never iterated
 * from a prior rounded rung (spec: "computed once from baseHold"). For
 * baseHold 50: [100, 150, 188].
 */
export function holdLadder(baseHold: number): number[] {
  let cumulative = 1;
  const thresholds: number[] = [];
  for (const multiplier of HOLD_LADDER) {
    cumulative *= multiplier;
    thresholds.push(Math.round(baseHold * cumulative));
  }
  return thresholds;
}

/**
 * The next Hold threshold strictly above the ship's current `hold`, or
 * `null` once it is at or past the ladder's cap (the hard cap after three
 * refit levels).
 */
export function nextHoldStep(ship: Ship): number | null {
  const ladder = holdLadder(ship.baseHold);
  for (const threshold of ladder) {
    if (threshold > ship.hold) return threshold;
  }
  return null;
}

/**
 * The materials a Refit to the next ladder step costs: `SHIP_RECIPE` scaled
 * by the Hold gained relative to `baseHold`, rounded up per good so the
 * site never under-collects. Only meaningful when `nextHoldStep` is
 * non-null — callers gate on that before invoking this (the Refit command,
 * #276).
 */
export function refitRecipe(ship: Ship): Record<GoodId, number> {
  const target = nextHoldStep(ship);
  const holdGained = (target ?? ship.hold) - ship.hold;
  const recipe = {} as Record<GoodId, number>;
  for (const good of GOOD_IDS) {
    recipe[good] = Math.ceil(
      (SHIP_RECIPE[good] * holdGained * REFIT_MATERIAL_FACTOR) / ship.baseHold,
    );
  }
  return recipe;
}
