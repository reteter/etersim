import { SHIP_RECIPE } from "./building";
import type { GoodId } from "./goods";
import { amountOf, withAdded, withRemoved, type GoodsStore } from "./goodsStore";
import { accepts, type StorePolicy } from "./goodsStorePolicy";
import { refitRecipe, SHIPYARD_RECIPE, withShipyard } from "./shipyard";
import type { Ship, ShipId } from "./ship";
import { replaceShip, type World } from "./world";

/**
 * E13.0 (#307, docs/adr/0008-one-goods-store.md; docs/specs/E13.0-goods-store.md
 * §Tech — Transfer): the Transfer primitive (CONTEXT.md: Transfer) — one
 * movement of a Good between two Goods stores the Company owns. Only the
 * **thaler-free half** (`hold<->site`) is implemented here (owner ruling,
 * OQ1, spec §Transfer): `market<->hold` stays on the existing `applyTrade`
 * seam (`commands.ts`), which also carries the price walk, the purse,
 * market-impact stock mutation and contract-fulfilment attribution — folding
 * it in is the one part of the collapse that risks behavior preservation.
 * The `StoreRef` vocabulary is defined for all four pairs regardless, so the
 * remaining collapse stays a cheap later step.
 */
export type StoreRef =
  | { readonly kind: "hold"; readonly shipId: ShipId }
  | { readonly kind: "hqBuild" }
  | { readonly kind: "shipyardBuild" }
  | { readonly kind: "refit" };
// E13: | { kind: "storehouse"; portId } ;  E15: | { kind: "plantInput" | "plantOutput"; portId }

/** Every store the Company currently owns, ship holds first (in fleet
 *  order) then whichever construction sites are active — the enumeration
 *  the value-neutrality invariant (`valueNeutrality.test.ts`) and
 *  `computeNetWorth` (`ledger.ts`) both walk. Order is not load-bearing for
 *  either consumer (both sum); it is NOT used to sequence the tick's
 *  auto-draw, which keeps its own explicit HQ -> Shipyard -> Refit order
 *  (`tick.ts`, Professor F3) — spec §Persistence and determinism, hazard 4. */
export function companyStores(world: World): readonly StoreRef[] {
  const refs: StoreRef[] = world.company.ships.map((ship) => ({ kind: "hold", shipId: ship.id }) as const);
  if (world.company.headquarters?.buildOrder) refs.push({ kind: "hqBuild" });
  if (world.company.shipyard?.site) refs.push({ kind: "shipyardBuild" });
  if (world.company.shipyard?.refitOrder) refs.push({ kind: "refit" });
  return refs;
}

/** The live `GoodsStore` a `StoreRef` currently names, or `null` when the
 *  ref doesn't resolve right now (ship doesn't exist, site not active). */
export function readStore(world: World, ref: StoreRef): GoodsStore | null {
  switch (ref.kind) {
    case "hold": {
      const ship = world.company.ships.find((s) => s.id === ref.shipId);
      return ship ? ship.cargo : null;
    }
    case "hqBuild":
      return world.company.headquarters?.buildOrder?.siteStore ?? null;
    case "shipyardBuild":
      return world.company.shipyard?.site?.siteStore ?? null;
    case "refit":
      return world.company.shipyard?.refitOrder?.siteStore ?? null;
    default: {
      const exhaustive: never = ref;
      throw new Error(`readStore: unhandled StoreRef kind ${JSON.stringify(exhaustive)}`);
    }
  }
}

/** The live `StorePolicy` a `StoreRef` currently carries, derived at the
 *  point of use (ADR-0008 — never serialized): `hold`'s capacity is the
 *  ship's own (mutable) `hold`; each construction site's recipe is the
 *  live recipe for its kind — `refit`'s in particular is always recomputed
 *  from the target ship's current hold via `refitRecipe`, never stored.
 *  `null` under the same conditions as `readStore`. */
export function policyFor(world: World, ref: StoreRef): StorePolicy | null {
  switch (ref.kind) {
    case "hold": {
      const ship = world.company.ships.find((s) => s.id === ref.shipId);
      return ship ? { kind: "hold", capacity: ship.hold } : null;
    }
    case "hqBuild":
      return world.company.headquarters?.buildOrder
        ? { kind: "constructionSite", recipe: SHIP_RECIPE }
        : null;
    case "shipyardBuild":
      return world.company.shipyard?.site
        ? { kind: "constructionSite", recipe: SHIPYARD_RECIPE }
        : null;
    case "refit": {
      const shipyard = world.company.shipyard;
      if (!shipyard || !shipyard.refitOrder) return null;
      const ship = world.company.ships.find((s) => s.id === shipyard.refitOrder!.shipId);
      if (!ship) return null;
      return { kind: "constructionSite", recipe: refitRecipe(ship) };
    }
    default: {
      const exhaustive: never = ref;
      throw new Error(`policyFor: unhandled StoreRef kind ${JSON.stringify(exhaustive)}`);
    }
  }
}

/** Writes `next` back to wherever `ref` currently resolves — the single home
 *  for the four write closures previously threaded through `tryDeliver`
 *  (`commands.ts`). A no-op (returns `world` unchanged) when `ref` doesn't
 *  currently resolve (mirrors `readStore`/`policyFor`'s `null`). */
export function writeStore(world: World, ref: StoreRef, next: GoodsStore): World {
  switch (ref.kind) {
    case "hold": {
      const ship: Ship | undefined = world.company.ships.find((s) => s.id === ref.shipId);
      if (!ship) return world;
      return replaceShip(world, { ...ship, cargo: next });
    }
    case "hqBuild": {
      const hq = world.company.headquarters;
      if (!hq || !hq.buildOrder) return world;
      return {
        ...world,
        company: { ...world.company, headquarters: { portId: hq.portId, buildOrder: { siteStore: next } } },
      };
    }
    case "shipyardBuild": {
      const shipyard = world.company.shipyard;
      if (!shipyard || !shipyard.site) return world;
      return {
        ...world,
        company: { ...world.company, shipyard: withShipyard(shipyard, { site: { siteStore: next } }) },
      };
    }
    case "refit": {
      const shipyard = world.company.shipyard;
      if (!shipyard || !shipyard.refitOrder) return world;
      return {
        ...world,
        company: {
          ...world.company,
          shipyard: withShipyard(shipyard, { refitOrder: { ...shipyard.refitOrder, siteStore: next } }),
        },
      };
    }
    default: {
      const exhaustive: never = ref;
      throw new Error(`writeStore: unhandled StoreRef kind ${JSON.stringify(exhaustive)}`);
    }
  }
}

/**
 * One Transfer: moves `good` from `from` to `to`, both Company-owned stores.
 * `qty` is either an explicit count (clamped to what `from` actually holds
 * AND what `to`'s policy accepts) or `"max"` (move as much as `to` will take
 * of what `from` has). A no-op (`world` returned unchanged) when either ref
 * fails to resolve or the accepted amount is 0 — never a partial write on
 * one side only. Value-neutral by construction (ADR-0008, CONTEXT.md
 * Ledger §Value law): no thalers move, no Ledger event is booked here —
 * callers that need an audit trail (e.g. `deliver`'s `delivery` event) book
 * it themselves from the qty actually moved.
 */
export function moveOwnGoods(
  world: World,
  from: StoreRef,
  to: StoreRef,
  good: GoodId,
  qty: number | "max",
): World {
  const fromStore = readStore(world, from);
  const toStore = readStore(world, to);
  const toPolicy = policyFor(world, to);
  if (!fromStore || !toStore || !toPolicy) return world;

  const available = amountOf(fromStore, good);
  const offered = qty === "max" ? available : Math.min(qty, available);
  if (offered <= 0) return world;

  const moved = accepts(toStore, toPolicy, good, offered);
  if (moved <= 0) return world;

  const afterFrom = writeStore(world, from, withRemoved(fromStore, good, moved));
  return writeStore(afterFrom, to, withAdded(toStore, good, moved));
}

/**
 * The `deliver` guard-clause chain (`commands.ts`, pre-#307:
 * `commands.ts:337-439`), extracted as one pure function: where would
 * delivering `good` from `ship`'s cargo land, following the SAME precedence
 * as before (HQ build site -> Shipyard's own construction -> Refit site),
 * `null` when nothing at the docked port would accept it right now (no
 * cargo to offer, or every active site's need for this good is already met)
 * — matching the pre-#307 "moved <= 0 falls through" behavior exactly.
 *
 * Deliberately does NOT hardcode this chain inside `moveOwnGoods` (the
 * load-bearing detail of the E13.0/E13 split, spec §Tech — "The delivery
 * chain"): E13 later *deletes* this function and lets the player name the
 * `StoreRef` directly — a one-function deletion instead of chain surgery.
 *
 * Does not itself resolve a site's pending completion for a zero-need
 * delivery (e.g. `launchIfComplete`) — that "same zero-need completion
 * resolution" (`commands.ts:435-437` pre-#307) is presence-based, not
 * need-based, and stays hand-maintained in `commands.ts`'s `deliver` case.
 */
export function resolveDeliveryTarget(world: World, ship: Ship, good: GoodId): StoreRef | null {
  if (ship.location.kind !== "docked") return null;
  const dockedPortId = ship.location.portId;
  const have = amountOf(ship.cargo, good);
  if (have <= 0) return null;

  const candidates: StoreRef[] = [];
  const hq = world.company.headquarters;
  if (hq && hq.buildOrder && hq.portId === dockedPortId) candidates.push({ kind: "hqBuild" });
  const shipyard = world.company.shipyard;
  if (shipyard && shipyard.site && shipyard.portId === dockedPortId) candidates.push({ kind: "shipyardBuild" });
  if (shipyard && shipyard.refitOrder && shipyard.portId === dockedPortId) candidates.push({ kind: "refit" });

  for (const ref of candidates) {
    const store = readStore(world, ref);
    const policy = policyFor(world, ref);
    if (!store || !policy) continue;
    if (accepts(store, policy, good, have) > 0) return ref;
  }
  return null;
}
