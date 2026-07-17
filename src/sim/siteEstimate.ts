import type { BuildEstimate, BuildEstimateLine } from "./building";
import { GOOD_IDS, type GoodId } from "./goods";
import { effectiveBase, estimateBuy } from "./market";
import type { Port } from "./region";
import { refitRecipe, REFIT_LABOR_FEE, SHIPYARD_LABOR_FEE, SHIPYARD_RECIPE } from "./shipyard";
import type { Ship } from "./ship";

/**
 * The `computeBuildEstimate` (building.ts) pattern — "what would this cost at
 * today's prices" (#122 grill: deliberately independent of the purse, an
 * estimate shown *against* the purse, not an affordability quote) —
 * generalized to the Shipyard's own commission and a Refit (#276/#292). Was
 * hand-mirrored in `src/ui/siteEstimate.ts` (a deliberate drift surface,
 * Professor review #292): a UI-layer copy of a domain computation could
 * silently diverge from `computeBuildEstimate` as either evolved. Moved into
 * `src/sim` so both the Headquarters, the Shipyard, and a Refit price their
 * estimate through the exact same primitives (`estimateBuy`, `effectiveBase`)
 * — one seam, three callers.
 */
function computeEstimate(port: Port, recipe: Record<GoodId, number>, laborFee: number): BuildEstimate {
  const lines: BuildEstimateLine[] = [];
  for (const good of GOOD_IDS) {
    const qty = recipe[good];
    if (qty <= 0) continue;
    const thalers = estimateBuy(port.market[good], effectiveBase(port, good), qty)!;
    lines.push({ good, qty, thalers });
  }
  const materials = lines.reduce((sum, line) => sum + line.thalers, 0);
  return { lines, laborFee, total: materials + laborFee };
}

/** Pure preview of what commissioning the Shipyard at `port` would cost at
 *  today's prices: `SHIPYARD_RECIPE` × current asks plus `SHIPYARD_LABOR_FEE`
 *  — the pre-commission estimate shown at every port (docs/specs/E14). */
export function computeShipyardEstimate(port: Port): BuildEstimate {
  return computeEstimate(port, SHIPYARD_RECIPE, SHIPYARD_LABOR_FEE);
}

/** Pure preview of what starting a Refit on `ship` at `port` would cost at
 *  today's prices: `refitRecipe(ship)` × current asks plus `REFIT_LABOR_FEE`
 *  — shown by the Refit picker before `commissionRefit` is dispatched
 *  (docs/specs/E14). */
export function computeRefitEstimate(port: Port, ship: Ship): BuildEstimate {
  return computeEstimate(port, refitRecipe(ship), REFIT_LABOR_FEE);
}
