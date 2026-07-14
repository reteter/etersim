import type { GoodId } from "./goods";
import type { EconomicArchetype } from "./region";

/**
 * Guild state (CONTEXT.md — Guilds & contracts; docs/specs/E3-contracts-and-guilds.md
 * — Design: Guilds / Enrollment / Ranks). Guilds are institutions, not agents
 * (E8 no-agent decision extends): one guild per producing archetype, never at
 * the Free port — `EconomicArchetype` is the five-archetype worldgen pool
 * split from `PortArchetype` in E12.
 */
export type GuildId = EconomicArchetype;

/** A guild's working name and domain good — the good its archetype produces
 *  (matches `ARCHETYPE_PROFILES` production; region.ts). */
export interface GuildDef {
  readonly name: string;
  readonly domain: GoodId;
}

/** Five guilds, per the spec's working-name table. Tuning the names is not
 *  spec drift; the archetype/domain pairing is. */
export const GUILDS: Record<GuildId, GuildDef> = {
  agrarian: { name: "Granary Guild", domain: "grain" },
  urban: { name: "Weavers' Assembly", domain: "textiles" },
  mining: { name: "Saltworkers' Brotherhood", domain: "aetherSalt" },
  industrial: { name: "Foundry League", domain: "electronics" },
  verdant: { name: "Livingwood Consortium", domain: "timber" },
};

/** One-time paperwork cost to enroll in a guild (spec: Enrollment). Not
 *  Reserve-gated — the Reserve covers construction spend and standing costs
 *  only (docs/specs/E3-contracts-and-guilds.md — Upkeep). */
export const ENROLLMENT_FEE = 400;

/** Flat daily fee per ship (spec: Upkeep), charged at the day boundary
 *  (tick.ts, `chargeUpkeep`). Reserve-gated: the charge never takes the purse
 *  below `CONSTRUCTION_RESERVE` (building.ts) — the unpaid remainder simply
 *  evaporates, no debt, no arrears (docs/specs/E3-contracts-and-guilds.md —
 *  Upkeep; the 2026-07-14 grill's agency guarantee). */
export const UPKEEP_PER_DAY = 10;

/** Progress-point deltas (spec: Ranks — settled/missed period, breach or
 *  resignation). Consumed by later issues (contract settlement); named here
 *  so the constants have one home. */
export const POINTS_SETTLED = 1;
export const POINTS_MISSED = -1;
export const POINTS_BREACH_OR_RESIGN = -3;

/** Rank thresholds (spec: Ranks — four steps, discrete on purpose). Rank is
 *  always derived from points via `rankOf`, never stored. */
export const RANK_THRESHOLDS: readonly [number, number, number, number] = [0, 4, 10, 18];

/** Derives rank 1-4 from (floored-at-0) progress points, per
 *  `RANK_THRESHOLDS`. Points below 0 clamp to rank 1 — `rankOf` never
 *  assumes its caller already floored. */
export function rankOf(points: number): number {
  const floored = Math.max(0, points);
  let rank = 1;
  for (let i = 1; i < RANK_THRESHOLDS.length; i++) {
    if (floored >= RANK_THRESHOLDS[i]) rank = i + 1;
  }
  return rank;
}
