import {
  applyDeliveryToSite,
  computeRushQuote,
  CONSTRUCTION_RESERVE,
  emptySiteStore,
  HEADQUARTERS_COST,
  LABOR_FEE,
  launchIfComplete,
  type Headquarters,
} from "./building";
import type { ActiveContract } from "./contract";
import type { GoodId } from "./goods";
import { ENROLLMENT_FEE, POINTS_BREACH_OR_RESIGN, rankOf, type GuildId } from "./guild";
import { appendLedgerEvent, appendLedgerEvents, type LedgerEvent } from "./ledger";
import { effectiveBase, quoteBuy, quoteSell } from "./market";
import { shortestCourse } from "./pathfinding";
import type { Port, PortId } from "./region";
import type { Route, RouteId } from "./route";
import { cargoUsed, type Ship, type ShipId } from "./ship";
import { replaceShip, type World } from "./world";

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
  | { readonly kind: "deliver"; readonly shipId: ShipId; readonly good: GoodId }
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
 *  all-same-port loop from executing (and never paying a docking fee) forever. */
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
    }
  }
  return ports.size >= 2;
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
      // The labor fee may not dip into the Reserve (#122 — E9 spec §The Reserve).
      if (world.company.thalers < LABOR_FEE + CONSTRUCTION_RESERVE) return world;
      const nextHq: Headquarters = { portId: hq.portId, buildOrder: { siteStore: emptySiteStore() } };
      const placed: World = {
        ...world,
        company: {
          ...world.company,
          thalers: world.company.thalers - LABOR_FEE,
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

      let thalers = world.company.thalers;
      let siteStore = { ...hq.buildOrder.siteStore };
      const ports = [...world.region.ports];
      let port = ports[portIdx];
      const events: LedgerEvent[] = [];

      for (const line of quote.lines) {
        const entry = port.market[line.good];
        thalers -= line.thalers;
        siteStore = { ...siteStore, [line.good]: (siteStore[line.good] ?? 0) + line.qty };
        port = {
          ...port,
          market: { ...port.market, [line.good]: { ...entry, stock: entry.stock - line.qty } },
        };
        ports[portIdx] = port;
        events.push({
          kind: "rush",
          tick: world.tick,
          portId: hq.portId,
          good: line.good,
          qty: line.qty,
          thalers: line.thalers,
        });
      }

      const rushed: World = {
        ...world,
        company: {
          ...world.company,
          thalers,
          headquarters: { portId: hq.portId, buildOrder: { siteStore } },
        },
        region: { ...world.region, ports },
      };
      return launchIfComplete(appendLedgerEvents(rushed, events));
    }
    case "deliver": {
      const ship = world.company.ships.find((s) => s.id === command.shipId);
      if (!ship || ship.location.kind !== "docked") return world;
      const hq = world.company.headquarters;
      if (!hq || !hq.buildOrder || hq.portId !== ship.location.portId) return world;

      const { siteStore, moved } = applyDeliveryToSite(
        hq.buildOrder.siteStore,
        ship.cargo,
        command.good,
      );
      if (moved <= 0) return launchIfComplete(world);

      const delivered: Ship = {
        ...ship,
        cargo: { ...ship.cargo, [command.good]: ship.cargo[command.good] - moved },
      };
      const withShip = replaceShip(world, delivered);
      const withDelivery: World = {
        ...withShip,
        company: {
          ...withShip.company,
          headquarters: { portId: hq.portId, buildOrder: { siteStore } },
        },
      };
      return launchIfComplete(
        appendLedgerEvent(withDelivery, {
          kind: "delivery",
          tick: world.tick,
          shipId: ship.id,
          portId: hq.portId,
          good: command.good,
          qty: moved,
        }),
      );
    }
    case "buy": {
      const ship = world.company.ships.find((s) => s.id === command.shipId);
      if (!ship || ship.location.kind !== "docked") return world;
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
      const dockedAt = ship.location.portId;
      const port = world.region.ports.find((p) => p.id === dockedAt)!;
      if (!Number.isInteger(command.qty) || command.qty <= 0) return world;
      if (ship.cargo[command.good] < command.qty) return world;
      const total = quoteSell(port.market[command.good], effectiveBase(port, command.good), command.qty);
      if (total === null) return world;
      return applyTrade(world, ship, port, command.good, command.qty, total, command.routeId);
    }
    case "sailTo": {
      const ship = world.company.ships.find((s) => s.id === command.shipId);
      if (!ship || ship.location.kind !== "docked") return world;
      const fromPortId = ship.location.portId;
      if (command.portId === fromPortId) return world;
      const course = shortestCourse(world.region, fromPortId, command.portId);
      if (course === null || course.length === 0) return world;
      // A manual sailTo auto-suspends an active Route — the plan stays assigned,
      // resume picks it up (never destroyed, never a confirmation dialog).
      const assignment =
        ship.assignment && !ship.assignment.suspended
          ? { ...ship.assignment, suspended: true }
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
      });
    }
    case "acceptContract": {
      // Rank-gating is accept-side (docs/specs/E3-contracts-and-guilds.md —
      // Tech: Contracts): enrollment + rank checked here, never at generation.
      const offer = world.contractOffers.find((o) => o.id === command.offerId);
      if (!offer) return world;
      const guildState = world.company.guilds[offer.guildId];
      if (!guildState) return world;
      if (rankOf(guildState.points) < offer.tier) return world;
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
    cargo: { ...ship.cargo, [good]: ship.cargo[good] - stockDelta },
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
