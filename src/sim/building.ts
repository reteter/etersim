import { GOOD_IDS, type GoodId } from "./goods";
import { effectiveBase, quoteBuy } from "./market";
import type { PortId } from "./region";
import { TICKS_PER_DAY } from "./region";
import { emptyCargo, type Ship } from "./ship";
import type { World } from "./world";

/**
 * Headquarters and Build Order (E9).
 * One HQ per Company at a chosen port; one active BuildOrder at a time.
 * siteStore tracks materials delivered/bought toward SHIP_RECIPE.
 * Sources: auto-draw (rate capped), deliver (free, min(cargo,need)), rush (quoteBuy, stock limited).
 */

export const HEADQUARTERS_COST = 2500;
export const SHIP_RECIPE: Record<GoodId, number> = {
  grain: 100,
  textiles: 30,
  aetherSalt: 20,
  electronics: 5,
  timber: 12,
};
export const LABOR_FEE = 800;
export const AUTO_DRAW_PER_DAY = 10;

export interface BuildOrder {
  readonly siteStore: Record<GoodId, number>;
}

export interface Headquarters {
  readonly portId: PortId;
  readonly buildOrder?: BuildOrder;
}

export function emptySiteStore(): Record<GoodId, number> {
  const store = {} as Record<GoodId, number>;
  for (const good of GOOD_IDS) store[good] = 0;
  return store;
}

export function remainingNeed(siteStore: Record<GoodId, number>, good: GoodId): number {
  return Math.max(0, SHIP_RECIPE[good] - (siteStore[good] ?? 0));
}

export function isRecipeComplete(siteStore: Record<GoodId, number>): boolean {
  for (const good of GOOD_IDS) {
    if ((siteStore[good] ?? 0) < SHIP_RECIPE[good]) return false;
  }
  return true;
}

/** Fixed cosmetic name list, keyed by ship count at launch time. No sim RNG. */
const SHIP_NAME_LIST: readonly string[] = [
  "Aether Wing",
  "Lumen Trader",
  "Salt Runner",
  "Timber Ghost",
  "Spark of Dawn",
  "Ether Mule",
  "Grain Gale",
  "Loom Wisp",
  "Current Hauler",
  "Keel Whisper",
];

export function generateShipName(shipCountBeforeLaunch: number): string {
  const idx = shipCountBeforeLaunch % SHIP_NAME_LIST.length;
  return SHIP_NAME_LIST[idx];
}

/** Amount auto-draw is allowed to attempt this tick of the day (0 or 1 in our spread). */
export function autoDrawCapForDayTick(dayTick: number): number {
  // Spread 10 units over the day: 1 unit on the first 10 ticks of the day, 0 after.
  // Total cap per day respected; missed slots (stall) are lost for that day.
  return dayTick < 10 ? 1 : 0;
}

/** Pure helper for deliver/rush/Stop integration: move min(cargo, need) into siteStore for one good. */
export function applyDeliveryToSite(
  siteStore: Record<GoodId, number>,
  cargo: Record<GoodId, number>,
  good: GoodId,
): { readonly siteStore: Record<GoodId, number>; readonly moved: number } {
  const need = remainingNeed(siteStore, good);
  const have = cargo[good] ?? 0;
  const moved = Math.min(need, have);
  if (moved <= 0) return { siteStore, moved: 0 };
  const next: Record<GoodId, number> = { ...siteStore, [good]: (siteStore[good] ?? 0) + moved };
  return { siteStore: next, moved };
}

/** Launch a new ship if the current siteStore (if any) completes the recipe.
 *  Returns updated world with appended Ship (hold 50, empty, docked at HQ, named) and cleared buildOrder.
 *  Pure; no-op if not completable now.
 */
export function launchIfComplete(world: World): World {
  const hq = world.company.headquarters;
  if (!hq || !hq.buildOrder) return world;
  const store = hq.buildOrder.siteStore;
  if (!isRecipeComplete(store)) return world;

  const shipCount = world.company.ships.length;
  const id = `s${shipCount}`;
  const name = generateShipName(shipCount);
  const newShip: Ship = {
    id,
    hold: 50,
    cargo: emptyCargo(),
    location: { kind: "docked", portId: hq.portId },
    name,
  };

  const clearedHq: Headquarters = { portId: hq.portId /* buildOrder cleared */ };
  return {
    ...world,
    company: {
      ...world.company,
      ships: [...world.company.ships, newShip],
      headquarters: clearedHq,
    },
  };
}

/** Run one tick's auto-draw purchases (after docking, before market) for HQ build site.
 *  In GOOD_IDS order, per-good daily cap via autoDrawCapForDayTick, paid at quoteBuy, stock limited.
 *  Silently buys 0 when unaffordable or no stock. Then attempts launch.
 *  Pure transformation.
 */
export function runBuildSiteAutoDraw(world: World): World {
  const hq = world.company.headquarters;
  if (!hq || !hq.buildOrder) return world;

  // Determine day tick for cap: use current tick (before the +1 at end of this tick fn)
  const dayTick = world.tick % TICKS_PER_DAY;

  let thalers = world.company.thalers;
  let siteStore = { ...hq.buildOrder.siteStore };
  const ports = [...world.region.ports];
  const portIdx = ports.findIndex((p) => p.id === hq.portId);
  if (portIdx < 0) return world;
  let hqPort = ports[portIdx];
  let changedAny = false;

  for (const good of GOOD_IDS) {
    const need = remainingNeed(siteStore, good);
    if (need <= 0) continue;
    const cap = autoDrawCapForDayTick(dayTick);
    if (cap <= 0) continue;

    const qty = Math.min(cap, need);
    const entry = hqPort.market[good];
    const stockAvail = Math.floor(entry.stock);
    const buyQty = Math.min(qty, stockAvail);
    if (buyQty <= 0) continue;

    const base = effectiveBase(hqPort, good);
    const cost = quoteBuy(entry, base, buyQty);
    if (cost === null || cost > thalers) {
      // stall silently (buy 0)
      continue;
    }

    // apply purchase
    thalers -= cost;
    siteStore = { ...siteStore, [good]: (siteStore[good] ?? 0) + buyQty };
    const newMarketGood = { ...entry, stock: entry.stock - buyQty };
    const newMarket = { ...hqPort.market, [good]: newMarketGood };
    hqPort = { ...hqPort, market: newMarket };
    ports[portIdx] = hqPort;
    changedAny = true;
  }

  if (!changedAny && !isRecipeComplete(siteStore)) {
    // no market change, but still check launch? (if complete from before, but we checked on entry)
  }

  let nextWorld: World = {
    ...world,
    company: {
      ...world.company,
      thalers,
      headquarters: {
        portId: hq.portId,
        buildOrder: { siteStore },
      },
    },
    region: { ...world.region, ports },
  };

  // launch check after this phase's draws
  nextWorld = launchIfComplete(nextWorld);
  return nextWorld;
}
