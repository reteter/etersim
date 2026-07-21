import {
  applyRushQuoteToSite,
  autoDrawCapForDayTick,
  commissionBuilding,
  drawConstructionSite,
  isSiteComplete,
  quoteConstructionSiteRush,
  type ConstructionSite,
  type RushQuote,
} from "./building";
import type { GoodId } from "./goods";
import { emptyStore, type GoodsStore } from "./goodsStore";
import type { StorePolicy } from "./goodsStorePolicy";
import { GUILDS, type GuildId } from "./guild";
import { appendLedgerEvent, appendLedgerEvents } from "./ledger";
import { TICKS_PER_DAY, type PortId } from "./region";
import type { World } from "./world";

export type GuildBuildingType = "storehouse";

export interface CompanyBuilding {
  readonly type: "storehouse";
  readonly variant: GuildId;
  readonly portId: PortId;
  readonly store: GoodsStore;
}

export interface GuildBuildOrder {
  readonly type: "storehouse";
  readonly variant: GuildId;
  readonly portId: PortId;
  readonly siteStore: GoodsStore;
}

export const STOREHOUSE_RECIPE: Record<GoodId, number> = {
  grain: 40,
  textiles: 20,
  aetherSalt: 10,
  electronics: 8,
  timber: 6,
};

export const STOREHOUSE_LABOR_FEE = 500;
export const STOREHOUSE_CAPACITY = 200;
export const STOREHOUSE_PERMIT_RANK = 2;
export const GRANARY_VARIANT: GuildId = "agrarian";

export function storehousePolicy(variant: GuildId): StorePolicy {
  return {
    kind: "storehouse",
    filter: [GUILDS[variant].domain],
    capacity: STOREHOUSE_CAPACITY,
  };
}

export function activeGuildBuildSite(world: World): ConstructionSite | null {
  const order = world.company.guildBuildOrder;
  if (!order) return null;
  return { recipe: STOREHOUSE_RECIPE, siteStore: order.siteStore, portId: order.portId };
}

export function computeGuildBuildRushQuote(world: World): RushQuote {
  const site = activeGuildBuildSite(world);
  if (!site) return { lines: [], total: 0 };
  const port = world.region.ports.find((candidate) => candidate.id === site.portId);
  if (!port) return { lines: [], total: 0 };
  return quoteConstructionSiteRush(site, port, world.company.thalers);
}

export function completeGuildBuildingIfDone(world: World): World {
  const order = world.company.guildBuildOrder;
  const site = activeGuildBuildSite(world);
  if (!order || !site || !isSiteComplete(site)) return world;
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
      guildBuildOrder: undefined,
      buildings: [...world.company.buildings, building],
    },
  };
  return appendLedgerEvent(completed, {
    kind: "completed",
    tick: world.tick,
    type: order.type,
    variant: order.variant,
    portId: order.portId,
  });
}

export function runGuildBuildAutoDraw(world: World): World {
  const order = world.company.guildBuildOrder;
  const site = activeGuildBuildSite(world);
  if (!order || !site) return world;
  const cap = autoDrawCapForDayTick(world.tick % TICKS_PER_DAY);
  if (cap <= 0) return completeGuildBuildingIfDone(world);
  const portIndex = world.region.ports.findIndex((port) => port.id === order.portId);
  if (portIndex < 0) return world;
  const ports = [...world.region.ports];
  const result = drawConstructionSite(site, ports[portIndex], world.company.thalers, cap, world.tick);
  ports[portIndex] = result.port;
  const drawn: World = {
    ...world,
    company: {
      ...world.company,
      thalers: result.thalers,
      guildBuildOrder: { ...order, siteStore: result.siteStore },
    },
    region: { ...world.region, ports },
  };
  return completeGuildBuildingIfDone(appendLedgerEvents(drawn, result.events));
}

export function applyGuildBuildRush(world: World): World {
  const order = world.company.guildBuildOrder;
  const site = activeGuildBuildSite(world);
  if (!order || !site) return world;
  const portIndex = world.region.ports.findIndex((port) => port.id === order.portId);
  if (portIndex < 0) return world;
  const quote = computeGuildBuildRushQuote(world);
  if (quote.lines.length === 0) return completeGuildBuildingIfDone(world);
  const result = applyRushQuoteToSite(
    site,
    world.region.ports[portIndex],
    world.company.thalers,
    quote,
    world.tick,
  );
  const ports = [...world.region.ports];
  ports[portIndex] = result.port;
  const rushed: World = {
    ...world,
    company: {
      ...world.company,
      thalers: result.thalers,
      guildBuildOrder: { ...order, siteStore: result.siteStore },
    },
    region: { ...world.region, ports },
  };
  return completeGuildBuildingIfDone(appendLedgerEvents(rushed, result.events));
}

export const commissionGuildBuildingSite = commissionBuilding;
