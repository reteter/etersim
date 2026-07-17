import {
  AUTO_DRAW_PER_DAY,
  CONSTRUCTION_RESERVE,
  effectiveBase,
  GOOD_IDS,
  quoteBuy,
  siteRemainingNeed,
  TICKS_PER_DAY,
  type ConstructionSite,
  type World,
} from "../sim";

/**
 * `deriveStallReason` (headquartersStall.ts) generalized to any
 * `ConstructionSite` (#99 generic engine) — the Shipyard's own build site and
 * an active Refit site (#276) both need the same "why did auto-draw stall"
 * readout the Budowa tab already shows for the HQ build, without duplicating
 * the per-good walk a third time. `deriveStallReason` itself is left
 * untouched (existing tests pin its Headquarters-specific signature); this
 * is a fresh, parallel helper, not a refactor of it.
 */
export type SiteStallReason = "reserve" | "goods" | null;

export function deriveSiteStallReason(world: World, site: ConstructionSite): SiteStallReason {
  const dayTick = world.tick % TICKS_PER_DAY;
  if (dayTick >= AUTO_DRAW_PER_DAY) return null; // today's window is spent, not stalled

  const port = world.region.ports.find((p) => p.id === site.portId);
  if (!port) return null;

  let anyBuyable = false;
  let anyUnaffordable = false;
  let anyOutOfStock = false;
  for (const good of GOOD_IDS) {
    const need = siteRemainingNeed(site, good);
    if (need <= 0) continue;
    const entry = port.market[good];
    if (Math.floor(entry.stock) <= 0) {
      anyOutOfStock = true;
      continue;
    }
    const cost = quoteBuy(entry, effectiveBase(port, good), 1);
    if (cost === null || cost > world.company.thalers - CONSTRUCTION_RESERVE) {
      anyUnaffordable = true;
      continue;
    }
    anyBuyable = true;
  }

  if (anyBuyable) return null; // at least one good makes progress this tick
  if (anyUnaffordable) return "reserve";
  if (anyOutOfStock) return "goods";
  return null; // recipe complete or no goods left to draw
}
