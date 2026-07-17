import {
  AUTO_DRAW_PER_DAY,
  autoDrawCapForDayTick,
  CONSTRUCTION_RESERVE,
  drawConstructionSite,
  effectiveBase,
  GOOD_IDS,
  quoteBuy,
  SHIP_RECIPE,
  siteRemainingNeed,
  TICKS_PER_DAY,
  type ConstructionSite,
  type Headquarters,
  type Port,
  type World,
} from "../sim";

/**
 * Auto-draw stalls silently at the sim level (`runBuildSiteAutoDraw`/
 * `runShipyardConstructionAutoDraw`/`runShipyardAutoDraw`, src/sim) — this
 * derives a human reason for the Headquarters panel's Budowa tab and the E14
 * Shipyard section (docs/specs/E9/E14 — "stall reason: wstrzymane: rezerwa
 * skarbca / brak towaru"), mirroring the sim's per-good walk without
 * mutating anything. "reserve" means the next purchase would take the purse
 * below CONSTRUCTION_RESERVE (#122 — auto-draw never crosses the floor).
 *
 * `null` also covers the *normal* daily-cap window (today's per-good ticks
 * already spent) — that's "waiting for tomorrow", not a stall, so it must
 * not show a "no funds/goods" message.
 */
export type StallReason = "reserve" | "goods" | null;

/** Tests `site`'s remaining-need goods, one unit each, against `port`/
 *  `thalers` — the read side of `drawConstructionSite`'s per-good loop
 *  (building.ts), without mutating anything. Factored out so
 *  `deriveSiteStallReason` can run it once per site against whatever
 *  purse/port snapshot is left after folding in earlier-in-order sites. */
function walkSiteGoods(
  site: Pick<ConstructionSite, "recipe" | "siteStore">,
  port: Port,
  thalers: number,
): StallReason {
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
    if (cost === null || cost > thalers - CONSTRUCTION_RESERVE) {
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

/**
 * The generic engine: the stall reason for any `ConstructionSite` (the HQ
 * Build Order, the Shipyard's own build, or an active Refit — all filled by
 * the same ConstructionSite engine, E14 spec §"#99 first"). `deriveStallReason`
 * below specializes it to the Headquarters; the Shipyard section (PortPanel)
 * calls it with the shipyard-build or refit site directly.
 *
 * `precedingSites` names the sites the tick draws from the *same shared
 * purse* before `site`, this same tick, in `tick.ts`'s fixed order — HQ,
 * Shipyard construction, Refit (src/sim/tick.ts:452-461). Professor review
 * (#292, F3): testing each good's cost against the *current* purse alone is
 * blind to that sequencing — with an HQ build and a Refit concurrently
 * active on a thin purse, the HQ's draw (first in order) can floor the purse
 * before the Refit's own turn, so its readout must fold that draw in rather
 * than read the pre-tick purse directly. Each preceding site's draw is
 * simulated with the real `drawConstructionSite` walk (dry — the World
 * itself is never mutated) so this accounting can never drift from what the
 * tick actually charges.
 */
export function deriveSiteStallReason(
  world: World,
  site: ConstructionSite,
  precedingSites: readonly ConstructionSite[] = [],
): StallReason {
  const dayTick = world.tick % TICKS_PER_DAY;
  if (dayTick >= AUTO_DRAW_PER_DAY) return null; // today's window is spent, not stalled

  let thalers = world.company.thalers;
  let ports = world.region.ports;
  const cap = autoDrawCapForDayTick(dayTick);
  for (const preceding of precedingSites) {
    const idx = ports.findIndex((p) => p.id === preceding.portId);
    if (idx < 0) continue; // defensive — shouldn't happen with a valid World
    const result = drawConstructionSite(preceding, ports[idx], thalers, cap, world.tick);
    thalers = result.thalers;
    ports = ports.map((p, i) => (i === idx ? result.port : p));
  }

  const port = ports.find((p) => p.id === site.portId);
  if (!port) return null;

  return walkSiteGoods(site, port, thalers);
}

/** The HQ Build Order as a `ConstructionSite`, or `null` with no active
 *  build — the "site the tick draws first" (src/sim/tick.ts) a later site's
 *  stall readout must fold in via `precedingSites` (Professor F3, #292). */
export function activeHeadquartersSite(world: World): ConstructionSite | null {
  const hq = world.company.headquarters;
  if (!hq || !hq.buildOrder) return null;
  return { recipe: SHIP_RECIPE, siteStore: hq.buildOrder.siteStore, portId: hq.portId };
}

/** Specializes `deriveSiteStallReason` to the Headquarters Build Order — the
 *  HQ draws first in `tick.ts`'s fixed order, so it has no preceding sites of
 *  its own to fold in. */
export function deriveStallReason(world: World, headquarters: Headquarters): StallReason {
  if (!headquarters.buildOrder) return null;
  return deriveSiteStallReason(world, {
    recipe: SHIP_RECIPE,
    siteStore: headquarters.buildOrder.siteStore,
    portId: headquarters.portId,
  });
}
