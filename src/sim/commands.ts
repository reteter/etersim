import {
  applyRushQuoteToSite,
  commissionBuilding,
  computeRushQuote,
  CONSTRUCTION_RESERVE,
  HEADQUARTERS_COST,
  LABOR_FEE,
  launchIfComplete,
  SHIP_RECIPE,
  type ConstructionSite,
  type Headquarters,
} from "./building";
import type { ActiveContract } from "./contract";
import type { GoodId } from "./goods";
import { amountOf, withAdded } from "./goodsStore";
import { ENROLLMENT_FEE, POINTS_BREACH_OR_RESIGN, rankOf, type GuildId } from "./guild";
import { appendLedgerEvent, appendLedgerEvents } from "./ledger";
import { effectiveBase, quoteBuy, quoteSell } from "./market";
import { shortestCourse } from "./pathfinding";
import type { Port, PortId } from "./region";
import {
  completeRefitIfDone,
  completeShipyardIfDone,
  computeRefitRushQuote,
  computeShipyardRushQuote,
  isShipyardUnderConstruction,
  isUnderRefit,
  nextHoldStep,
  refitRecipe,
  REFIT_LABOR_FEE,
  SHIPYARD_LABOR_FEE,
  SHIPYARD_RECIPE,
  withShipyard,
  type RefitOrder,
} from "./shipyard";
import type { Route, RouteId } from "./route";
import { cargoUsed, isRouteActive, type Ship, type ShipId } from "./ship";
import { moveOwnGoods, readStore, type StoreRef } from "./transfer";
import { replaceShip, type World } from "./world";
import {
  applyGuildBuildRush,
  commissionGuildBuildingSite,
  completeGuildBuildingIfDone,
  GRANARY_VARIANT,
  STOREHOUSE_LABOR_FEE,
  STOREHOUSE_PERMIT_RANK,
} from "./storehouse";

/**
 * Command: a player order applied at a tick boundary (CONTEXT.md). Invalid
 * commands are rejected without state change — dropped, never partially
 * applied (docs/specs/E2-trade-loop.md — Tech).
 */
export type Command =
  | { readonly kind: "sailTo"; readonly shipId: ShipId; readonly portId: PortId }
  | {
      readonly kind: "buy";
      readonly shipId: ShipId;
      readonly good: GoodId;
      readonly qty: number;
      /** Set only when dispatched from a Route's buy Stop (tick.ts) — tags
       *  the resulting Ledger trade event (docs/specs/E9 — Ledger). */
      readonly routeId?: RouteId;
    }
  | {
      readonly kind: "sell";
      readonly shipId: ShipId;
      readonly good: GoodId;
      readonly qty: number;
      readonly routeId?: RouteId;
    }
  // E9 route commands (all player mutations stay Commands — determinism + E11 replay).
  | { readonly kind: "createRoute"; readonly route: Route }
  | { readonly kind: "updateRoute"; readonly route: Route }
  | { readonly kind: "deleteRoute"; readonly routeId: RouteId }
  | { readonly kind: "assignRoute"; readonly shipId: ShipId; readonly routeId: RouteId }
  | { readonly kind: "unassignRoute"; readonly shipId: ShipId }
  | { readonly kind: "resumeRoute"; readonly shipId: ShipId }
  // E9 Headquarters & construction (found/place/rush need no ship).
  | { readonly kind: "foundHeadquarters"; readonly portId: PortId }
  | { readonly kind: "placeBuildOrder" }
  | { readonly kind: "rushBuild" }
  | {
      readonly kind: "deliver";
      readonly shipId: ShipId;
      readonly good: GoodId;
      readonly target: StoreRef;
    }
  | {
      readonly kind: "storeGood";
      readonly shipId: ShipId;
      readonly good: GoodId;
      readonly target: StoreRef;
    }
  | {
      readonly kind: "withdrawGood";
      readonly shipId: ShipId;
      readonly good: GoodId;
      readonly source: StoreRef;
    }
  | {
      readonly kind: "commissionGuildBuilding";
      readonly type: "storehouse";
      readonly variant: GuildId;
      readonly portId: PortId;
    }
  | { readonly kind: "rushGuildBuilding" }
  // E14 (#275) Shipyard & Refit — the Shipyard's construction commands.
  // commissionShipyard needs no ship (the placeBuildOrder analog — opens the
  // Shipyard's own construction site, #286 fix); rushShipyard rushes that
  // site; commissionRefit/rushRefit target the Shipyard's one active
  // RefitOrder (only available once the Shipyard itself has activated).
  | { readonly kind: "commissionShipyard"; readonly portId: PortId }
  | { readonly kind: "rushShipyard" }
  | { readonly kind: "commissionRefit"; readonly shipId: ShipId }
  | { readonly kind: "rushRefit" }
  // #54 (folded into E9/#83): player-editable ship display name. Launch names
  // are generator-suggested (building.ts); this is the ShipPanel rename affordance.
  | { readonly kind: "renameShip"; readonly shipId: ShipId; readonly name: string }
  // E3 (#92): guild enrollment — paperwork, no ship presence (founding precedent).
  | { readonly kind: "enroll"; readonly guildId: GuildId }
  // E3 (#94): accept a board offer into an active Contract (rank-gated on the
  // accept side); resign an active Contract at any time (−3, same as breach).
  | { readonly kind: "acceptContract"; readonly offerId: string }
  | { readonly kind: "resignContract"; readonly contractId: string };

/** Longest display name a rename accepts; longer input is trimmed then
 *  truncated (never rejected outright — the field just keeps what fits). */
export const MAX_SHIP_NAME_LENGTH = 40;

/** A Route is assignable iff it has ≥2 Stops spanning ≥2 distinct ports, and no
 *  good appears in more than one order per Stop. The distinct-port rule stops an
 *  all-same-port loop from executing (and never paying a docking fee) forever.
 *  E9.1: `qty` is buy/sell only, a positive integer; `minMargin` is buy only
 *  (the owner ruled out waiting to sell — never on sell/deliver), no sign
 *  constraint of its own. */
function isValidRoute(route: Route): boolean {
  if (!route || !route.id || !route.name || !Array.isArray(route.stops)) return false;
  if (route.stops.length < 2) return false;
  const ports = new Set<PortId>();
  for (const stop of route.stops) {
    if (!stop || !stop.portId || !Array.isArray(stop.orders)) return false;
    ports.add(stop.portId);
    const seen = new Set<GoodId>();
    for (const order of stop.orders) {
      if (!order || !order.good) return false;
      if (seen.has(order.good)) return false;
      seen.add(order.good);
      if (order.qty !== undefined) {
        if (order.kind !== "buy" && order.kind !== "sell") return false;
        if (!Number.isInteger(order.qty) || order.qty <= 0) return false;
      }
      if (order.minMargin !== undefined && order.kind !== "buy") return false;
    }
  }
  return ports.size >= 2;
}

/** The scarcity law (E13 spec §Construction, generalized here — #286):
 *  **one active Build Order per Company — ship or building.** True iff the
 *  Headquarters has a ship hull under construction OR the Shipyard is
 *  itself under construction. A RefitOrder is neither a new ship nor a new
 *  building (it upgrades an existing hull) and keeps its own
 *  one-per-Shipyard scarcity, so it is deliberately excluded here. One place
 *  documenting the law instead of two inline checks (`placeBuildOrder` and
 *  `commissionShipyard` below) drifting apart — E13's target-kind union
 *  (#99–#102) consumes this same helper. */
function hasActiveBuildOrder(company: World["company"]): boolean {
  return (
    company.headquarters?.buildOrder !== undefined ||
    company.shipyard?.site !== undefined ||
    company.guildBuildOrder !== undefined
  );
}

/** The site-specific half of delivering into an explicit `StoreRef` target
 *  (E13.0 #307 — `moveOwnGoods`, `transfer.ts`):
 *  which port to tag the `delivery` Ledger event with, and that site's own
 *  completion check (`launchIfComplete` / `completeShipyardIfDone` /
 *  `completeRefitIfDone`). `null` under the same "doesn't currently resolve"
 *  conditions `readStore`/`writeStore` use. Callers pass only site refs;
 *  `"hold"` and `"storehouse"` are rejected by the default branch. */
function siteCompletion(
  world: World,
  target: StoreRef,
): { readonly portId: PortId; readonly completeIfDone: (world: World) => World } | null {
  switch (target.kind) {
    case "hqBuild": {
      const hq = world.company.headquarters;
      return hq ? { portId: hq.portId, completeIfDone: launchIfComplete } : null;
    }
    case "shipyardBuild": {
      const shipyard = world.company.shipyard;
      return shipyard ? { portId: shipyard.portId, completeIfDone: completeShipyardIfDone } : null;
    }
    case "refit": {
      const shipyard = world.company.shipyard;
      return shipyard ? { portId: shipyard.portId, completeIfDone: completeRefitIfDone } : null;
    }
    case "guildBuild": {
      const order = world.company.guildBuildOrder;
      return order ? { portId: order.portId, completeIfDone: completeGuildBuildingIfDone } : null;
    }
    case "storehouse":
    case "hold":
      return null;
    default: {
      const exhaustive: never = target;
      throw new Error(`siteCompletion: unhandled StoreRef kind ${JSON.stringify(exhaustive)}`);
    }
  }
}

/** Delivers `good` from `ship`'s cargo into a resolved `target` site: moves
 *  min(cargo, remaining need) via `moveOwnGoods` (`transfer.ts`), appends a
 *  `delivery` Ledger event for the qty actually moved, then resolves that
 *  site's own completion — or `null` when nothing moved, so the caller can
 *  fall through to the zero-need completion tail (the existing "a completed
 *  recipe still resolves even with a zero-need delivery" contract). The
 *  moved qty is read back as a before/after diff on the ship's own hold
 *  rather than duplicating `moveOwnGoods`'s internal clamp math — the single
 *  source of "how much actually moved" stays inside `transfer.ts`. */
function applyDelivery(world: World, ship: Ship, good: GoodId, target: StoreRef): World | null {
  const info = siteCompletion(world, target);
  if (!info) return null;
  if (ship.location.kind !== "docked" || ship.location.portId !== info.portId) return null;

  const holdRef: StoreRef = { kind: "hold", shipId: ship.id };
  const before = amountOf(readStore(world, holdRef)!, good);
  const movedWorld = moveOwnGoods(world, holdRef, target, good, "max");
  const after = amountOf(readStore(movedWorld, holdRef)!, good);
  const moved = before - after;
  if (moved <= 0) return null;

  return info.completeIfDone(
    appendLedgerEvent(movedWorld, {
      kind: "delivery",
      tick: world.tick,
      shipId: ship.id,
      portId: info.portId,
      good,
      qty: moved,
    }),
  );
}

/** Applies one command, returning the input world unchanged on rejection. */
export function applyCommand(world: World, command: Command): World {
  switch (command.kind) {
    case "createRoute": {
      if (!isValidRoute(command.route)) return world;
      if (world.company.routes.some((r) => r.id === command.route.id)) return world;
      return {
        ...world,
        company: { ...world.company, routes: [...world.company.routes, command.route] },
      };
    }
    case "updateRoute": {
      if (!isValidRoute(command.route)) return world;
      const idx = world.company.routes.findIndex((r) => r.id === command.route.id);
      if (idx < 0) return world;
      const routes = world.company.routes.slice();
      routes[idx] = command.route;
      return { ...world, company: { ...world.company, routes } };
    }
    case "deleteRoute": {
      if (!world.company.routes.some((r) => r.id === command.routeId)) return world;
      return {
        ...world,
        company: {
          ...world.company,
          routes: world.company.routes.filter((r) => r.id !== command.routeId),
        },
      };
    }
    case "assignRoute": {
      // Pure state-setter: the tick route pass (ships[] order) does all dispatch
      // and Stop execution, so routes never introduce a second ordering regime.
      const ship = world.company.ships.find((s) => s.id === command.shipId);
      if (!ship) return world;
      // Refit lock (E14 #275): a locked ship can't be put back on autopilot —
      // it can't sail to fulfil the plan anyway.
      if (isUnderRefit(world, command.shipId)) return world;
      const route = world.company.routes.find((r) => r.id === command.routeId);
      if (!route || route.stops.length < 2) return world;
      return replaceShip(world, {
        ...ship,
        assignment: { routeId: command.routeId, nextStopIndex: 0, suspended: false },
      });
    }
    case "unassignRoute": {
      const ship = world.company.ships.find((s) => s.id === command.shipId);
      if (!ship || !ship.assignment) return world;
      return replaceShip(world, { ...ship, assignment: undefined });
    }
    case "resumeRoute": {
      // Clear the suspend flag and wrap a stale index left out of range by a
      // shortening edit; the route pass re-dispatches to the next Stop in order
      // (predictable, never "nearest").
      const ship = world.company.ships.find((s) => s.id === command.shipId);
      if (!ship || !ship.assignment) return world;
      // Refit lock (E14 #275): resuming would clear `suspended` while still
      // locked, and the route pass would silently pick the Route back up the
      // moment the refit completes — "resume is manual after completion"
      // (spec) means this command itself must stay blocked for the whole
      // refit, not just movement.
      if (isUnderRefit(world, command.shipId)) return world;
      const route = world.company.routes.find((r) => r.id === ship.assignment!.routeId);
      if (!route || route.stops.length < 2) return world;
      const idx =
        ship.assignment.nextStopIndex >= 0 && ship.assignment.nextStopIndex < route.stops.length
          ? ship.assignment.nextStopIndex
          : 0;
      return replaceShip(world, {
        ...ship,
        assignment: { ...ship.assignment, nextStopIndex: idx, suspended: false },
      });
    }
    case "foundHeadquarters": {
      if (world.company.headquarters) return world;
      // Founding may not dip into the Reserve (#122 — E9 spec §The Reserve).
      if (world.company.thalers < HEADQUARTERS_COST + CONSTRUCTION_RESERVE) return world;
      if (!world.region.ports.some((p) => p.id === command.portId)) return world;
      const founded: World = {
        ...world,
        company: {
          ...world.company,
          thalers: world.company.thalers - HEADQUARTERS_COST,
          headquarters: { portId: command.portId },
        },
      };
      return appendLedgerEvent(founded, {
        kind: "founding",
        tick: world.tick,
        portId: command.portId,
        thalers: HEADQUARTERS_COST,
      });
    }
    case "placeBuildOrder": {
      const hq = world.company.headquarters;
      if (!hq || hq.buildOrder) return world;
      // One active Build Order per Company (#286): a Shipyard under
      // construction is a Build Order too, so a ship hull can't be started
      // alongside it — the other side of this check lives in
      // commissionShipyard, below.
      if (hasActiveBuildOrder(world.company)) return world;
      // commissionBuilding (building.ts, #99): the generic "place a
      // construction" step — this HQ command is its first caller.
      const commissioned = commissionBuilding(world.company.thalers, LABOR_FEE);
      if (!commissioned) return world; // the labor fee may not dip into the Reserve (#122)
      const nextHq: Headquarters = { portId: hq.portId, buildOrder: { siteStore: commissioned.siteStore } };
      const placed: World = {
        ...world,
        company: {
          ...world.company,
          thalers: commissioned.thalers,
          headquarters: nextHq,
        },
      };
      return appendLedgerEvent(placed, { kind: "laborFee", tick: world.tick, thalers: LABOR_FEE });
    }
    case "rushBuild": {
      const hq = world.company.headquarters;
      if (!hq || !hq.buildOrder) return world;
      const portIdx = world.region.ports.findIndex((p) => p.id === hq.portId);
      if (portIdx < 0) return world;

      // computeRushQuote (building.ts) is the single source of "what would
      // rushing buy right now" — the UI previews the same quote before the
      // player confirms (docs/specs/E9 — "same sim function").
      const quote = computeRushQuote(world);
      if (quote.lines.length === 0) return world;

      const site: ConstructionSite = {
        recipe: SHIP_RECIPE,
        siteStore: hq.buildOrder.siteStore,
        portId: hq.portId,
      };
      const result = applyRushQuoteToSite(
        site,
        world.region.ports[portIdx],
        world.company.thalers,
        quote,
        world.tick,
      );
      const ports = [...world.region.ports];
      ports[portIdx] = result.port;

      const rushed: World = {
        ...world,
        company: {
          ...world.company,
          thalers: result.thalers,
          headquarters: { portId: hq.portId, buildOrder: { siteStore: result.siteStore } },
        },
        region: { ...world.region, ports },
      };
      return launchIfComplete(appendLedgerEvents(rushed, result.events));
    }
    case "deliver": {
      const ship = world.company.ships.find((s) => s.id === command.shipId);
      if (!ship || ship.location.kind !== "docked") return world;
      const result = applyDelivery(world, ship, command.good, command.target);
      if (result) return result;
      const info = siteCompletion(world, command.target);
      return info && info.portId === ship.location.portId ? info.completeIfDone(world) : world;
    }
    case "storeGood": {
      if (command.target.kind !== "storehouse") return world;
      const ship = world.company.ships.find((candidate) => candidate.id === command.shipId);
      if (
        !ship ||
        ship.location.kind !== "docked" ||
        ship.location.portId !== command.target.portId
      ) return world;
      const holdRef: StoreRef = { kind: "hold", shipId: ship.id };
      const before = amountOf(ship.cargo, command.good);
      const movedWorld = moveOwnGoods(world, holdRef, command.target, command.good, "max");
      const afterStore = readStore(movedWorld, holdRef);
      if (!afterStore) return world;
      const moved = before - amountOf(afterStore, command.good);
      if (moved <= 0) return world;
      return appendLedgerEvent(movedWorld, {
        kind: "store",
        tick: world.tick,
        shipId: ship.id,
        portId: command.target.portId,
        good: command.good,
        qty: moved,
      });
    }
    case "withdrawGood": {
      if (command.source.kind !== "storehouse") return world;
      const ship = world.company.ships.find((candidate) => candidate.id === command.shipId);
      if (
        !ship ||
        ship.location.kind !== "docked" ||
        ship.location.portId !== command.source.portId
      ) return world;
      const beforeStore = readStore(world, command.source);
      if (!beforeStore) return world;
      const before = amountOf(beforeStore, command.good);
      const holdRef: StoreRef = { kind: "hold", shipId: ship.id };
      const movedWorld = moveOwnGoods(world, command.source, holdRef, command.good, "max");
      const afterStore = readStore(movedWorld, command.source);
      if (!afterStore) return world;
      const moved = before - amountOf(afterStore, command.good);
      if (moved <= 0) return world;
      return appendLedgerEvent(movedWorld, {
        kind: "withdraw",
        tick: world.tick,
        shipId: ship.id,
        portId: command.source.portId,
        good: command.good,
        qty: moved,
      });
    }
    case "commissionGuildBuilding": {
      if (!world.company.headquarters) return world;
      if (command.type !== "storehouse" || command.variant !== GRANARY_VARIANT) return world;
      if (hasActiveBuildOrder(world.company)) return world;
      if (world.company.buildings.some((building) => building.portId === command.portId)) return world;
      const guildState = world.company.guilds[command.variant];
      if (!guildState || rankOf(guildState.points) < STOREHOUSE_PERMIT_RANK) return world;
      const port = world.region.ports.find((candidate) => candidate.id === command.portId);
      if (!port || (port.archetype !== command.variant && port.archetype !== "freeport")) return world;
      const commissioned = commissionGuildBuildingSite(
        world.company.thalers,
        STOREHOUSE_LABOR_FEE,
      );
      if (!commissioned) return world;
      const commissionedWorld: World = {
        ...world,
        company: {
          ...world.company,
          thalers: commissioned.thalers,
          guildBuildOrder: {
            type: command.type,
            variant: command.variant,
            portId: command.portId,
            siteStore: commissioned.siteStore,
          },
        },
      };
      return appendLedgerEvent(commissionedWorld, {
        kind: "laborFee",
        tick: world.tick,
        thalers: STOREHOUSE_LABOR_FEE,
      });
    }
    case "rushGuildBuilding": {
      return applyGuildBuildRush(world);
    }
    case "commissionShipyard": {
      // The placeBuildOrder analog for the Shipyard building itself (#286
      // fix): commissioning opens a ConstructionSite (SHIPYARD_RECIPE)
      // instead of instantly creating the building — Storehouse/HQ-ship
      // parity ("buildings activate the moment their Recipe completes",
      // E13/E9 pattern). `commissionBuilding` (building.ts, #99) is reused
      // for its reserve-gated fee charge and the empty siteStore it hands
      // back.
      if (!world.company.headquarters) return world;
      if (world.company.shipyard) return world; // one per Company (commissioned or built)
      // One active Build Order per Company (#286): no Shipyard construction
      // while an HQ ship hull is already being built.
      if (hasActiveBuildOrder(world.company)) return world;
      if (!world.region.ports.some((p) => p.id === command.portId)) return world;
      const commissioned = commissionBuilding(world.company.thalers, SHIPYARD_LABOR_FEE);
      if (!commissioned) return world; // the labor fee may not dip into the Reserve (#122)
      const commissionedWorld: World = {
        ...world,
        company: {
          ...world.company,
          thalers: commissioned.thalers,
          shipyard: withShipyard({ portId: command.portId }, { site: { siteStore: commissioned.siteStore } }),
        },
      };
      return appendLedgerEvent(commissionedWorld, {
        kind: "laborFee",
        tick: world.tick,
        thalers: SHIPYARD_LABOR_FEE,
      });
    }
    case "rushShipyard": {
      const shipyard = world.company.shipyard;
      if (!shipyard || !shipyard.site) return world;
      const portIdx = world.region.ports.findIndex((p) => p.id === shipyard.portId);
      if (portIdx < 0) return world;

      // computeShipyardRushQuote (shipyard.ts) is the single source of "what
      // would rushing buy right now" — the `computeRushQuote`/
      // `computeRefitRushQuote` pattern.
      const quote = computeShipyardRushQuote(world);
      if (quote.lines.length === 0) return world;

      const site: ConstructionSite = {
        recipe: SHIPYARD_RECIPE,
        siteStore: shipyard.site.siteStore,
        portId: shipyard.portId,
      };
      const result = applyRushQuoteToSite(
        site,
        world.region.ports[portIdx],
        world.company.thalers,
        quote,
        world.tick,
      );
      const ports = [...world.region.ports];
      ports[portIdx] = result.port;

      const rushed: World = {
        ...world,
        company: {
          ...world.company,
          thalers: result.thalers,
          shipyard: withShipyard(shipyard, { site: { siteStore: result.siteStore } }),
        },
        region: { ...world.region, ports },
      };
      return completeShipyardIfDone(appendLedgerEvents(rushed, result.events));
    }
    case "commissionRefit": {
      const shipyard = world.company.shipyard;
      if (!shipyard) return world;
      if (isShipyardUnderConstruction(world)) return world; // not activated yet (#286 fix)
      if (shipyard.refitOrder) return world; // one active Refit at a time (v1)
      const ship = world.company.ships.find((s) => s.id === command.shipId);
      if (!ship) return world;
      if (ship.location.kind !== "docked" || ship.location.portId !== shipyard.portId) return world;

      // Loud guard (#274 wave-2 handoff note): a capped ship's refitRecipe is
      // all zeros, which would otherwise open a RefitOrder that completes
      // the instant it's created. Reject explicitly instead.
      const targetHold = nextHoldStep(ship);
      if (targetHold === null) return world;

      // commissionBuilding (building.ts, #99): reused for the reserve-gated
      // fee charge and the empty siteStore — commissionShipyard's sibling
      // call, the second caller of this seam within #275.
      const commissioned = commissionBuilding(world.company.thalers, REFIT_LABOR_FEE);
      if (!commissioned) return world; // the labor fee may not dip into the Reserve (#122)

      // Auto-suspend (existing manual-sailTo semantics, same as sailTo below):
      // the plan stays assigned, resume is manual once the Refit completes.
      const assignment = isRouteActive(ship)
        ? { ...ship.assignment!, suspended: true }
        : ship.assignment;
      const withShip = replaceShip(world, { ...ship, assignment });

      const nextRefitOrder: RefitOrder = { shipId: ship.id, targetHold, siteStore: commissioned.siteStore };
      const started: World = {
        ...withShip,
        company: {
          ...withShip.company,
          thalers: commissioned.thalers,
          shipyard: withShipyard(shipyard, { refitOrder: nextRefitOrder }),
        },
      };
      return appendLedgerEvent(started, {
        kind: "refitStart",
        tick: world.tick,
        shipId: ship.id,
        portId: shipyard.portId,
        thalers: REFIT_LABOR_FEE,
      });
    }
    case "rushRefit": {
      const shipyard = world.company.shipyard;
      if (!shipyard || !shipyard.refitOrder) return world;
      const portIdx = world.region.ports.findIndex((p) => p.id === shipyard.portId);
      if (portIdx < 0) return world;

      // computeRefitRushQuote (shipyard.ts) is the single source of "what
      // would rushing buy right now" — the `computeRushQuote` pattern (#276
      // previews the same quote before the player confirms).
      const quote = computeRefitRushQuote(world);
      if (quote.lines.length === 0) return world;

      const refitOrder = shipyard.refitOrder;
      const targetShip = world.company.ships.find((s) => s.id === refitOrder.shipId);
      if (!targetShip) return world; // defensive — shouldn't happen with a valid World
      const site: ConstructionSite = {
        recipe: refitRecipe(targetShip),
        siteStore: refitOrder.siteStore,
        portId: shipyard.portId,
      };
      const result = applyRushQuoteToSite(
        site,
        world.region.ports[portIdx],
        world.company.thalers,
        quote,
        world.tick,
      );
      const ports = [...world.region.ports];
      ports[portIdx] = result.port;

      const rushed: World = {
        ...world,
        company: {
          ...world.company,
          thalers: result.thalers,
          shipyard: withShipyard(shipyard, { refitOrder: { ...refitOrder, siteStore: result.siteStore } }),
        },
        region: { ...world.region, ports },
      };
      return completeRefitIfDone(appendLedgerEvents(rushed, result.events));
    }
    case "buy": {
      const ship = world.company.ships.find((s) => s.id === command.shipId);
      if (!ship || ship.location.kind !== "docked") return world;
      if (isUnderRefit(world, command.shipId)) return world; // refit lock (E14 #275): no cargo trade
      const dockedAt = ship.location.portId;
      const port = world.region.ports.find((p) => p.id === dockedAt)!;
      const total = quoteBuy(port.market[command.good], effectiveBase(port, command.good), command.qty);
      if (total === null) return world;
      if (total > world.company.thalers) return world;
      if (cargoUsed(ship) + command.qty > ship.hold) return world;
      return applyTrade(world, ship, port, command.good, -command.qty, -total, command.routeId);
    }
    case "sell": {
      const ship = world.company.ships.find((s) => s.id === command.shipId);
      if (!ship || ship.location.kind !== "docked") return world;
      if (isUnderRefit(world, command.shipId)) return world; // refit lock (E14 #275): no cargo trade
      const dockedAt = ship.location.portId;
      const port = world.region.ports.find((p) => p.id === dockedAt)!;
      if (!Number.isInteger(command.qty) || command.qty <= 0) return world;
      if (amountOf(ship.cargo, command.good) < command.qty) return world;
      const total = quoteSell(port.market[command.good], effectiveBase(port, command.good), command.qty);
      if (total === null) return world;
      return applyTrade(world, ship, port, command.good, command.qty, total, command.routeId);
    }
    case "sailTo": {
      const ship = world.company.ships.find((s) => s.id === command.shipId);
      if (!ship || ship.location.kind !== "docked") return world;
      if (isUnderRefit(world, command.shipId)) return world; // refit lock (E14 #275): locked in port
      const fromPortId = ship.location.portId;
      if (command.portId === fromPortId) return world;
      const course = shortestCourse(world.region, fromPortId, command.portId);
      if (course === null || course.length === 0) return world;
      // A manual sailTo auto-suspends an active Route — the plan stays assigned,
      // resume picks it up (never destroyed, never a confirmation dialog).
      const assignment = isRouteActive(ship)
        ? { ...ship.assignment!, suspended: true }
        : ship.assignment;
      const underway: Ship = {
        ...ship,
        assignment,
        location: {
          kind: "underway",
          course,
          voyageIndex: 0,
          voyageProgressTicks: 0,
          destination: command.portId,
        },
      };
      return replaceShip(world, underway);
    }
    case "enroll": {
      // Paperwork — no ship presence required (founding precedent). Deliberately
      // NOT Reserve-gated: the Reserve covers construction spend and standing
      // costs only (docs/specs/E3-contracts-and-guilds.md — Upkeep).
      if (!world.company.headquarters) return world;
      if (world.company.guilds[command.guildId]) return world;
      if (world.company.thalers < ENROLLMENT_FEE) return world;
      const enrolled: World = {
        ...world,
        company: {
          ...world.company,
          thalers: world.company.thalers - ENROLLMENT_FEE,
          guilds: { ...world.company.guilds, [command.guildId]: { points: 0 } },
        },
      };
      return appendLedgerEvent(enrolled, {
        kind: "enrollmentFee",
        tick: world.tick,
        guildId: command.guildId,
        thalers: ENROLLMENT_FEE,
      });
    }
    case "acceptContract": {
      // Rank-gating is accept-side (docs/specs/E3-contracts-and-guilds.md —
      // Tech: Contracts): enrollment + rank checked here, never at generation.
      // Gates on `requiredRank`, not `tier` (issue #226 — desperation clause:
      // tier stays the honest job description, requiredRank is the actually
      // enforced access rule, guaranteed 1 for at least one offer per guild).
      const offer = world.contractOffers.find((o) => o.id === command.offerId);
      if (!offer) return world;
      const guildState = world.company.guilds[offer.guildId];
      if (!guildState) return world;
      if (rankOf(guildState.points) < offer.requiredRank) return world;
      // Defense-in-depth against a stale-board race: the same (guild,port,good)
      // id could in principle reappear on the board while a same-id contract
      // is already active — never duplicate it. The generator (contract.ts
      // `refreshContractOffers`, #200) now owns the real exclusion — it never
      // emits an offer for a (port, good) already under an active contract —
      // so this guard should be unreachable in practice; kept as a second
      // line against a stale/imported board.
      if (world.company.contracts.some((c) => c.id === offer.id)) return world;
      const active: ActiveContract = {
        ...offer,
        startTick: world.tick,
        periodIndex: 0,
        deliveredThisPeriod: 0,
        consecutiveMisses: 0,
      };
      return {
        ...world,
        contractOffers: world.contractOffers.filter((o) => o.id !== offer.id),
        company: { ...world.company, contracts: [...world.company.contracts, active] },
      };
    }
    case "resignContract": {
      // Allowed any time, same cost as a guild-side breach (docs/specs/E3 —
      // Fulfilment and settlement). Emits a `settlement` event (outcome
      // "resigned") — the wave-check finding that summing settlement.pointsDelta
      // must reproduce a guild's actual points; a silent exit would undercount it.
      const contract = world.company.contracts.find((c) => c.id === command.contractId);
      if (!contract) return world;
      const points = world.company.guilds[contract.guildId]?.points ?? 0;
      const resigned: World = {
        ...world,
        company: {
          ...world.company,
          contracts: world.company.contracts.filter((c) => c.id !== command.contractId),
          guilds: {
            ...world.company.guilds,
            [contract.guildId]: { points: Math.max(0, points + POINTS_BREACH_OR_RESIGN) },
          },
        },
      };
      return appendLedgerEvent(resigned, {
        kind: "settlement",
        tick: world.tick,
        contractId: contract.id,
        guildId: contract.guildId,
        outcome: "resigned",
        pointsDelta: POINTS_BREACH_OR_RESIGN,
      });
    }
    case "renameShip": {
      // Cosmetic, player-editable (#54); no RNG, no other field touched.
      // Empty/whitespace-only input is rejected outright — a ship's name is
      // always present, so a blank rename would leave the fleet unreadable.
      const ship = world.company.ships.find((s) => s.id === command.shipId);
      if (!ship) return world;
      const trimmed = command.name.trim().slice(0, MAX_SHIP_NAME_LENGTH);
      if (!trimmed) return world;
      return replaceShip(world, { ...ship, name: trimmed });
    }
  }
}

/** stockDelta moves the port stock; thalerDelta moves the company purse.
 *  Cargo moves opposite to stock. Positive stockDelta = ship selling. The
 *  trade event's side/qty/thalers are derived from these same two deltas
 *  (their sign and magnitude), not passed separately — a single source of
 *  truth, so a caller can never hand the Ledger a value inconsistent with
 *  the state change it actually applied. `routeId` tags a route-driven trade
 *  (docs/specs/E9 — Ledger). */
function applyTrade(
  world: World,
  ship: Ship,
  port: Port,
  good: GoodId,
  stockDelta: number,
  thalerDelta: number,
  routeId?: RouteId,
): World {
  const tradedShip: Ship = {
    ...ship,
    cargo: withAdded(ship.cargo, good, -stockDelta),
  };
  const tradedPort: Port = {
    ...port,
    market: {
      ...port.market,
      [good]: { ...port.market[good], stock: port.market[good].stock + stockDelta },
    },
  };
  const withShip = replaceShip(world, tradedShip);
  // Sale attribution (#94 — E9 equivalence): a sell of the contract good at
  // the contract port counts identically whether dispatched manually or by a
  // Route's sell order — both paths land here as the same `applyTrade` call,
  // so there is no second math to keep in sync. Buys never attribute.
  const contracts =
    stockDelta > 0
      ? withShip.company.contracts.map((c) =>
          c.portId === port.id && c.good === good
            ? { ...c, deliveredThisPeriod: c.deliveredThisPeriod + stockDelta }
            : c,
        )
      : withShip.company.contracts;
  const traded: World = {
    ...withShip,
    company: { ...withShip.company, thalers: withShip.company.thalers + thalerDelta, contracts },
    region: {
      ...withShip.region,
      ports: withShip.region.ports.map((p) => (p.id === port.id ? tradedPort : p)),
    },
  };
  return appendLedgerEvent(traded, {
    kind: "trade",
    tick: world.tick,
    shipId: ship.id,
    portId: port.id,
    good,
    side: stockDelta > 0 ? "sell" : "buy",
    qty: Math.abs(stockDelta),
    thalers: Math.abs(thalerDelta),
    routeId,
  });
}
