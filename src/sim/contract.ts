import { GOOD_IDS, type GoodId } from "./goods";
import {
  OFFERS_PER_GUILD_MAX,
  POINTS_BREACH_OR_RESIGN,
  POINTS_MISSED,
  POINTS_SETTLED,
  SHORTAGE_THRESHOLD,
  type GuildId,
} from "./guild";
import { appendLedgerEvent } from "./ledger";
import { effectiveBase, price } from "./market";
import { ARCHETYPE_PROFILES, ECONOMIC_ARCHETYPES, TICKS_PER_DAY, type PortId, type Region } from "./region";
import { shortestCourse } from "./pathfinding";
import type { World } from "./world";

/**
 * Contract offer generation (CONTEXT.md — Contract, Settlement period;
 * docs/specs/E3-contracts-and-guilds.md — Design: Contracts; Tech: Contracts).
 * A guild's board reads real shortages and sizes an offer from real geometry
 * so it is feasible by construction — the offer shows its own arithmetic
 * (`basis`) rather than a dice roll. No Commands, no settlement logic, no UI
 * here (issue #94's scope): this module only generates and causally expires
 * offers as a pure function of world state.
 */

/** The arithmetic behind an offer's numbers — the player sees the guild's
 *  reasoning, not a black box (spec: Contracts — "shows its own basis"). */
export interface ContractOfferBasis {
  readonly sourcePortId: PortId;
  readonly roundTripTicks: number;
  readonly expectedTrips: number;
}

/**
 * A Contract offer the Company has accepted (docs/specs/E3-contracts-and-guilds.md
 * — Tech: Contracts): the offer's fields plus the lifecycle state that
 * fulfilment/settlement mutate. `startTick` anchors period boundaries —
 * `periodEndTick` (this module) derives each period's settlement tick from it,
 * never re-measured from a day-boundary-aligned clock, so accepting mid-day
 * still settles on schedule.
 */
export interface ActiveContract extends ContractOffer {
  readonly startTick: number;
  readonly periodIndex: number;
  readonly deliveredThisPeriod: number;
  readonly consecutiveMisses: number;
}

/** The tick at which `contract`'s *current* period (its `periodIndex`) settles. */
function periodEndTick(contract: ActiveContract): number {
  return contract.startTick + (contract.periodIndex + 1) * contract.periodDays * TICKS_PER_DAY;
}

export interface ContractOffer {
  /** Deterministic and structural: `${guildId}:${portId}:${good}` — this
   *  shape alone enforces "never two open offers for the same (good, port)"
   *  within a guild; cross-guild collisions can't occur (a port belongs to
   *  exactly one archetype/guild). */
  readonly id: string;
  readonly guildId: GuildId;
  readonly portId: PortId;
  readonly good: GoodId;
  readonly quotaPerPeriod: number;
  readonly periodDays: number;
  readonly minPeriods: number;
  readonly feePerPeriod: number;
  /** 1 (nearest/shortest) – 4 (furthest/longest), banded from
   *  `basis.roundTripTicks` (`bandTier`). */
  readonly tier: number;
  readonly basis: ContractOfferBasis;
}

/** Tier bands over round-trip ticks (tuning ≠ spec drift — flagged in the
 *  #93 completion report): derived from an empirical sample of
 *  `shortestCourse` round trips across HEARTLAND-generated regions (seeds 1,
 *  7, 42, 99 — roughly the quartile breaks of that sample), not invented
 *  constants. Re-derive if worldgen's lane-length distribution changes. */
const TIER_BAND_1_MAX = 90;
const TIER_BAND_2_MAX = 130;
const TIER_BAND_3_MAX = 175;

function bandTier(roundTripTicks: number): number {
  if (roundTripTicks <= TIER_BAND_1_MAX) return 1;
  if (roundTripTicks <= TIER_BAND_2_MAX) return 2;
  if (roundTripTicks <= TIER_BAND_3_MAX) return 3;
  return 4;
}

/** Flat guild fee per unit of quota, scaled by tier (tuning ≠ spec drift —
 *  flagged): higher tiers "last longer, pay better" per the spec's Contracts
 *  design note. Index 0 = tier 1. */
const FEE_PER_UNIT_BY_TIER: readonly number[] = [1.5, 2, 2.5, 3];

/** Settlement periods required before the contract can be resigned/expires
 *  naturally at term (tuning ≠ spec drift — flagged): higher tiers commit
 *  longer, mirroring "the bet against the living market gets genuinely
 *  riskier" (spec — Contracts). */
function minPeriodsForTier(tier: number): number {
  return 2 + tier;
}

interface SourceCandidate {
  readonly portId: PortId;
  readonly roundTripTicks: number;
}

/**
 * Nearest viable source of `good` for a shortage at `targetPortId`: a
 * net-producer of the good wins over any non-producer regardless of
 * distance; among ports of the same producer/non-producer standing, the
 * shortest round trip wins, ties broken by the cheapest ask, final ties by
 * `region.ports` canonical order (the loop below only ever replaces `best` on
 * a strict improvement, so the first-seen port in iteration order survives
 * an exact tie) — never the RNG (spec: Contracts — "feasible by
 * construction"; #93 completion report flags this precedence as a judgment
 * call: the spec's "net-producer or cheapest ask" phrasing doesn't itself
 * order the two, this reading treats "or" as a producer-first fallback).
 * Returns null when `good` is unreachable from every other port (an
 * infeasible shortage generates no offer).
 */
function pickSource(region: Region, targetPortId: PortId, good: GoodId): SourceCandidate | null {
  let best: (SourceCandidate & { isProducer: boolean; ask: number }) | null = null;

  for (const candidate of region.ports) {
    if (candidate.id === targetPortId) continue;
    const course = shortestCourse(region, candidate.id, targetPortId);
    if (course === null) continue;

    let oneWayTicks = 0;
    for (const voyage of course) {
      oneWayTicks += region.lanes.find((l) => l.id === voyage.laneId)!.voyageTicks;
    }
    const roundTripTicks = oneWayTicks * 2;
    const isProducer = (ARCHETYPE_PROFILES[candidate.archetype].productionPerDay[good] ?? 0) > 0;
    const ask = price(candidate.market[good], effectiveBase(candidate, good));

    if (best === null) {
      best = { portId: candidate.id, roundTripTicks, isProducer, ask };
      continue;
    }
    if (isProducer && !best.isProducer) {
      best = { portId: candidate.id, roundTripTicks, isProducer, ask };
      continue;
    }
    if (isProducer !== best.isProducer) continue; // non-producer never displaces a producer
    if (roundTripTicks < best.roundTripTicks) {
      best = { portId: candidate.id, roundTripTicks, isProducer, ask };
      continue;
    }
    if (roundTripTicks === best.roundTripTicks && ask < best.ask) {
      best = { portId: candidate.id, roundTripTicks, isProducer, ask };
    }
  }

  return best === null ? null : { portId: best.portId, roundTripTicks: best.roundTripTicks };
}

/**
 * One day boundary's worth of Contract board maintenance: causal expiry of
 * offers whose shortage healed, then fresh generation for every
 * still-qualifying (guild, port, good) shortage not already covered, capped
 * at `OFFERS_PER_GUILD_MAX` per guild and selected by largest shortfall first
 * (canonical port/good order breaks ties) — deterministic by construction,
 * never the RNG (docs/specs/E3-contracts-and-guilds.md — Contracts). Pure
 * function of `(region, existingOffers, referenceHold)`: same inputs always
 * produce the same offer set (ADR-0003).
 */
export function refreshContractOffers(
  region: Region,
  existingOffers: readonly ContractOffer[],
  referenceHold: number,
): readonly ContractOffer[] {
  const survivors = existingOffers.filter((offer) => {
    const port = region.ports.find((p) => p.id === offer.portId);
    if (!port) return false;
    const entry = port.market[offer.good];
    return entry.stock < SHORTAGE_THRESHOLD * entry.equilibrium;
  });

  const result: ContractOffer[] = [...survivors];
  const openCountByGuild = new Map<GuildId, number>();
  for (const offer of survivors) {
    openCountByGuild.set(offer.guildId, (openCountByGuild.get(offer.guildId) ?? 0) + 1);
  }

  for (const guildId of ECONOMIC_ARCHETYPES) {
    let slots = OFFERS_PER_GUILD_MAX - (openCountByGuild.get(guildId) ?? 0);
    if (slots <= 0) continue;

    const candidates: Array<{ offer: ContractOffer; shortfall: number }> = [];
    for (const port of region.ports) {
      if (port.archetype !== guildId) continue;
      for (const good of GOOD_IDS) {
        const entry = port.market[good];
        const shortageLine = SHORTAGE_THRESHOLD * entry.equilibrium;
        if (entry.stock >= shortageLine) continue;
        if (result.some((o) => o.portId === port.id && o.good === good)) continue;

        const source = pickSource(region, port.id, good);
        if (source === null) continue; // no reachable source: not feasible

        const roundTripDays = source.roundTripTicks / TICKS_PER_DAY;
        const periodDays = Math.ceil(2 * roundTripDays);
        const expectedTrips = Math.floor((periodDays * TICKS_PER_DAY) / source.roundTripTicks);
        const quotaPerPeriod = Math.floor(0.7 * expectedTrips * referenceHold);
        const tier = bandTier(source.roundTripTicks);
        const feePerPeriod = Math.round(quotaPerPeriod * FEE_PER_UNIT_BY_TIER[tier - 1]);

        candidates.push({
          offer: {
            id: `${guildId}:${port.id}:${good}`,
            guildId,
            portId: port.id,
            good,
            quotaPerPeriod,
            periodDays,
            minPeriods: minPeriodsForTier(tier),
            feePerPeriod,
            tier,
            basis: { sourcePortId: source.portId, roundTripTicks: source.roundTripTicks, expectedTrips },
          },
          shortfall: shortageLine - entry.stock,
        });
      }
    }

    // Largest shortfall first; Array.sort is stable, so ties keep the
    // canonical (port, good) iteration order above — never the RNG.
    candidates.sort((a, b) => b.shortfall - a.shortfall);
    for (const candidate of candidates) {
      if (slots <= 0) break;
      result.push(candidate.offer);
      slots--;
    }
  }

  return result;
}

/** Applies one contract's settlement outcome (met, missed, or breached — a
 *  second consecutive miss) to `world`, returning the mutated world and the
 *  survivor (undefined on breach termination). Guild points are read fresh
 *  from `world` each call so two contracts of the same guild settling in the
 *  same boundary compound correctly, in `company.contracts` array order
 *  (deterministic, no RNG). */
function settleOne(world: World, contract: ActiveContract): [World, ActiveContract | undefined] {
  const met = contract.deliveredThisPeriod >= contract.quotaPerPeriod;
  const points = world.company.guilds[contract.guildId]?.points ?? 0;

  if (met) {
    const nextPoints = Math.max(0, points + POINTS_SETTLED);
    let w: World = {
      ...world,
      company: {
        ...world.company,
        thalers: world.company.thalers + contract.feePerPeriod,
        guilds: { ...world.company.guilds, [contract.guildId]: { points: nextPoints } },
      },
    };
    w = appendLedgerEvent(w, {
      kind: "contractFee",
      tick: w.tick,
      guildId: contract.guildId,
      contractId: contract.id,
      thalers: contract.feePerPeriod,
    });
    w = appendLedgerEvent(w, {
      kind: "settlement",
      tick: w.tick,
      contractId: contract.id,
      guildId: contract.guildId,
      outcome: "met",
      pointsDelta: POINTS_SETTLED,
    });
    return [
      w,
      { ...contract, periodIndex: contract.periodIndex + 1, deliveredThisPeriod: 0, consecutiveMisses: 0 },
    ];
  }

  const consecutiveMisses = contract.consecutiveMisses + 1;
  if (consecutiveMisses >= 2) {
    // Breach: the guild terminates the contract (CONTEXT.md — Settlement
    // period, "large rank hit"). The breach penalty REPLACES this period's
    // miss penalty (owner decision — parity with resignContract's same -3
    // cost, not additive): exactly one `settlement` event, outcome
    // "breached", for the full POINTS_BREACH_OR_RESIGN delta — never a
    // "missed" event plus a second silent hit.
    const breachPoints = Math.max(0, points + POINTS_BREACH_OR_RESIGN);
    let w: World = {
      ...world,
      company: {
        ...world.company,
        guilds: { ...world.company.guilds, [contract.guildId]: { points: breachPoints } },
      },
    };
    w = appendLedgerEvent(w, {
      kind: "settlement",
      tick: w.tick,
      contractId: contract.id,
      guildId: contract.guildId,
      outcome: "breached",
      pointsDelta: POINTS_BREACH_OR_RESIGN,
    });
    return [w, undefined];
  }

  const missedPoints = Math.max(0, points + POINTS_MISSED);
  let w: World = {
    ...world,
    company: {
      ...world.company,
      guilds: { ...world.company.guilds, [contract.guildId]: { points: missedPoints } },
    },
  };
  w = appendLedgerEvent(w, {
    kind: "settlement",
    tick: w.tick,
    contractId: contract.id,
    guildId: contract.guildId,
    outcome: "missed",
    pointsDelta: POINTS_MISSED,
  });

  return [
    w,
    { ...contract, periodIndex: contract.periodIndex + 1, deliveredThisPeriod: 0, consecutiveMisses },
  ];
}

/**
 * Contract settlement phase (#94, docs/specs/E3-contracts-and-guilds.md —
 * Fulfilment and settlement; Tick day-boundary order): every active contract
 * whose current period has reached its end tick is settled — quota met pays
 * `feePerPeriod` and +1 rank point (Ledger `contractFee` + `settlement`);
 * missed pays nothing and −1 point (`settlement` only, so a missed period
 * still leaves an audit trace). A second *consecutive* miss breaches the
 * contract (guild-terminated, an additional −3) and it drops out of
 * `company.contracts`. Runs in `company.contracts` array order — deterministic,
 * no RNG (ADR-0003). A no-op contract (period not yet due) survives untouched.
 */
export function settleContracts(world: World): World {
  let w = world;
  const survivors: ActiveContract[] = [];
  for (const contract of world.company.contracts) {
    if (w.tick < periodEndTick(contract)) {
      survivors.push(contract);
      continue;
    }
    const [next, survivor] = settleOne(w, contract);
    w = next;
    if (survivor) survivors.push(survivor);
  }
  return { ...w, company: { ...w.company, contracts: survivors } };
}
