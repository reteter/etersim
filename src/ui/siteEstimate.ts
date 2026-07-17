import {
  effectiveBase,
  estimateBuy,
  GOOD_IDS,
  type BuildEstimate,
  type GoodId,
  type Port,
} from "../sim";

/**
 * The UI's cost preview for a prospective construction whose sim seam has no
 * `compute*Estimate` of its own — the E14 Shipyard commission and Refit
 * (docs/specs/E14 — "commission the building … see target Hold + estimate").
 *
 * A byte-for-byte mirror of `computeBuildEstimate` (src/sim/building.ts): per
 * good, `estimateBuy(entry, effectiveBase(port, good), qty)` — the same
 * ceiling-past-stock walk the sim charges auto-draw/rush with (never
 * `quoteBuy`, which returns null past stock) — plus a flat labor fee.
 * Deliberately independent of the purse (an estimate shown *against* it, not
 * an affordability quote, #122). Lives in the UI because #276's scope wall
 * forbids new sim logic; a sim-side `computeShipyardEstimate`/
 * `computeRefitEstimate` would make it drift-proof (flagged for the
 * sim-cleanup issue).
 */
export function computeSiteEstimate(
  port: Port,
  recipe: Record<GoodId, number>,
  laborFee: number,
): BuildEstimate {
  const lines: BuildEstimate["lines"] = GOOD_IDS.flatMap((good) => {
    const qty = recipe[good] ?? 0;
    if (qty <= 0) return [];
    const thalers = estimateBuy(port.market[good], effectiveBase(port, good), qty)!;
    return [{ good, qty, thalers }];
  });
  const materials = lines.reduce((sum, line) => sum + line.thalers, 0);
  return { lines, laborFee, total: materials + laborFee };
}
