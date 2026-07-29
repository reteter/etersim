import { OFFERS_PER_GUILD_MAX, STARTING_HOLD, type World } from "../src/sim/index.ts";

/**
 * Runtime invariant checks for the World state (#234 — world-model
 * implications). Checked at every day boundary inside `runBatchRun`
 * (`harness/batch.ts`) when a Run is started with `{ enableAssertions:
 * true }`, to catch anomalies in real Runs.
 *
 * `checkInvariants` is pure: takes `world`, returns violation reasons, no
 * day context, no side effects, no RNG. `dedupeViolationsByDay` below is
 * what turns a day-ordered stream of occurrences into the deduped, day
 * -stamped list `runBatchRun` returns — so a persistent invariant violation
 * doesn't emit one entry per day.
 */

/**
 * Desperation clause invariant (issue #226, grill lock 2026-07-15):
 * every guild with ≥1 open offer must have min(requiredRank) === 1.
 *
 * Reads from `world.contractOffers`, which is a flat array of ContractOffer
 * objects each carrying a `guildId` and `requiredRank`. Groups by guildId,
 * checks the minimum requiredRank in each group.
 */
function checkDesperationClause(world: World): string | null {
  if (world.contractOffers.length === 0) return null;

  // Group offers by guildId and compute min requiredRank per guild.
  const offersByGuild = new Map<string, number[]>();
  for (const offer of world.contractOffers) {
    const ranks = offersByGuild.get(offer.guildId) ?? [];
    ranks.push(offer.requiredRank);
    offersByGuild.set(offer.guildId, ranks);
  }

  // Check each guild: if it has open offers, min(requiredRank) must be 1.
  for (const [guildId, ranks] of offersByGuild) {
    const minRank = Math.min(...ranks);
    if (minRank !== 1) {
      return (
        `Desperation clause violation: guild "${guildId}" has ${ranks.length} open offer(s) ` +
        `but min(requiredRank) = ${minRank}, not 1. Offers: ${world.contractOffers
          .filter((o) => o.guildId === guildId)
          .map((o) => `${o.id}(rank=${o.requiredRank})`)
          .join(", ")}`
      );
    }
  }

  return null;
}

/**
 * Contract offer cap invariant: no guild has more than OFFERS_PER_GUILD_MAX
 * open offers at once. This is enforced during `refreshContractOffers`, so
 * a violation here indicates a breach of that generation logic.
 */
function checkOfferCap(world: World): string | null {
  const offerCountByGuild = new Map<string, number>();
  for (const offer of world.contractOffers) {
    offerCountByGuild.set(offer.guildId, (offerCountByGuild.get(offer.guildId) ?? 0) + 1);
  }

  for (const [guildId, count] of offerCountByGuild) {
    if (count > OFFERS_PER_GUILD_MAX) {
      return `Offer cap violation: guild "${guildId}" has ${count} open offers, exceeds ${OFFERS_PER_GUILD_MAX}`;
    }
  }

  return null;
}

/**
 * Offer ID uniqueness: every open offer's ID is unique. This enforces the
 * structural invariant from contract.ts's ContractOffer.id doc comment.
 */
function checkOfferIdUniqueness(world: World): string | null {
  const seen = new Set<string>();
  for (const offer of world.contractOffers) {
    if (seen.has(offer.id)) {
      return `Offer ID uniqueness violation: duplicate offer ID "${offer.id}"`;
    }
    seen.add(offer.id);
  }
  return null;
}

/**
 * Tier range invariant: every offer's tier is in [1, 4]. This is enforced
 * during generation by bandTier, but a runtime check guards against
 * corruption.
 */
function checkTierRange(world: World): string | null {
  for (const offer of world.contractOffers) {
    if (offer.tier < 1 || offer.tier > 4) {
      return (
        `Tier range violation: offer "${offer.id}" has tier ${offer.tier}, ` +
        `must be in [1, 4]`
      );
    }
  }
  return null;
}

/**
 * Required-rank range invariant: every offer's requiredRank is in [1, 4].
 * The desperation clause can set it to 1; otherwise it mirrors tier. A
 * violation indicates a stamp/generation bug.
 */
function checkRequiredRankRange(world: World): string | null {
  for (const offer of world.contractOffers) {
    if (offer.requiredRank < 1 || offer.requiredRank > 4) {
      return (
        `RequiredRank range violation: offer "${offer.id}" has requiredRank ${offer.requiredRank}, ` +
        `must be in [1, 4]`
      );
    }
  }
  return null;
}

/** The offer-generation slack (`src/sim/contract.ts`'s
 *  `refreshContractOffers`: `quotaPerPeriod = Math.floor(0.7 * expectedTrips
 *  * referenceHold)`) — a bare literal there, not an exported constant, so
 *  it is restated here rather than imported. If that literal ever moves,
 *  this invariant needs the same edit (no single source of truth to import
 *  from today). */
const OFFER_QUOTA_SLACK = 0.7;

/**
 * Haulability invariant (issues #93/#98, `src/sim/contract.test.ts`'s
 * feasibility property + `src/sim/e3-guardrails.test.ts`'s broader-seed
 * version — AC1 of #234's "invariants from both e3-guardrails.test.ts and
 * contract.test.ts"): every contract offer must be haulable by a
 * reference-capacity (`STARTING_HOLD`) ship — at least 2 round trips inside
 * the period, and a quota that fits the 0.7-slack budget those trips give a
 * `STARTING_HOLD`-hold ship. Both fields already sit on the offer itself
 * (`basis.expectedTrips`, `quotaPerPeriod`), so — unlike the property test
 * this mirrors — this is cheaply checkable from `World` state alone at a
 * day boundary, no fleet simulation required.
 */
function checkOfferHaulability(world: World): string | null {
  for (const offer of world.contractOffers) {
    if (offer.basis.expectedTrips < 2) {
      return (
        `Haulability violation: offer "${offer.id}" has expectedTrips=${offer.basis.expectedTrips}, ` +
        `must be >= 2 round trips inside the period`
      );
    }
    const maxQuota = Math.floor(OFFER_QUOTA_SLACK * offer.basis.expectedTrips * STARTING_HOLD);
    if (offer.quotaPerPeriod > maxQuota) {
      return (
        `Haulability violation: offer "${offer.id}" has quotaPerPeriod=${offer.quotaPerPeriod}, ` +
        `exceeds ${maxQuota} (${OFFER_QUOTA_SLACK} × expectedTrips × ${STARTING_HOLD}-hold reference ship)`
      );
    }
  }
  return null;
}

/**
 * Runs all invariant checks and returns a list of violation reasons for
 * `world` — no day context baked in here. Called at every day boundary in
 * `runBatchRun`, which attaches the day itself (see `dedupeViolationsByDay`
 * below); keeping the day out of this function's output is what lets the
 * caller dedupe a persistent violation by its reason alone, rather than by a
 * `Day N: reason` string that never matches itself across two different
 * days (incident-shaped bug this replaces: a violation present on every day
 * used to produce one anomaly entry *per day* instead of one entry total).
 *
 * Returns empty array if all checks pass.
 */
export function checkInvariants(world: World): readonly string[] {
  const checks: ((w: World) => string | null)[] = [
    checkDesperationClause,
    checkOfferCap,
    checkOfferIdUniqueness,
    checkTierRange,
    checkRequiredRankRange,
    checkOfferHaulability,
  ];

  const reasons: string[] = [];
  for (const check of checks) {
    const violation = check(world);
    if (violation !== null) {
      reasons.push(violation);
    }
  }

  return reasons;
}

/** One invariant-check occurrence: `reason` (from `checkInvariants`, no day
 *  prefix) observed on world-day `day`. */
export interface ViolationOccurrence {
  readonly day: number;
  readonly reason: string;
}

/**
 * Dedupes a day-ordered list of violation occurrences by `reason` alone,
 * keeping only the first day each distinct reason appeared, and formatting
 * the final `Day N: reason` string **after** dedup — so a violation present
 * on every day of a Run produces exactly one anomaly entry (at the day it
 * first appeared), not one entry per day.
 */
export function dedupeViolationsByDay(occurrences: readonly ViolationOccurrence[]): readonly string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const { day, reason } of occurrences) {
    if (seen.has(reason)) continue;
    seen.add(reason);
    out.push(`Day ${day}: ${reason}`);
  }
  return out;
}
