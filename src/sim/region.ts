import type { GoodId } from "./goods";

/**
 * Region model (docs/specs/E2-trade-loop.md — Ports & archetypes). Types
 * only; worldgen (#11) fills the values, market rules (#12) move them.
 */

export type PortId = string;
export type LaneId = string;

export type PortArchetype = "agrarian" | "industrial" | "urban" | "mining" | "verdant";

/** Canonical iteration order (determinism: never iterate object keys). */
export const PORT_ARCHETYPES: readonly PortArchetype[] = [
  "agrarian",
  "industrial",
  "urban",
  "mining",
  "verdant",
];

/**
 * An archetype's economic profile as net flows per world day — exact
 * integers, the unit the spec's balance table uses. The market tick divides
 * by TICKS_PER_DAY. A good appears in production or consumption, never both.
 */
export interface ArchetypeProfile {
  readonly productionPerDay: Partial<Record<GoodId, number>>;
  readonly consumptionPerDay: Partial<Record<GoodId, number>>;
}

/** Initial balance per the spec table; tuning these is not spec drift. */
export const ARCHETYPE_PROFILES: Record<PortArchetype, ArchetypeProfile> = {
  agrarian: {
    productionPerDay: { grain: 96 },
    consumptionPerDay: { textiles: 6, electronics: 2, aetherSalt: 4 },
  },
  industrial: {
    productionPerDay: { electronics: 12 },
    consumptionPerDay: { grain: 24, aetherSalt: 8, timber: 2 },
  },
  urban: {
    productionPerDay: { textiles: 24 },
    consumptionPerDay: { grain: 30, electronics: 4, timber: 3, aetherSalt: 4 },
  },
  mining: {
    productionPerDay: { aetherSalt: 20 },
    consumptionPerDay: { grain: 18, textiles: 4, electronics: 3 },
  },
  verdant: {
    productionPerDay: { timber: 6 },
    consumptionPerDay: { grain: 12, textiles: 5 },
  },
};

/** Per-good market state at one port. */
export interface MarketGood {
  readonly stock: number;
  /** Stock level at which price equals basePrice; cap is 4× this. */
  readonly equilibrium: number;
}

export interface Port {
  readonly id: PortId;
  readonly name: string;
  readonly archetype: PortArchetype;
  /** Position on the unit plane (worldgen), used by the map and lane lengths. */
  readonly x: number;
  readonly y: number;
  readonly market: Record<GoodId, MarketGood>;
}

/** Undirected edge of the region graph. */
export interface Lane {
  readonly id: LaneId;
  readonly a: PortId;
  readonly b: PortId;
  /** Voyage duration in ticks; also the pathfinding edge weight. */
  readonly voyageTicks: number;
}

export interface Region {
  readonly ports: readonly Port[];
  readonly lanes: readonly Lane[];
}
