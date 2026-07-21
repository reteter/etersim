import {
  autoDrawCapForDayTick,
  drawConstructionSite,
  isSiteComplete,
  quoteConstructionSiteRush,
  type ConstructionSite,
  type RushQuote,
} from "./building";
import { emptyStore, type GoodsStore } from "./goodsStore";
import type { GoodId } from "./goods";
import { GUILDS, rankOf, type GuildId } from "./guild";
import { appendLedgerEvent, appendLedgerEvents } from "./ledger";
import { TICKS_PER_DAY, type PortId } from "./region";
import type { World } from "./world";

/**
 * The guild Storehouse (E13, #100, docs/specs/E13-guild-buildings.md — "The
 * Granary: storage as a new optimization axis"): the guild-licensed Building
 * track (CONTEXT.md — Processing, "the two building tracks"). One
 * implementation, five guild variants (variant = accepted-goods filter +
 * skin) — E13 ships only the Granary (agrarian, grain-only); the permit and
 * placement machinery are generic over `GuildId` so the remaining four
 * variants are a data-only follow-up (explicit non-goal, spec).
 *
 * Construction follows the E14 Shipyard precedent (E13 spec, "Correction
 * 2026-07-19"): a commissioned Storehouse holds its OWN construction state
 * (`Company.guildBuild`, one at a time — the one-active-order law,
 * `commands.ts`'s `hasActiveBuildOrder`) and calls the shared
 * ConstructionSite engine (`building.ts`, #99), rather than a typed
 * target-kind union on `BuildOrder`. Once its Recipe completes, the pending
 * order clears and a `CompanyBuilding` is appended to `Company.buildings` —
 * the building's own `GoodsStore` starts empty; the gathered construction
 * materials are consumed, not carried over.
 */

/** Bill of materials for a Storehouse (tuning ≠ spec drift — the values are
 *  tuning; that a Storehouse is built via the Recipe pattern is spec). */
export const STOREHOUSE_RECIPE: Record<GoodId, number> = {
  grain: 40,
  textiles: 20,
  aetherSalt: 10,
  electronics: 8,
  timber: 6,
};

/** Flat labor fee charged up front when `commissionGuildBuilding` opens the
 *  Storehouse's construction site (tuning). */
export const STOREHOUSE_LABOR_FEE = 500;

/** Finite capacity of a Storehouse's own GoodsStore (spec — "an infinite
 *  buffer would kill the volatility the whole game runs on"; tuning). */
export const STOREHOUSE_CAPACITY = 200;

/** Guild rank required to hold the permit for this Building type (spec —
 *  "one settled contract arc away from enrollment"; tuning). */
export const STOREHOUSE_PERMIT_RANK = 2;

/** A commissioned-but-not-yet-activated guild Building: its own construction
 *  state (E14 Shipyard precedent — parallel holders, not a typed BuildOrder
 *  target-kind union), one per Company (the one-active-order law). `type` is
 *  a closed union of one today (Storehouse) — E15's Plant siting is free,
 *  not permit-gated, so it would be a different command/state, not a sibling
 *  case here. */
export interface GuildBuildOrder {
  readonly type: "storehouse";
  readonly variant: GuildId;
  readonly portId: PortId;
  readonly siteStore: GoodsStore;
}

/** An activated guild Building — CONTEXT.md: Storehouse. `store` is the
 *  building's own contents (a GoodsStore like any other, ADR-0008); its
 *  goods filter and STOREHOUSE_CAPACITY clamp live in its `StorePolicy`
 *  (`goodsStorePolicy.ts`), never as clamps here. */
export interface CompanyBuilding {
  readonly type: "storehouse";
  readonly variant: GuildId;
  readonly portId: PortId;
  readonly store: GoodsStore;
}

/** The Recipe for a pending guild Building's `type` — a lookup, not a stored
 *  field (the `refitRecipe`-live-recompute pattern), even though today's
 *  union has exactly one member; keeps the site-engine call sites future-
 *  proof for a second guild Building type. */
function recipeFor(type: GuildBuildOrder["type"]): Record<GoodId, number> {
  switch (type) {
    case "storehouse":
      return STOREHOUSE_RECIPE;
    default: {
      const exhaustive: never = type;
      throw new Error(`recipeFor: unhandled GuildBuildOrder type ${JSON.stringify(exhaustive)}`);
    }
  }
}

/** True iff `variant`'s guild rank (rankOf over its points, 0 if not
 *  enrolled) meets `STOREHOUSE_PERMIT_RANK` — the Building permit
 *  (CONTEXT.md). */
export function hasStorehousePermit(world: World, variant: GuildId): boolean {
  const points = world.company.guilds[variant]?.points ?? 0;
  return rankOf(points) >= STOREHOUSE_PERMIT_RANK;
}

/** True iff `portId` is a legal placement for a `variant` guild Building: a
 *  port of that guild's own archetype, or the Free port (spec —
 *  "Placement: geography with teeth"). `false` for an unknown port. */
export function isLegalStorehousePlacement(world: World, variant: GuildId, portId: PortId): boolean {
  const port = world.region.ports.find((p) => p.id === portId);
  if (!port) return false;
  return port.archetype === variant || port.archetype === "freeport";
}

/** Builds the `ConstructionSite` view of the Company's pending guild
 *  Building, or `null` with none pending. */
function activeGuildBuildSite(world: World): ConstructionSite | null {
  const order = world.company.guildBuild;
  if (!order) return null;
  return { recipe: recipeFor(order.type), siteStore: order.siteStore, portId: order.portId };
}

/** Pure preview of what `rushGuildBuild` (commands.ts) would buy right now.
 *  Empty with no pending order or an unfindable port — the
 *  `computeShipyardRushQuote` pattern. */
export function computeGuildBuildRushQuote(world: World): RushQuote {
  const site = activeGuildBuildSite(world);
  if (!site) return { lines: [], total: 0 };
  const port = world.region.ports.find((p) => p.id === site.portId);
  if (!port) return { lines: [], total: 0 };
  return quoteConstructionSiteRush(site, port, world.company.thalers);
}

/** Completes the pending guild Building when its Recipe fills: the order
 *  clears, a fresh `CompanyBuilding` (empty store) is appended to
 *  `Company.buildings`, and a `completed` Ledger event is appended — the
 *  Storehouse analog of `launchIfComplete`/`completeShipyardIfDone` (a
 *  launch is a ship; a building gets its own kind, spec §Ledger &
 *  netWorth). Pure; a no-op with nothing completable. */
export function completeGuildBuildIfDone(world: World): World {
  const order = world.company.guildBuild;
  const site = activeGuildBuildSite(world);
  if (!order || !site) return world;
  if (!isSiteComplete(site)) return world;

  const building: CompanyBuilding = {
    type: order.type,
    variant: order.variant,
    portId: order.portId,
    store: emptyStore(),
  };
  const completed: World = {
    ...world,
    company: {
      ...world.company,
      guildBuild: undefined,
      buildings: [...world.company.buildings, building],
    },
  };
  return appendLedgerEvent(completed, {
    kind: "completed",
    tick: world.tick,
    portId: order.portId,
    buildingType: order.type,
  });
}

/** Run one tick's auto-draw for the pending guild Building's construction
 *  site (after the docking phase, alongside the HQ/Shipyard/Refit auto-draw
 *  runners — same tick phase, same cap/cadence, drawing sequentially from
 *  the shared purse; `tick.ts` fixes the order). Attempts activation
 *  afterward. Pure; a no-op with nothing pending. */
export function runGuildBuildAutoDraw(world: World): World {
  const order = world.company.guildBuild;
  const site = activeGuildBuildSite(world);
  if (!order || !site) return world;

  const dayTick = world.tick % TICKS_PER_DAY;
  const cap = autoDrawCapForDayTick(dayTick);
  if (cap <= 0) return completeGuildBuildIfDone(world);

  const ports = [...world.region.ports];
  const portIdx = ports.findIndex((p) => p.id === order.portId);
  if (portIdx < 0) return world;

  const result = drawConstructionSite(site, ports[portIdx], world.company.thalers, cap, world.tick);
  ports[portIdx] = result.port;

  const drawn: World = {
    ...world,
    company: {
      ...world.company,
      thalers: result.thalers,
      guildBuild: { ...order, siteStore: result.siteStore },
    },
    region: { ...world.region, ports },
  };
  return completeGuildBuildIfDone(appendLedgerEvents(drawn, result.events));
}

/** The goods filter for a variant's Storehouse — its guild's domain good
 *  (spec — "one implementation, five guild variants (variant = accepted-
 *  goods filter + skin)"; E13 ships only the Granary's `[grain]`). */
export function storehouseFilter(variant: GuildId): readonly GoodId[] {
  return [GUILDS[variant].domain];
}
