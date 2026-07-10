import {
  AUTO_DRAW_PER_DAY,
  effectiveBase,
  GOOD_IDS,
  quoteBuy,
  remainingNeed,
  TICKS_PER_DAY,
  type Headquarters,
  type Region,
  type World,
} from "../sim";

/**
 * Auto-draw stalls silently at the sim level (`runBuildSiteAutoDraw`,
 * src/sim/building.ts) — this derives a human reason for the Headquarters
 * panel's Budowa tab (docs/specs/E9 — "stall reason: wstrzymane: brak
 * środków / brak towaru"), mirroring the sim's per-good walk without
 * mutating anything.
 *
 * `null` also covers the *normal* daily-cap window (today's per-good ticks
 * already spent) — that's "waiting for tomorrow", not a stall, so it must
 * not show a "no funds/goods" message.
 */
export type StallReason = "funds" | "goods" | null;

export function deriveStallReason(world: World, hq: Headquarters, region: Region = world.region): StallReason {
  if (!hq.buildOrder) return null;
  const dayTick = world.tick % TICKS_PER_DAY;
  if (dayTick >= AUTO_DRAW_PER_DAY) return null; // today's window is spent, not stalled

  const port = region.ports.find((p) => p.id === hq.portId);
  if (!port) return null;

  let anyBuyable = false;
  let anyUnaffordable = false;
  let anyOutOfStock = false;
  for (const good of GOOD_IDS) {
    const need = remainingNeed(hq.buildOrder.siteStore, good);
    if (need <= 0) continue;
    const entry = port.market[good];
    if (Math.floor(entry.stock) <= 0) {
      anyOutOfStock = true;
      continue;
    }
    const cost = quoteBuy(entry, effectiveBase(port, good), 1);
    if (cost === null || cost > world.company.thalers) {
      anyUnaffordable = true;
      continue;
    }
    anyBuyable = true;
  }

  if (anyBuyable) return null; // at least one good makes progress this tick
  if (anyUnaffordable) return "funds";
  if (anyOutOfStock) return "goods";
  return null; // recipe complete or no goods left to draw
}
