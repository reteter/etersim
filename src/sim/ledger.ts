import { GOOD_IDS, type GoodId } from "./goods";
import { amountOf } from "./goodsStore";
import type { GuildId } from "./guild";
import { effectiveBase, price } from "./market";
import type { PortId, Region } from "./region";
import type { RouteId } from "./route";
import type { ShipId } from "./ship";
import { companyStores, readStore } from "./transfer";
import type { World } from "./world";

/**
 * Ledger (CONTEXT.md, docs/specs/E9-fleet-and-routes.md — Ledger and the
 * performance board): the canonical event stream of a Company's activity —
 * every thaler or goods movement, plus daily net-worth snapshots. One
 * schema, two consumers (the E9 performance board, the E11 Harness). Full
 * retention: events are appended, never pruned or rewritten.
 *
 * Grammar law (issue #203, CONTEXT.md — Ledger): every thaler-moving kind
 * carries `thalers`; every rank-moving kind carries `pointsDelta`. Enforced
 * by `ledger.test.ts`'s exhaustive classification — a new `LedgerEvent` kind
 * left unclassified fails to typecheck.
 *
 * `routeId` is carried on `trade` events (issue #82's acceptance criteria
 * verbatim) — a route-driven trade is dispatched through the exact same
 * `buy`/`sell` command a manual trade uses, tagged with the assignment's
 * routeId — and, since #391, on `dockingFee` events, tagged the same way
 * whenever the docking ship has an active, non-suspended assignment (so a
 * route's net margin — gross minus its exact docking cost — is derivable;
 * #390 part 1). Other route-driven mutations (deliver) are not further
 * tagged.
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
      readonly routeId?: RouteId;
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
      /** Value of goods sitting in an activated Company Building (E13, #100,
       *  SAVE_VERSION 14, `migrateV13ToV14` backfills 0 on older saves) —
       *  generic (not `storehouseValue`): E15's Plant reuses this same
       *  field rather than a second shape change (spec §Ledger & netWorth,
       *  OQ8). */
      readonly buildingStoreValue: number;
      readonly total: number;
    }
  | {
      readonly kind: "enrollmentFee";
      readonly tick: number;
      readonly guildId: GuildId;
      readonly thalers: number;
    }
  | {
      readonly kind: "upkeep";
      readonly tick: number;
      readonly shipId: ShipId;
      readonly thalers: number;
    }
  | {
      readonly kind: "contractFee";
      readonly tick: number;
      readonly guildId: GuildId;
      readonly contractId: string;
      readonly thalers: number;
    }
  | {
      readonly kind: "settlement";
      readonly tick: number;
      readonly contractId: string;
      readonly guildId: GuildId;
      /** "breached" (two consecutive misses; the guild terminates) and
       *  "resigned" (the player exits, same -3 cost) both carry the contract's
       *  termination in the audit trail — summing `pointsDelta` over every
       *  settlement event for a guild must reproduce its actual points
       *  (docs/specs/E3-contracts-and-guilds.md — Ledger). */
      readonly outcome: "met" | "missed" | "breached" | "resigned";
      readonly pointsDelta: number;
    }
  | {
      /** The Shipyard's own construction site completed (E14 #286 fix): the
       *  building activates — the Shipyard analog of `launch`. Moves no
       *  thalers (the labor fee was already logged by `laborFee` at
       *  `commissionShipyard`; materials by their own autoDraw/delivery/rush
       *  events) — unlike the pre-fix instant-purchase model this replaces,
       *  where `shipyardBuilt` fired at commission time carrying the flat
       *  cost. */
      readonly kind: "shipyardBuilt";
      readonly tick: number;
      readonly portId: PortId;
    }
  | {
      /** A Refit started (E14, #275): the labor fee charged up front — the
       *  Shipyard analog of `laborFee`, tagged with the ship/port for the
       *  audit trail. */
      readonly kind: "refitStart";
      readonly tick: number;
      readonly shipId: ShipId;
      readonly portId: PortId;
      readonly thalers: number;
    }
  | {
      /** A Refit completed (E14, #275): the ship's new Hold — the Shipyard
       *  analog of `launch`. Moves no thalers (materials were already logged
       *  by their own autoDraw/delivery/rush events), so it carries `hold`
       *  instead. */
      readonly kind: "refitComplete";
      readonly tick: number;
      readonly shipId: ShipId;
      readonly portId: PortId;
      readonly hold: number;
    }
  | {
      /** Goods moved from a Ship's Cargo into a Company Building's own
       *  store (E13, #100, CONTEXT.md — Stop order kinds "store"/
       *  "withdraw"). Market-free (the goods are already the Company's, the
       *  `deliver` precedent) — no `thalers`. */
      readonly kind: "store";
      readonly tick: number;
      readonly shipId: ShipId;
      readonly portId: PortId;
      readonly good: GoodId;
      readonly qty: number;
    }
  | {
      /** The `store` command's inverse: goods moved from a Company
       *  Building's store back into a Ship's Cargo. */
      readonly kind: "withdraw";
      readonly tick: number;
      readonly shipId: ShipId;
      readonly portId: PortId;
      readonly good: GoodId;
      readonly qty: number;
    }
  | {
      /** A guild Building's own construction completed and it activated
       *  (E13, #100) — the Building analog of `launch` (a launch is a ship;
       *  one kind per meaning). Moves no thalers (the labor fee was already
       *  logged by `laborFee` at commission time; materials by their own
       *  autoDraw/delivery/rush events). `buildingType` is a closed union of
       *  one today (Storehouse); E15's Plant would add a sibling value. */
      readonly kind: "completed";
      readonly tick: number;
      readonly portId: PortId;
      readonly buildingType: "storehouse";
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
  /** Value of goods sitting in an activated Company Building, at
   *  region-average mid — the `cargoValue`/`siteStoreValue` sibling for the
   *  `storehouse` StoreRef kind (E13, #100, spec §Ledger & netWorth, OQ8).
   *  Generic, not `storehouseValue` — E15's Plant reuses this field. */
  readonly buildingStoreValue: number;
  readonly total: number;
}

/**
 * Company net worth: thalers + fleet cargo + construction-site stores (the HQ
 * build site, the Shipyard's own build site, and an active refit site alike —
 * owner decision 2026-07-16, extended to the Shipyard's own site by the #286
 * fix), all goods valued at the region-average mid price. Ships and buildings
 * carry no book value by design — the company-value chart tells the honest
 * investment story (a build is a visible dip, then steeper growth).
 *
 * E13.0 (#307, ADR-0008): walks `companyStores(world)` instead of a
 * hand-written stores array (the F4 silent-failure site, Professor review —
 * a forgotten entry here under-reported company value with no error, no
 * failing test, no in-game symptom). `cargoValue`/`siteStoreValue` stay
 * their pre-#307 shapes (a `hold` ref feeds the former, every other kind the
 * latter) — reshaping the breakdown itself is E13's job, not this one.
 *
 * Accumulates each good's term **directly into the running total**, not via
 * an intermediate per-store sum — floating-point addition is not
 * associative, and grouping terms per store before folding them into
 * `cargoValue`/`siteStoreValue` produced a byte-identical-save regression
 * (C2, `persistence.test.ts`) that the digest test (C1) couldn't see, since
 * its `fmtFloat` rounds to 6 decimals and the drift was in the 15th digit —
 * the same ULP class as incident 0023. This loop's term order exactly
 * matches the pre-#307 two-separate-loops shape: every ship's cargo (in
 * fleet order, GOOD_IDS order) folds into `cargoValue`, then every active
 * site's store (HQ, Shipyard, Refit — `companyStores`'s fixed order) folds
 * into `siteStoreValue`, one addition per good, same as before.
 */
export function computeNetWorth(world: World): NetWorthBreakdown {
  const mids = {} as Record<GoodId, number>;
  for (const good of GOOD_IDS) mids[good] = regionAverageMid(world.region, good);

  let cargoValue = 0;
  let siteStoreValue = 0;
  // E13 (#100): a third accumulator, kept structurally separate from the two
  // above rather than folded into `siteStoreValue` — the loop's shape (and
  // every term's accumulation order) is otherwise byte-for-byte the pre-#100
  // walk; see the class comment above and incident 0023/#307's ULP
  // regression this guards against.
  let buildingStoreValue = 0;
  for (const ref of companyStores(world)) {
    const store = readStore(world, ref);
    if (!store) continue;
    for (const good of GOOD_IDS) {
      const value = amountOf(store, good) * mids[good];
      if (ref.kind === "hold") cargoValue += value;
      else if (ref.kind === "storehouse") buildingStoreValue += value;
      else siteStoreValue += value;
    }
  }

  const thalers = world.company.thalers;
  return {
    thalers,
    cargoValue,
    siteStoreValue,
    buildingStoreValue,
    total: thalers + cargoValue + siteStoreValue + buildingStoreValue,
  };
}
