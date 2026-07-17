import {
  AUTO_DRAW_PER_DAY,
  CONSTRUCTION_RESERVE,
  effectiveBase,
  GOOD_IDS,
  quoteBuy,
  SHIP_RECIPE,
  siteRemainingNeed,
  TICKS_PER_DAY,
  type ConstructionSite,
  type Headquarters,
  type World,
} from "../sim";

/**
 * Auto-draw stalls silently at the sim level (`runBuildSiteAutoDraw`/
 * `runShipyardConstructionAutoDraw`/`runShipyardAutoDraw`, src/sim) — this
 * derives a human reason for the Budowa tab and the E14 Shipyard section
 * (docs/specs/E9/E14 — "stall reason: wstrzymane: rezerwa skarbca / brak
 * towaru"), mirroring the sim's per-good walk without mutating anything.
 * "reserve" means the next purchase would take the purse below
 * CONSTRUCTION_RESERVE (#122 — auto-draw never crosses the floor).
 *
 * `null` also covers the *normal* daily-cap window (today's per-good ticks
 * already spent) — that's "waiting for tomorrow", not a stall, so it must
 * not show a "no funds/goods" message.
 */
export type StallReason = "reserve" | "goods" | null;

/**
 * The generic engine: the stall reason for any ConstructionSite (the HQ
 * Build Order, the Shipyard's own build, or an active Refit — all filled by
 * the same ConstructionSite engine, E14 spec §"#99 first"). `deriveStallReason`
 * specializes it to the Headquarters; the Shipyard section calls it with the
 * shipyard-build or refit site directly.
 */
export function deriveSiteStallReason(world: World, site: ConstructionSite): StallReason {
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

export function deriveStallReason(world: World, headquarters: Headquarters): StallReason {
  if (!headquarters.buildOrder) return null;
  // Delegates to the generic site walk (SHIP_RECIPE is the HQ Build Order's
  // recipe) — one implementation, two callers.
  return deriveSiteStallReason(world, {
    recipe: SHIP_RECIPE,
    siteStore: headquarters.buildOrder.siteStore,
    portId: headquarters.portId,
  });
}
