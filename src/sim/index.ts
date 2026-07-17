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
export { applyCommand, MAX_SHIP_NAME_LENGTH } from "./commands";
export { shortestCourse } from "./pathfinding";
export {
  advanceShip,
  cargoUsed,
  emptyCargo,
  etaTicks,
  courseTicks,
  isRouteActive,
  type Ship,
  type ShipAssignment,
  type ShipId,
  type ShipLocation,
  type Voyage,
} from "./ship";
export { GOOD_IDS, GOODS, type GoodDef, type GoodId } from "./goods";
export {
  ARCHETYPE_PROFILES,
  DOCKING_FEE,
  ECONOMIC_ARCHETYPES,
  PORT_ARCHETYPES,
  TICKS_PER_DAY,
  type ArchetypeProfile,
  type EconomicArchetype,
  type Lane,
  type LaneId,
  type MarketGood,
  type Port,
  type PortArchetype,
  type PortId,
  type Region,
} from "./region";
export { type Route, type RouteId, type Stop, type StopOrder } from "./route";
export {
  AUTO_DRAW_PER_DAY,
  computeBuildEstimate,
  computeRushQuote,
  CONSTRUCTION_RESERVE,
  generateShipName,
  HEADQUARTERS_COST,
  LABOR_FEE,
  remainingNeed,
  SHIP_RECIPE,
  siteRemainingNeed,
  type BuildEstimate,
  type BuildEstimateLine,
  type BuildOrder,
  type ConstructionSite,
  type Headquarters,
  type RushQuote,
  type RushQuoteLine,
} from "./building";
// E14 (#276, PortPanel Shipyard section + map refit bubble + status — UI):
// the Shipyard/Refit domain seams (#275) plus `siteRemainingNeed`/
// `ConstructionSite` above (the #99 generic engine, used to derive a stall
// reason for the Shipyard's own site and the Refit site the same way
// `headquartersStall.ts` derives one for the HQ build) and `estimateBuy`
// below (market.ts, the `computeBuildEstimate` pattern generalized to any
// recipe/port pair) — none of these were re-exported from the barrel yet
// (a separate barrel-cleanup issue is open); this UI-only pass adds pure
// re-export lines only, per the task package's scope exception.
export {
  computeRefitRushQuote,
  computeShipyardRushQuote,
  isShipyardUnderConstruction,
  isUnderRefit,
  nextHoldStep,
  refitRecipe,
  REFIT_LABOR_FEE,
  SHIPYARD_LABOR_FEE,
  SHIPYARD_RECIPE,
  type RefitOrder,
  type Shipyard,
} from "./shipyard";
export { HEARTLAND, type RegionTemplate } from "./template";
export { generateRegion } from "./worldgen";
export { tick, type Command } from "./tick";
export {
  computeNetWorth,
  regionAverageMid,
  type LedgerEvent,
  type NetWorthBreakdown,
} from "./ledger";
export {
  refreshContractOffers,
  type ActiveContract,
  type ContractOffer,
  type ContractOfferBasis,
} from "./contract";
// E3 (#96/#97, docs/specs/E3-contracts-and-guilds.md — Store & UI): the
// Kontrakty tab and the PortPanel guildhouse section both need the guild
// domain model — the barrel had no guild.ts re-export at all until this wave.
export {
  ENROLLMENT_FEE,
  GUILDS,
  OFFERS_PER_GUILD_MAX,
  POINTS_BREACH_OR_RESIGN,
  POINTS_MISSED,
  POINTS_SETTLED,
  RANK_THRESHOLDS,
  rankOf,
  SHORTAGE_THRESHOLD,
  UPKEEP_PER_DAY,
  type GuildDef,
  type GuildId,
} from "./guild";
export {
  OSMOSIS_CAP,
  OSMOSIS_DEADBAND,
  OSMOSIS_RATE,
  osmosisTick,
  type OsmosisResult,
} from "./osmosis";
// ARCHETYPE_BIAS and SPREAD stay internal until a UI consumer exists
// (quotes already carry the spread; the bias is baked into priceBias).
export {
  effectiveBase,
  estimateBuy,
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
