import { GOOD_IDS, type GoodId } from "./goods";
import { appendLedgerEvent, appendLedgerEvents, type LedgerEvent } from "./ledger";
import { effectiveBase, estimateBuy, maxAffordableQty, quoteBuy } from "./market";
import type { Port, PortId } from "./region";
import { TICKS_PER_DAY } from "./region";
import { emptyCargo, type Ship } from "./ship";
import type { World } from "./world";

/**
 * Headquarters and Build Order (E9). One HQ per Company at a chosen port; one
 * active BuildOrder at a time. `siteStore` tracks materials gathered toward
 * SHIP_RECIPE. Sources: auto-draw (rate-capped market buys), deliver
 * (free, min(cargo, need)), rush (quoteBuy, stock-limited). The ship launches
 * the tick the recipe completes.
 *
 * ConstructionSite (E14 spec — "#99 first: the construction-site seam"): the
 * pure engine below (`drawConstructionSite`, `quoteConstructionSiteRush`,
 * `applyRushQuoteToSite`, `siteRemainingNeed`, `isSiteComplete`,
 * `applyDeliveryToConstructionSite`) is parameterized on `{ recipe, siteStore,
 * portId }` instead of reading `world.company.headquarters.buildOrder`
 * directly, so ship construction (the Headquarters) and future callers
 * (Refit, guild buildings) share one engine. The Headquarters-shaped
 * functions below (`remainingNeed`, `isRecipeComplete`, `applyDeliveryToSite`,
 * `runBuildSiteAutoDraw`, `computeRushQuote`) are thin, behavior-preserving
 * wrappers over that engine, kept for existing callers (commands.ts, UI).
 */

export const HEADQUARTERS_COST = 2500;
/** The Reserve (CONTEXT.md; #122 grill 2026-07-12): no construction spend —
 *  founding, labor fee, auto-draw, rush — may take the purse below this
 *  floor. Equal to STARTING_THALERS so the rule reads "building never
 *  touches your last starting-purse". Tuning ≠ spec drift. */
export const CONSTRUCTION_RESERVE = 500;
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

/** A construction in progress at a port: a target recipe, materials gathered
 *  so far, and where it's being built. Ship construction (the Headquarters)
 *  is the first caller; Refit and guild buildings (E14/E13) are future ones
 *  (E14 spec — "#99 first: the construction-site seam"). */
export interface ConstructionSite {
  readonly recipe: Record<GoodId, number>;
  readonly siteStore: Record<GoodId, number>;
  readonly portId: PortId;
}

/** Units still needed of `good` to complete `site`'s recipe. Pure; the
 *  generic engine `remainingNeed` (below) specializes to SHIP_RECIPE. */
export function siteRemainingNeed(
  site: Pick<ConstructionSite, "recipe" | "siteStore">,
  good: GoodId,
): number {
  return Math.max(0, site.recipe[good] - (site.siteStore[good] ?? 0));
}

/** Whether every good in `site`'s recipe has been fully gathered. Pure. */
export function isSiteComplete(site: Pick<ConstructionSite, "recipe" | "siteStore">): boolean {
  for (const good of GOOD_IDS) {
    if ((site.siteStore[good] ?? 0) < site.recipe[good]) return false;
  }
  return true;
}

export function remainingNeed(siteStore: Record<GoodId, number>, good: GoodId): number {
  return siteRemainingNeed({ recipe: SHIP_RECIPE, siteStore }, good);
}

export function isRecipeComplete(siteStore: Record<GoodId, number>): boolean {
  return isSiteComplete({ recipe: SHIP_RECIPE, siteStore });
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

/** Move min(cargo, remaining need) of one good into a site's siteStore, per
 *  its recipe. Pure; the generic engine behind `applyDeliveryToSite`. */
export function applyDeliveryToConstructionSite(
  site: Pick<ConstructionSite, "recipe" | "siteStore">,
  cargo: Record<GoodId, number>,
  good: GoodId,
): { readonly siteStore: Record<GoodId, number>; readonly moved: number } {
  const need = siteRemainingNeed(site, good);
  const have = cargo[good] ?? 0;
  const moved = Math.min(need, have);
  if (moved <= 0) return { siteStore: site.siteStore, moved: 0 };
  const next: Record<GoodId, number> = {
    ...site.siteStore,
    [good]: (site.siteStore[good] ?? 0) + moved,
  };
  return { siteStore: next, moved };
}

/** Move min(cargo, remaining need) of one good into the site store, against
 *  SHIP_RECIPE. Pure; shared by the deliver command and a Route's deliver
 *  Stop. */
export function applyDeliveryToSite(
  siteStore: Record<GoodId, number>,
  cargo: Record<GoodId, number>,
  good: GoodId,
): { readonly siteStore: Record<GoodId, number>; readonly moved: number } {
  return applyDeliveryToConstructionSite({ recipe: SHIP_RECIPE, siteStore }, cargo, good);
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

/** Pure preview of what rushing `site` would buy right now, in `GOOD_IDS`
 *  order: `maxAffordableQty` of each good's remaining need against a running
 *  purse (each earlier good's cost narrows what later goods can afford) —
 *  the exact walk `applyRushQuoteToSite` executes, factored out so the UI's
 *  displayed quote can never drift from what actually gets charged
 *  (docs/specs/E9-fleet-and-routes.md — UX skeleton: "rush button with live
 *  quote, same sim function"). Only the purse above the Reserve (#122) is
 *  spendable. The generic engine behind `computeRushQuote`. */
export function quoteConstructionSiteRush(
  site: ConstructionSite,
  port: Port,
  thalers: number,
): RushQuote {
  let purse = thalers - CONSTRUCTION_RESERVE;
  const lines: RushQuoteLine[] = [];
  for (const good of GOOD_IDS) {
    const need = siteRemainingNeed(site, good);
    if (need <= 0) continue;
    const entry = port.market[good];
    const base = effectiveBase(port, good);
    const qty = maxAffordableQty(entry, base, need, purse);
    if (qty <= 0) continue;
    const lineThalers = quoteBuy(entry, base, qty)!;
    purse -= lineThalers;
    lines.push({ good, qty, thalers: lineThalers });
  }
  const total = lines.reduce((sum, line) => sum + line.thalers, 0);
  return { lines, total };
}

/** Result of applying a rush quote (or an auto-draw walk) to a construction
 *  site: the updated siteStore, the port with reduced stock, the purse after
 *  spend, and the Ledger events the caller should append. Pure; shared shape
 *  for `runBuildSiteAutoDraw` and `rushBuild` (commands.ts). */
export interface SiteDrawResult {
  readonly siteStore: Record<GoodId, number>;
  readonly port: Port;
  readonly thalers: number;
  readonly events: readonly LedgerEvent[];
}

/** Apply an already-computed `RushQuote` to `site`/`port`/`thalers`, one
 *  `rush` Ledger event per line actually bought. Pure; the exact walk
 *  `rushBuild` executes so the charged total can never drift from the
 *  previewed quote. */
export function applyRushQuoteToSite(
  site: ConstructionSite,
  port: Port,
  thalers: number,
  quote: RushQuote,
  tick: number,
): SiteDrawResult {
  let siteStore = site.siteStore;
  let nextPort = port;
  let purse = thalers;
  const events: LedgerEvent[] = [];

  for (const line of quote.lines) {
    const entry = nextPort.market[line.good];
    purse -= line.thalers;
    siteStore = { ...siteStore, [line.good]: (siteStore[line.good] ?? 0) + line.qty };
    nextPort = {
      ...nextPort,
      market: { ...nextPort.market, [line.good]: { ...entry, stock: entry.stock - line.qty } },
    };
    events.push({
      kind: "rush",
      tick,
      portId: site.portId,
      good: line.good,
      qty: line.qty,
      thalers: line.thalers,
    });
  }
  return { siteStore, port: nextPort, thalers: purse, events };
}

/** Pure preview of what `rushBuild` (commands.ts) would buy right now at the
 *  Headquarters. Empty when there is no active build or the HQ port can't be
 *  found (defensive; shouldn't happen with a valid World). */
export function computeRushQuote(world: World): RushQuote {
  const hq = world.company.headquarters;
  if (!hq || !hq.buildOrder) return { lines: [], total: 0 };
  const port = world.region.ports.find((p) => p.id === hq.portId);
  if (!port) return { lines: [], total: 0 };
  const site: ConstructionSite = { recipe: SHIP_RECIPE, siteStore: hq.buildOrder.siteStore, portId: hq.portId };
  return quoteConstructionSiteRush(site, port, world.company.thalers);
}

/** One good's line in a build estimate: the full Recipe quantity at today's
 *  asks (ceiling-priced past current stock — see `estimateBuy`). */
export interface BuildEstimateLine {
  readonly good: GoodId;
  readonly qty: number;
  readonly thalers: number;
}

/** A prospective Build Order's cost "at today's prices": per-good Recipe
 *  lines, the flat labor fee, and their sum. */
export interface BuildEstimate {
  readonly lines: readonly BuildEstimateLine[];
  readonly laborFee: number;
  readonly total: number;
}

/** Pure preview of what commissioning a hull would cost at today's prices:
 *  Recipe × current asks at the Headquarters port (`estimateBuy` — the same
 *  marginal walk `quoteBuy` charges, ceiling-priced past current stock) plus
 *  the labor fee. Deliberately independent of the purse — it is an estimate
 *  shown *against* the purse, not an affordability quote (#122 grill; the
 *  `computeRushQuote` pattern, so the Budowa tab's displayed breakdown can
 *  never drift from the price curve that charges auto-draw and rush).
 *  `null` without a Headquarters. */
export function computeBuildEstimate(world: World): BuildEstimate | null {
  const hq = world.company.headquarters;
  if (!hq) return null;
  const port = world.region.ports.find((p) => p.id === hq.portId);
  if (!port) return null;

  const lines: BuildEstimateLine[] = [];
  for (const good of GOOD_IDS) {
    const qty = SHIP_RECIPE[good];
    if (qty <= 0) continue;
    const thalers = estimateBuy(port.market[good], effectiveBase(port, good), qty)!;
    lines.push({ good, qty, thalers });
  }
  const materials = lines.reduce((sum, line) => sum + line.thalers, 0);
  return { lines, laborFee: LABOR_FEE, total: materials + LABOR_FEE };
}

/** Launch a new ship when the current siteStore completes the recipe: append a
 *  Ship (hold 50, baseHold 50 — the ladder's starting rung, E14 spec, empty,
 *  docked at HQ, generated name) and clear the buildOrder. Pure; a no-op
 *  when there is no completable build. */
export function launchIfComplete(world: World): World {
  const hq = world.company.headquarters;
  if (!hq || !hq.buildOrder) return world;
  if (!isRecipeComplete(hq.buildOrder.siteStore)) return world;

  const shipCount = world.company.ships.length;
  const newShip: Ship = {
    id: `s${shipCount}`,
    name: generateShipName(shipCount),
    hold: 50,
    baseHold: 50,
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

/** One tick's rate-capped auto-draw walk over `site`, in GOOD_IDS order:
 *  `cap` units per good at most, `quoteBuy` at `port`, stock-limited. Buys 0
 *  (silent stall, no event) when the purchase would take `thalers` below
 *  CONSTRUCTION_RESERVE or the port is out of stock. Pure; the generic engine
 *  behind `runBuildSiteAutoDraw` — shared by the HQ auto-draw runner and
 *  future callers (Refit, guild buildings — E14 spec "#99 first"). */
export function drawConstructionSite(
  site: ConstructionSite,
  port: Port,
  thalers: number,
  cap: number,
  tick: number,
): SiteDrawResult {
  let siteStore = site.siteStore;
  let nextPort = port;
  let purse = thalers;
  const events: LedgerEvent[] = [];

  for (const good of GOOD_IDS) {
    const need = siteRemainingNeed({ recipe: site.recipe, siteStore }, good);
    if (need <= 0) continue;
    const entry = nextPort.market[good];
    const buyQty = Math.min(cap, need, Math.floor(entry.stock));
    if (buyQty <= 0) continue;
    const cost = quoteBuy(entry, effectiveBase(nextPort, good), buyQty);
    if (cost === null || cost > purse - CONSTRUCTION_RESERVE) continue; // stall silently at the Reserve (#122)

    purse -= cost;
    siteStore = { ...siteStore, [good]: (siteStore[good] ?? 0) + buyQty };
    nextPort = {
      ...nextPort,
      market: { ...nextPort.market, [good]: { ...entry, stock: entry.stock - buyQty } },
    };
    events.push({ kind: "autoDraw", tick, portId: site.portId, good, qty: buyQty, thalers: cost });
  }

  return { siteStore, port: nextPort, thalers: purse, events };
}

/** Run one tick's auto-draw for the HQ build site (after docking, before the
 *  market tick). Attempts a launch afterward. Pure. */
export function runBuildSiteAutoDraw(world: World): World {
  const hq = world.company.headquarters;
  if (!hq || !hq.buildOrder) return world;

  const dayTick = world.tick % TICKS_PER_DAY;
  const cap = autoDrawCapForDayTick(dayTick);
  if (cap <= 0) return launchIfComplete(world);

  const ports = [...world.region.ports];
  const portIdx = ports.findIndex((p) => p.id === hq.portId);
  if (portIdx < 0) return world;

  const site: ConstructionSite = { recipe: SHIP_RECIPE, siteStore: hq.buildOrder.siteStore, portId: hq.portId };
  const result = drawConstructionSite(site, ports[portIdx], world.company.thalers, cap, world.tick);
  ports[portIdx] = result.port;

  const drawn: World = {
    ...world,
    company: {
      ...world.company,
      thalers: result.thalers,
      headquarters: { portId: hq.portId, buildOrder: { siteStore: result.siteStore } },
    },
    region: { ...world.region, ports },
  };
  return launchIfComplete(appendLedgerEvents(drawn, result.events));
}

/** Result of commissioning a construction: the labor fee charged and an
 *  empty site opened for the caller's recipe. Pure "place a construction"
 *  shape (E14 spec — "#99 first"): `null` when the fee would dip below the
 *  Reserve. `placeBuildOrder` (ship construction, commands.ts) is the first
 *  caller; future Shipyard/guild-building commands share this shape. */
export interface CommissionResult {
  readonly siteStore: Record<GoodId, number>;
  readonly thalers: number;
}

export function commissionBuilding(thalers: number, laborFee: number): CommissionResult | null {
  if (thalers < laborFee + CONSTRUCTION_RESERVE) return null;
  return { siteStore: emptySiteStore(), thalers: thalers - laborFee };
}
