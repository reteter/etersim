/**
 * Pure simulation module (ADR-0002). No React/DOM imports, no wall-clock
 * time, no non-deterministic randomness — ever. Enforced by ESLint
 * (see eslint.config.js override for `src/sim/**`).
 *
 * Public API of the sim; the UI imports from here only.
 */

export {
  createWorld,
  snapshotPrices,
  STARTING_HOLD,
  STARTING_THALERS,
  type Company,
  type World,
} from "./world";
export { applyCommand } from "./commands";
export { shortestRoute } from "./pathfinding";
export {
  advanceShip,
  cargoUsed,
  emptyCargo,
  etaTicks,
  routeTicks,
  type Ship,
  type ShipId,
  type ShipLocation,
  type Voyage,
} from "./ship";
export { GOOD_IDS, GOODS, type GoodDef, type GoodId } from "./goods";
export {
  ARCHETYPE_PROFILES,
  PORT_ARCHETYPES,
  TICKS_PER_DAY,
  type ArchetypeProfile,
  type Lane,
  type LaneId,
  type MarketGood,
  type Port,
  type PortArchetype,
  type PortId,
  type Region,
} from "./region";
export { HEARTLAND, type RegionTemplate } from "./template";
export { generateRegion } from "./worldgen";
export { tick, type Command } from "./tick";
export {
  marketTick,
  NEUTRAL_MODIFIERS,
  price,
  quoteBuy,
  quoteSell,
  STOCK_CAP_MULTIPLIER,
  type FlowModifiers,
} from "./market";
export {
  elapsedToTicks,
  MAX_TICKS_PER_CALL,
  MS_PER_TICK_AT_1X,
  SPEEDS,
  type Speed,
} from "./speed";
// RNG draw functions stay internal: the UI must never consume sim
// randomness outside tick() (ADR-0003). Only the state type leaks out,
// because World embeds it.
export type { RngState } from "./rng";
