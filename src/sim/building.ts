import { GOOD_IDS, type GoodId } from "./goods";
import { appendLedgerEvent, appendLedgerEvents, type LedgerEvent } from "./ledger";
import { effectiveBase, maxAffordableQty, quoteBuy } from "./market";
import type { PortId } from "./region";
import { TICKS_PER_DAY } from "./region";
import { emptyCargo, type Ship } from "./ship";
import type { World } from "./world";

/**
 * Headquarters and Build Order (E9). One HQ per Company at a chosen port; one
 * active BuildOrder at a time. `siteStore` tracks materials gathered toward
 * SHIP_RECIPE. Sources: auto-draw (rate-capped market buys), deliver
 * (free, min(cargo, need)), rush (quoteBuy, stock-limited). The ship launches
 * the tick the recipe completes.
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

/** Fixed cosmetic name list, keyed by ship count at launch time. Draws no sim
 *  RNG (ADR-0003 note: names are cosmetic and player-editable). */
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
  return SHIP_NAME_LIST[shipCountBeforeLaunch % SHIP_NAME_LIST.length];
}

/** Units auto-draw may attempt on this tick of the day: 1 unit on each of the
 *  first AUTO_DRAW_PER_DAY ticks, 0 after — spreading the daily cap like E8
 *  flows. Missed slots (stall) are lost for that day. */
export function autoDrawCapForDayTick(dayTick: number): number {
  return dayTick < AUTO_DRAW_PER_DAY ? 1 : 0;
}

/** Move min(cargo, remaining need) of one good into the site store. Pure;
 *  shared by the deliver command and a Route's deliver Stop. */
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

/** One good's line in a rush preview: how many units, at what total cost. */
export interface RushQuoteLine {
  readonly good: GoodId;
  readonly qty: number;
  readonly thalers: number;
}

/** A rush preview: the per-good lines `rushBuild` would buy right now, and
 *  their total. */
export interface RushQuote {
  readonly lines: readonly RushQuoteLine[];
  readonly total: number;
}

/** Pure preview of what `rushBuild` (commands.ts) would buy right now, in
 *  `GOOD_IDS` order: `maxAffordableQty` of each good's remaining need against
 *  a running purse (each earlier good's cost narrows what later goods can
 *  afford) — the exact walk `rushBuild` executes, factored out so the UI's
 *  displayed quote can never drift from what actually gets charged
 *  (docs/specs/E9-fleet-and-routes.md — UX skeleton: "rush button with live
 *  quote, same sim function"). Empty when there is no active build or the HQ
 *  port can't be found (defensive; shouldn't happen with a valid World). */
export function computeRushQuote(world: World): RushQuote {
  const hq = world.company.headquarters;
  if (!hq || !hq.buildOrder) return { lines: [], total: 0 };
  const port = world.region.ports.find((p) => p.id === hq.portId);
  if (!port) return { lines: [], total: 0 };

  let thalers = world.company.thalers;
  const siteStore = hq.buildOrder.siteStore;
  const lines: RushQuoteLine[] = [];
  for (const good of GOOD_IDS) {
    const need = remainingNeed(siteStore, good);
    if (need <= 0) continue;
    const entry = port.market[good];
    const base = effectiveBase(port, good);
    const qty = maxAffordableQty(entry, base, need, thalers);
    if (qty <= 0) continue;
    const lineThalers = quoteBuy(entry, base, qty)!;
    thalers -= lineThalers;
    lines.push({ good, qty, thalers: lineThalers });
  }
  const total = lines.reduce((sum, line) => sum + line.thalers, 0);
  return { lines, total };
}

/** Launch a new ship when the current siteStore completes the recipe: append a
 *  Ship (hold 50, empty, docked at HQ, generated name) and clear the buildOrder.
 *  Pure; a no-op when there is no completable build. */
export function launchIfComplete(world: World): World {
  const hq = world.company.headquarters;
  if (!hq || !hq.buildOrder) return world;
  if (!isRecipeComplete(hq.buildOrder.siteStore)) return world;

  const shipCount = world.company.ships.length;
  const newShip: Ship = {
    id: `s${shipCount}`,
    name: generateShipName(shipCount),
    hold: 50,
    cargo: emptyCargo(),
    location: { kind: "docked", portId: hq.portId },
  };
  const launched: World = {
    ...world,
    company: {
      ...world.company,
      ships: [...world.company.ships, newShip],
      headquarters: { portId: hq.portId },
    },
  };
  return appendLedgerEvent(launched, {
    kind: "launch",
    tick: world.tick,
    shipId: newShip.id,
    portId: hq.portId,
  });
}

/** Run one tick's auto-draw for the HQ build site (after docking, before the
 *  market tick). In GOOD_IDS order, per-good daily cap via autoDrawCapForDayTick,
 *  paid at quoteBuy from the HQ port, stock-limited. Buys 0 (silent stall) when
 *  unaffordable or out of stock. Attempts a launch afterward. Pure. */
export function runBuildSiteAutoDraw(world: World): World {
  const hq = world.company.headquarters;
  if (!hq || !hq.buildOrder) return world;

  const dayTick = world.tick % TICKS_PER_DAY;
  const cap = autoDrawCapForDayTick(dayTick);
  if (cap <= 0) return launchIfComplete(world);

  let thalers = world.company.thalers;
  let siteStore = { ...hq.buildOrder.siteStore };
  const ports = [...world.region.ports];
  const portIdx = ports.findIndex((p) => p.id === hq.portId);
  if (portIdx < 0) return world;
  let hqPort = ports[portIdx];
  const events: LedgerEvent[] = [];

  for (const good of GOOD_IDS) {
    const need = remainingNeed(siteStore, good);
    if (need <= 0) continue;
    const entry = hqPort.market[good];
    const buyQty = Math.min(cap, need, Math.floor(entry.stock));
    if (buyQty <= 0) continue;
    const cost = quoteBuy(entry, effectiveBase(hqPort, good), buyQty);
    if (cost === null || cost > thalers) continue; // stall silently

    thalers -= cost;
    siteStore = { ...siteStore, [good]: (siteStore[good] ?? 0) + buyQty };
    hqPort = {
      ...hqPort,
      market: { ...hqPort.market, [good]: { ...entry, stock: entry.stock - buyQty } },
    };
    ports[portIdx] = hqPort;
    events.push({ kind: "autoDraw", tick: world.tick, portId: hq.portId, good, qty: buyQty, thalers: cost });
  }

  const drawn: World = {
    ...world,
    company: {
      ...world.company,
      thalers,
      headquarters: { portId: hq.portId, buildOrder: { siteStore } },
    },
    region: { ...world.region, ports },
  };
  return launchIfComplete(appendLedgerEvents(drawn, events));
}
