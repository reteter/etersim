import {
  autoDrawCapForDayTick,
  drawConstructionSite,
  isSiteComplete,
  quoteConstructionSiteRush,
  SHIP_RECIPE,
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

/** Up-front labor fee for commissioning the Shipyard (#286): the building is
 *  **constructed** via the Build Order pattern, not bought instantly — the fee
 *  is charged when the ConstructionSite is opened, then the `SHIPYARD_RECIPE`
 *  materials are gathered (auto-draw / deliver / rush) before the building
 *  activates. The `placeBuildOrder` labor-fee analog. Tuning ≠ spec drift. */
export const SHIPYARD_LABOR_FEE = 1000;

/** Materials the Shipyard construction site must gather before the building
 *  activates (#286). Construction-heavy relative to a hull (more timber /
 *  electronics, less grain) — a building, not a ship. Tuning ≠ spec drift. */
export const SHIPYARD_RECIPE: Record<GoodId, number> = {
  grain: 60,
  textiles: 40,
  aetherSalt: 20,
  electronics: 12,
  timber: 30,
};

/** The Shipyard's own construction in progress (#286): the materials gathered
 *  toward `SHIPYARD_RECIPE` so far. Present iff the building is still under
 *  construction; cleared (the building activates) the moment the recipe fills.
 *  Same optional-nesting shape as the Headquarters' `buildOrder`. */
export interface ShipyardConstruction {
  readonly siteStore: Record<GoodId, number>;
}

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
 *  port of the player's choice once the Headquarters exists. Absent until
 *  commissioned — same optional shape as `Headquarters`.
 *
 *  Constructed, not bought (#286): `construction` is present while the building
 *  is still gathering `SHIPYARD_RECIPE`; it clears (the building activates) when
 *  the recipe fills. `refitOrder` can only be present on an **active** Shipyard
 *  (`construction` absent) — the two are mutually exclusive, so a Shipyard is in
 *  exactly one of three states: under construction, active-idle, active-refitting. */
export interface Shipyard {
  readonly portId: PortId;
  readonly construction?: ShipyardConstruction;
  readonly refitOrder?: RefitOrder;
}

/** Whether the Shipyard exists and has finished construction (can accept a
 *  Refit). Absent Shipyard or one still under construction ⇒ false. */
export function isShipyardActive(world: World): boolean {
  const shipyard = world.company.shipyard;
  return shipyard !== undefined && shipyard.construction === undefined;
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

/** The ConstructionSite view of the Shipyard's own construction (#286), or
 *  null when there is no Shipyard under construction (defensive — shouldn't
 *  happen with a valid World). Recomputes against the fixed `SHIPYARD_RECIPE`. */
export function shipyardConstructionSite(world: World): ConstructionSite | null {
  const shipyard = world.company.shipyard;
  if (!shipyard || !shipyard.construction) return null;
  return { recipe: SHIPYARD_RECIPE, siteStore: shipyard.construction.siteStore, portId: shipyard.portId };
}

/** Pure preview of what rushing the Shipyard's construction would buy right now
 *  (#286). Empty with no Shipyard under construction or the port can't be
 *  found. The `computeRushQuote` (building.ts) / `computeRefitRushQuote`
 *  pattern, so the UI's quote can never drift from what actually gets charged. */
export function computeShipyardBuildRushQuote(world: World): RushQuote {
  const site = shipyardConstructionSite(world);
  if (!site) return { lines: [], total: 0 };
  const port = world.region.ports.find((p) => p.id === site.portId);
  if (!port) return { lines: [], total: 0 };
  return quoteConstructionSiteRush(site, port, world.company.thalers);
}

/** Activates the Shipyard when its construction recipe fills (#286):
 *  `construction` clears, leaving an active, refit-ready `{ portId }`. Pure; a
 *  no-op when there is no completable construction. Activation is a **silent**
 *  state change — the E15 plant precedent (no second ledger kind); the single
 *  `shipyardBuilt` event already fired at commission. The construction analog
 *  of `launchIfComplete` (building.ts) / `completeRefitIfDone`. */
export function activateShipyardIfComplete(world: World): World {
  const shipyard = world.company.shipyard;
  const site = shipyardConstructionSite(world);
  if (!shipyard || !site) return world;
  if (!isSiteComplete(site)) return world;
  return {
    ...world,
    company: { ...world.company, shipyard: { portId: shipyard.portId } },
  };
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
      shipyard: { portId: shipyard.portId }, // refitOrder cleared, lock lifted
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

/** Run one tick's auto-draw for the Shipyard's own construction site (#286),
 *  in the same tick phase / cap / cadence as the HQ build and refit sites,
 *  drawing sequentially from the shared purse. Attempts activation afterward.
 *  Pure. */
function runShipyardConstructionAutoDraw(world: World): World {
  const shipyard = world.company.shipyard!;
  const site = shipyardConstructionSite(world)!;

  const dayTick = world.tick % TICKS_PER_DAY;
  const cap = autoDrawCapForDayTick(dayTick);
  if (cap <= 0) return activateShipyardIfComplete(world);

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
      shipyard: { portId: shipyard.portId, construction: { siteStore: result.siteStore } },
    },
    region: { ...world.region, ports },
  };
  return activateShipyardIfComplete(appendLedgerEvents(drawn, result.events));
}

/** Run one tick's auto-draw for the active Refit site (after the docking
 *  phase, alongside `runBuildSiteAutoDraw` — same tick phase, same cap/cadence,
 *  drawing sequentially from the shared purse). Attempts completion
 *  afterward. Pure; a no-op with no active refit. The Shipyard analog of
 *  `runBuildSiteAutoDraw` (building.ts). */
export function runShipyardAutoDraw(world: World): World {
  const shipyard = world.company.shipyard;
  if (!shipyard) return world;
  // Construction and Refit are mutually exclusive on one Shipyard: draw the
  // building's own construction site first (#286), refit site otherwise.
  if (shipyard.construction) return runShipyardConstructionAutoDraw(world);

  const active = activeRefitSite(world);
  if (!shipyard.refitOrder || !active) return world;

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
      shipyard: {
        portId: shipyard.portId,
        refitOrder: { ...shipyard.refitOrder, siteStore: result.siteStore },
      },
    },
    region: { ...world.region, ports },
  };
  return completeRefitIfDone(appendLedgerEvents(drawn, result.events));
}
