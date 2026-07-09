import type { GoodId } from "./goods";

/** 1 tick = 1 world hour (ADR-0003); 24 ticks make a world day. Lives here
 *  because archetype flows are per-day and the market divides them down. */
export const TICKS_PER_DAY = 24;

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

/** Flat docking fee by archetype (E9). No debt: caller clamps to available thalers. */
export const DOCKING_FEE: Record<PortArchetype, number> = {
  urban: 20,
  industrial: 15,
  mining: 12,
  agrarian: 8,
  verdant: 5,
};

/**
 * How each archetype values each good relative to its global base price
 * (docs/specs/E8-living-economy.md — Per-archetype price bias): consumers
 * bias a good up, producers down, neutral goods sit at 1.0. Multiplied by a
 * per-port jitter in worldgen into `Port.priceBias`. Values are tuning, not
 * spec drift.
 */
export const ARCHETYPE_BIAS: Record<PortArchetype, Record<GoodId, number>> = {
  agrarian: { grain: 0.8, textiles: 1.2, aetherSalt: 1.15, electronics: 1.15, timber: 1.0 },
  industrial: { grain: 1.3, textiles: 1.0, aetherSalt: 1.25, electronics: 0.8, timber: 1.15 },
  urban: { grain: 1.35, textiles: 0.8, aetherSalt: 1.15, electronics: 1.2, timber: 1.2 },
  mining: { grain: 1.3, textiles: 1.15, aetherSalt: 0.8, electronics: 1.2, timber: 1.0 },
  verdant: { grain: 1.2, textiles: 1.2, aetherSalt: 1.0, electronics: 1.0, timber: 0.8 },
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
  /** Archetype bias × per-port jitter (E8); multiplies the good's global
   *  base price into this port's effective base. Drawn once in worldgen. */
  readonly priceBias: Record<GoodId, number>;
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
