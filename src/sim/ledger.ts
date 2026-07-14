import { GOOD_IDS, type GoodId } from "./goods";
import type { GuildId } from "./guild";
import { effectiveBase, price } from "./market";
import type { PortId, Region } from "./region";
import type { RouteId } from "./route";
import type { ShipId } from "./ship";
import type { World } from "./world";

/**
 * Ledger (CONTEXT.md, docs/specs/E9-fleet-and-routes.md — Ledger and the
 * performance board): the canonical event stream of a Company's activity —
 * every thaler or goods movement, plus daily net-worth snapshots. One
 * schema, two consumers (the E9 performance board, the E11 Harness). Full
 * retention: events are appended, never pruned or rewritten.
 *
 * `routeId` is carried only on `trade` events (the Tech union in the spec,
 * matching issue #82's acceptance criteria verbatim) — a route-driven trade
 * is dispatched through the exact same `buy`/`sell` command a manual trade
 * uses, tagged with the assignment's routeId; other route-driven mutations
 * (docking fee, deliver) are not further tagged.
 */
export type LedgerEvent =
  | {
      readonly kind: "trade";
      readonly tick: number;
      readonly shipId: ShipId;
      readonly portId: PortId;
      readonly good: GoodId;
      readonly side: "buy" | "sell";
      readonly qty: number;
      readonly thalers: number;
      readonly routeId?: RouteId;
    }
  | {
      readonly kind: "dockingFee";
      readonly tick: number;
      readonly shipId: ShipId;
      readonly portId: PortId;
      readonly thalers: number;
    }
  | {
      readonly kind: "autoDraw";
      readonly tick: number;
      readonly portId: PortId;
      readonly good: GoodId;
      readonly qty: number;
      readonly thalers: number;
    }
  | {
      readonly kind: "rush";
      readonly tick: number;
      readonly portId: PortId;
      readonly good: GoodId;
      readonly qty: number;
      readonly thalers: number;
    }
  | {
      readonly kind: "delivery";
      readonly tick: number;
      readonly shipId: ShipId;
      readonly portId: PortId;
      readonly good: GoodId;
      readonly qty: number;
    }
  | { readonly kind: "laborFee"; readonly tick: number; readonly thalers: number }
  | {
      readonly kind: "founding";
      readonly tick: number;
      readonly portId: PortId;
      readonly thalers: number;
    }
  | {
      readonly kind: "launch";
      readonly tick: number;
      readonly shipId: ShipId;
      readonly portId: PortId;
    }
  | {
      readonly kind: "netWorth";
      readonly tick: number;
      readonly thalers: number;
      readonly cargoValue: number;
      readonly siteStoreValue: number;
      readonly total: number;
    }
  | {
      readonly kind: "enrollmentFee";
      readonly tick: number;
      readonly guildId: GuildId;
    };

/** Appends one event to the Ledger. The single seam every mutation point
 *  goes through (`applyCommand`/tick phases), so the event stream can never
 *  drift from the state changes it describes. */
export function appendLedgerEvent(world: World, event: LedgerEvent): World {
  return { ...world, ledger: [...world.ledger, event] };
}

/** Appends several events at once, in order — used where one command or
 *  tick phase performs several movements in a single pass (rush, auto-draw).
 *  A no-op (returns `world` unchanged) when `events` is empty. */
export function appendLedgerEvents(world: World, events: readonly LedgerEvent[]): World {
  if (events.length === 0) return world;
  return { ...world, ledger: [...world.ledger, ...events] };
}

/**
 * Region-average marginal mid price for one good: the arithmetic mean of
 * `price` (spread-free) across every port, each at its own effective base.
 * Deterministic and unambiguous for valuing cargo aboard an underway ship or
 * materials in the build site — there is no single "current port" to price
 * them at (docs/specs/E9-fleet-and-routes.md — Ledger).
 */
export function regionAverageMid(region: Region, good: GoodId): number {
  if (region.ports.length === 0) return 0;
  let sum = 0;
  for (const port of region.ports) sum += price(port.market[good], effectiveBase(port, good));
  return sum / region.ports.length;
}

export interface NetWorthBreakdown {
  readonly thalers: number;
  readonly cargoValue: number;
  readonly siteStoreValue: number;
  readonly total: number;
}

/**
 * Company net worth: thalers + fleet cargo + build-site store, all goods
 * valued at the region-average mid price. Ships and buildings carry no book
 * value by design — the company-value chart tells the honest investment
 * story (a build is a visible dip, then steeper growth).
 */
export function computeNetWorth(world: World): NetWorthBreakdown {
  const mids = {} as Record<GoodId, number>;
  for (const good of GOOD_IDS) mids[good] = regionAverageMid(world.region, good);

  let cargoValue = 0;
  for (const ship of world.company.ships) {
    for (const good of GOOD_IDS) cargoValue += ship.cargo[good] * mids[good];
  }

  let siteStoreValue = 0;
  const siteStore = world.company.headquarters?.buildOrder?.siteStore;
  if (siteStore) {
    for (const good of GOOD_IDS) siteStoreValue += (siteStore[good] ?? 0) * mids[good];
  }

  const thalers = world.company.thalers;
  return { thalers, cargoValue, siteStoreValue, total: thalers + cargoValue + siteStoreValue };
}
