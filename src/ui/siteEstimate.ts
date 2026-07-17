import { effectiveBase, estimateBuy, GOOD_IDS, type GoodId, type Port } from "../sim";

/**
 * Generic "what would this cost at today's prices" preview (#276), the
 * `computeBuildEstimate` pattern (src/sim/building.ts) generalized to any
 * recipe/labor-fee pair so the Shipyard's own commission and a Refit can
 * reuse it instead of each hand-rolling a copy. Deliberately independent of
 * the purse — an estimate shown *against* the purse, not an affordability
 * quote (#122 grill, same rationale as `computeBuildEstimate`). Lives in
 * `src/ui` (not `src/sim`) because it's pure UI-layer composition over
 * already-exported sim primitives (`estimateBuy`, `effectiveBase`) — no new
 * domain logic, so it stays outside this task's `src/sim` scope wall.
 */

export interface SiteEstimateLine {
  readonly good: GoodId;
  readonly qty: number;
  readonly thalers: number;
}

export interface SiteEstimate {
  readonly lines: readonly SiteEstimateLine[];
  readonly laborFee: number;
  readonly total: number;
}

export function computeSiteEstimate(
  port: Port,
  recipe: Record<GoodId, number>,
  laborFee: number,
): SiteEstimate {
  const lines: SiteEstimateLine[] = [];
  for (const good of GOOD_IDS) {
    const qty = recipe[good];
    if (qty <= 0) continue;
    const thalers = estimateBuy(port.market[good], effectiveBase(port, good), qty)!;
    lines.push({ good, qty, thalers });
  }
  const materials = lines.reduce((sum, line) => sum + line.thalers, 0);
  return { lines, laborFee, total: materials + laborFee };
}
