import {
  autoDrawCapForDayTick,
  drawConstructionSite,
  isSiteComplete,
  quoteConstructionSiteRush,
  SHIP_RECIPE,
  type BuildOrder,
  type ConstructionSite,
  type RushQuote,
} from "./building";
import { appendLedgerEvent, appendLedgerEvents } from "./ledger";
import { GOOD_IDS, type GoodId } from "./goods";
import type { PortId } from "./region";
import { TICKS_PER_DAY } from "./region";
import type { Ship, ShipId } from "./ship";
import type { World } from "./world";

/**
 * The Hold ladder (E14 spec — "The Hold ladder"): pure math only, plus the
 * Shipyard building + RefitOrder lifecycle (#275) — the second caller of the
 * ConstructionSite engine (#99, `building.ts`), after ship construction.
 * `commissionShipyard`/`commissionRefit`/the lock/deliver/rush command
 * handlers live in `commands.ts` (same split as Headquarters/`building.ts`);
 * this module holds the domain types, the tuning constants, and the
 * World-touching helpers those commands and `tick.ts` share.
 */

/** Cumulative multipliers over `baseHold`, applied in order (tuning ≠ spec
 *  drift — the *shape*, a fixed multiplier ladder with a hard cap, is
 *  spec). */
export const HOLD_LADDER: readonly number[] = [2, 1.5, 1.25];

/** Material cost of a refit step scales `SHIP_RECIPE` by the fraction of a
 *  full hull's worth of Hold gained; 1.0 keeps it a straight proportion
 *  (tuning). */
export const REFIT_MATERIAL_FACTOR = 1.0;

/** Flat per-refit labor fee, charged up front (tuning). */
export const REFIT_LABOR_FEE = 500;

/**
 * The Hold ladder's thresholds for a given `baseHold`, cumulative and each
 * rounded to the nearest integer from the base directly — never iterated
 * from a prior rounded rung (spec: "computed once from baseHold"). For
 * baseHold 50: [100, 150, 188].
 */
export function holdLadder(baseHold: number): number[] {
  let cumulative = 1;
  const thresholds: number[] = [];
  for (const multiplier of HOLD_LADDER) {
    cumulative *= multiplier;
    thresholds.push(Math.round(baseHold * cumulative));
  }
  return thresholds;
}

/**
 * The next Hold threshold strictly above the ship's current `hold`, or
 * `null` once it is at or past the ladder's cap (the hard cap after three
 * refit levels).
 */
export function nextHoldStep(ship: Ship): number | null {
  const ladder = holdLadder(ship.baseHold);
  for (const threshold of ladder) {
    if (threshold > ship.hold) return threshold;
  }
  return null;
}

/**
 * The materials a Refit to the next ladder step costs: `SHIP_RECIPE` scaled
 * by the Hold gained relative to `baseHold`, rounded up per good so the
 * site never under-collects. Only meaningful when `nextHoldStep` is
 * non-null — callers gate on that before invoking this (the Refit command,
 * #276).
 */
export function refitRecipe(ship: Ship): Record<GoodId, number> {
  const target = nextHoldStep(ship);
  const holdGained = (target ?? ship.hold) - ship.hold;
  const recipe = {} as Record<GoodId, number>;
  for (const good of GOOD_IDS) {
    recipe[good] = Math.ceil(
      (SHIP_RECIPE[good] * holdGained * REFIT_MATERIAL_FACTOR) / ship.baseHold,
    );
  }
  return recipe;
}

/** Bill of materials for the Shipyard building itself, filled through the
 *  same ConstructionSite engine (#99) as ship construction — the "buildings
 *  are constructed, not bought" pattern Storehouse/ProcessingPlant will also
 *  follow (E13/E15 precedent). Tuning ≠ spec drift. #286 fix: replaces the
 *  earlier instant `SHIPYARD_COST` flat purchase (2026-07-16 owner
 *  ratification of the #285 post-merge audit — the Design section always
 *  said "built via the Build Order pattern"; the #285 Tech draft had it
 *  instant instead). */
export const SHIPYARD_RECIPE: Record<GoodId, number> = {
  grain: 60,
  textiles: 40,
  aetherSalt: 30,
  electronics: 15,
  timber: 20,
};

/** Flat labor fee charged up front when `commissionShipyard` opens the
 *  Shipyard's own construction site — the `LABOR_FEE`/`STOREHOUSE_LABOR_FEE`
 *  analog. Tuning. */
export const SHIPYARD_LABOR_FEE = 700;

/** The active construction against a docked ship: which ship, the Hold
 *  threshold it's aiming for (one of `holdLadder`'s rungs), and the
 *  materials gathered so far. No `recipe` field — `refitRecipe(ship)`
 *  recomputes it deterministically from the ship's (unchanged, until
 *  completion) `hold`/`baseHold`, so there is nothing to drift out of sync. */
export interface RefitOrder {
  readonly shipId: ShipId;
  readonly targetHold: number;
  readonly siteStore: Record<GoodId, number>;
}

/** The Company's second Building (E14): one per Company, commissioned at a
 *  port of the player's choice once the Headquarters exists.
 *  `world.company.shipyard` is present from the moment `commissionShipyard`
 *  succeeds (same optional shape as `Headquarters`), but the building only
 *  *activates* once `site` clears — #286 fix: commissioning opens a
 *  ConstructionSite (`SHIPYARD_RECIPE`) instead of instantly creating a
 *  usable building, so `commissionRefit` (below) gates on `!site` in
 *  addition to `!refitOrder`. `site` and `refitOrder` are mutually
 *  exclusive by construction: a Refit cannot start before the Shipyard
 *  itself is built. */
export interface Shipyard {
  readonly portId: PortId;
  readonly site?: BuildOrder;
  readonly refitOrder?: RefitOrder;
}

/** Rebuilds `base` with `patch` applied, spreading `base` first so any
 *  `Shipyard` field neither named in `patch` nor explicitly cleared survives
 *  untouched — a from-scratch literal (`{ portId: shipyard.portId, site:
 *  {...} }`) would silently drop such a field the day `Shipyard` grows one
 *  (e.g. a refit-cancellation flag, a save-compatible v2 extension), because
 *  every field beyond `portId` is optional and the compiler has nothing to
 *  flag (Professor F5 review, docs/design-notes/professor-construction-review.md,
 *  #290). Clearing `site`/`refitOrder` is then a named decision — pass it
 *  `undefined` explicitly — rather than an implicit one. `base` may be a
 *  bare `{ portId }` (`commissionShipyard`'s fresh Shipyard, which is itself
 *  a valid `Shipyard` with both optional fields absent). */
export function withShipyard(
  base: Shipyard,
  patch: Partial<Pick<Shipyard, "site" | "refitOrder">>,
): Shipyard {
  return { ...base, ...patch };
}

/** Builds the `ConstructionSite` view of the Shipyard's own build site, or
 *  `null` with no Shipyard/no active site (already built or never
 *  commissioned) — the #286 fix's construction-side counterpart of
 *  `activeRefitSite`. */
function activeShipyardSite(world: World): ConstructionSite | null {
  const shipyard = world.company.shipyard;
  if (!shipyard || !shipyard.site) return null;
  return { recipe: SHIPYARD_RECIPE, siteStore: shipyard.site.siteStore, portId: shipyard.portId };
}

/** True iff the Shipyard has been commissioned but its own construction
 *  site hasn't completed yet — `commissionRefit` gates on this (in addition
 *  to `refitOrder`) so no Refit can start before the building activates
 *  (#286 fix). */
export function isShipyardUnderConstruction(world: World): boolean {
  return activeShipyardSite(world) !== null;
}

/** Pure preview of what `rushShipyard` (commands.ts) would buy right now
 *  toward the Shipyard's own construction. Empty with no Shipyard, no
 *  active site, or the port can't be found. The `computeRushQuote`/
 *  `computeRefitRushQuote` pattern, so the UI's quote can never drift from
 *  what actually gets charged. */
export function computeShipyardRushQuote(world: World): RushQuote {
  const site = activeShipyardSite(world);
  if (!site) return { lines: [], total: 0 };
  const port = world.region.ports.find((p) => p.id === site.portId);
  if (!port) return { lines: [], total: 0 };
  return quoteConstructionSiteRush(site, port, world.company.thalers);
}

/** Completes the Shipyard's own construction when its Recipe fills: `site`
 *  clears (the building activates) and a `shipyardBuilt` event is appended.
 *  Pure; a no-op when there is no completable site. The Shipyard-self analog
 *  of `launchIfComplete`/`completeRefitIfDone`. */
export function completeShipyardIfDone(world: World): World {
  const shipyard = world.company.shipyard;
  const site = activeShipyardSite(world);
  if (!shipyard || !site) return world;
  if (!isSiteComplete(site)) return world;

  const completed: World = {
    ...world,
    company: { ...world.company, shipyard: withShipyard(shipyard, { site: undefined }) }, // activates
  };
  return appendLedgerEvent(completed, {
    kind: "shipyardBuilt",
    tick: world.tick,
    portId: shipyard.portId,
  });
}

/** Run one tick's auto-draw for the Shipyard's own construction site (after
 *  the docking phase, alongside `runBuildSiteAutoDraw`/`runShipyardAutoDraw`
 *  — same tick phase, same cap/cadence, drawing sequentially from the shared
 *  purse). Attempts activation afterward. Pure; a no-op with no active site
 *  (never commissioned, or already built). Mutually exclusive in practice
 *  with `runShipyardAutoDraw` (a Refit cannot be active while the Shipyard
 *  itself is still under construction). */
export function runShipyardConstructionAutoDraw(world: World): World {
  const shipyard = world.company.shipyard;
  const site = activeShipyardSite(world);
  if (!shipyard || !site) return world;

  const dayTick = world.tick % TICKS_PER_DAY;
  const cap = autoDrawCapForDayTick(dayTick);
  if (cap <= 0) return completeShipyardIfDone(world);

  const ports = [...world.region.ports];
  const portIdx = ports.findIndex((p) => p.id === shipyard.portId);
  if (portIdx < 0) return world;

  const result = drawConstructionSite(site, ports[portIdx], world.company.thalers, cap, world.tick);
  ports[portIdx] = result.port;

  const drawn: World = {
    ...world,
    company: {
      ...world.company,
      thalers: result.thalers,
      shipyard: withShipyard(shipyard, { site: { siteStore: result.siteStore } }),
    },
    region: { ...world.region, ports },
  };
  return completeShipyardIfDone(appendLedgerEvents(drawn, result.events));
}

/** True iff `shipId` is the exact ship targeted by the Shipyard's active
 *  RefitOrder — derived, no stored lock flag (E14 spec — "Refit lock").
 *  `commands.ts` gates `sailTo`, route assignment (`assignRoute`,
 *  `resumeRoute`) and cargo trade commands (`buy`/`sell`) on this; `deliver`
 *  is deliberately NOT gated — it's one of the three ways the site fills,
 *  and the locked ship itself may deliver from its own cargo. */
export function isUnderRefit(world: World, shipId: ShipId): boolean {
  return world.company.shipyard?.refitOrder?.shipId === shipId;
}

/** Builds the `ConstructionSite` view of the active RefitOrder, or `null`
 *  with no Shipyard/no active refit/a stale shipId (defensive — shouldn't
 *  happen with a valid World). Recomputes `refitRecipe` from the live ship
 *  rather than trusting a stored value (there is none to trust). */
function activeRefitSite(world: World): { site: ConstructionSite; ship: Ship } | null {
  const shipyard = world.company.shipyard;
  if (!shipyard || !shipyard.refitOrder) return null;
  const ship = world.company.ships.find((s) => s.id === shipyard.refitOrder!.shipId);
  if (!ship) return null;
  return {
    ship,
    site: { recipe: refitRecipe(ship), siteStore: shipyard.refitOrder.siteStore, portId: shipyard.portId },
  };
}

/** Pure preview of what `rushRefit` (commands.ts) would buy right now at the
 *  Shipyard. Empty with no Shipyard, no active refit, or the port can't be
 *  found. The `computeRushQuote` (building.ts) pattern, so the UI's Refit
 *  quote can never drift from what actually gets charged (#276). */
export function computeRefitRushQuote(world: World): RushQuote {
  const active = activeRefitSite(world);
  if (!active) return { lines: [], total: 0 };
  const port = world.region.ports.find((p) => p.id === active.site.portId);
  if (!port) return { lines: [], total: 0 };
  return quoteConstructionSiteRush(active.site, port, world.company.thalers);
}

/** Completes the active Refit when its recipe fills: `hold` jumps to
 *  `targetHold`, `refitOrder` clears (lifting the lock), and a
 *  `refitComplete` event is appended. Pure; a no-op when there is no
 *  completable refit. The Shipyard analog of `launchIfComplete`
 *  (building.ts). */
export function completeRefitIfDone(world: World): World {
  const shipyard = world.company.shipyard;
  const active = activeRefitSite(world);
  if (!shipyard || !shipyard.refitOrder || !active) return world;
  if (!isSiteComplete(active.site)) return world;

  const targetHold = shipyard.refitOrder.targetHold;
  const completedShip: Ship = { ...active.ship, hold: targetHold };
  const completed: World = {
    ...world,
    company: {
      ...world.company,
      ships: world.company.ships.map((s) => (s.id === completedShip.id ? completedShip : s)),
      shipyard: withShipyard(shipyard, { refitOrder: undefined }), // lock lifted
    },
  };
  return appendLedgerEvent(completed, {
    kind: "refitComplete",
    tick: world.tick,
    shipId: completedShip.id,
    portId: shipyard.portId,
    hold: targetHold,
  });
}

/** Run one tick's auto-draw for the active Refit site (after the docking
 *  phase, alongside `runBuildSiteAutoDraw` — same tick phase, same cap/cadence,
 *  drawing sequentially from the shared purse). Attempts completion
 *  afterward. Pure; a no-op with no active refit. The Shipyard analog of
 *  `runBuildSiteAutoDraw` (building.ts). */
export function runShipyardAutoDraw(world: World): World {
  const shipyard = world.company.shipyard;
  const active = activeRefitSite(world);
  if (!shipyard || !shipyard.refitOrder || !active) return world;

  const dayTick = world.tick % TICKS_PER_DAY;
  const cap = autoDrawCapForDayTick(dayTick);
  if (cap <= 0) return completeRefitIfDone(world);

  const ports = [...world.region.ports];
  const portIdx = ports.findIndex((p) => p.id === shipyard.portId);
  if (portIdx < 0) return world;

  const result = drawConstructionSite(active.site, ports[portIdx], world.company.thalers, cap, world.tick);
  ports[portIdx] = result.port;

  const drawn: World = {
    ...world,
    company: {
      ...world.company,
      thalers: result.thalers,
      shipyard: withShipyard(shipyard, {
        refitOrder: { ...shipyard.refitOrder, siteStore: result.siteStore },
      }),
    },
    region: { ...world.region, ports },
  };
  return completeRefitIfDone(appendLedgerEvents(drawn, result.events));
}
