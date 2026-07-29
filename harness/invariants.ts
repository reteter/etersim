import type { World } from "../src/sim/index.ts";

/**
 * Runtime invariant checks for the World state (#234 — world-model
 * implications). Checked at every day boundary inside `runOne` to catch
 * anomalies in real Runs.
 *
 * Pure function: takes (world, day), returns violation reasons. No side effects,
 * no RNG. Violations are deduped by reason text inside `runOne`'s anomaly
 * collection, so a persistent invariant violation doesn't emit N identical entries.
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
  // Import is deferred to avoid circular deps. OFFERS_PER_GUILD_MAX is a constant.
  const OFFERS_PER_GUILD_MAX = 3; // From src/sim/guild.ts

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

/**
 * Runs all invariant checks and returns a list of violation reasons.
 * Called at every day boundary in `runOne`.
 *
 * Returns empty array if all checks pass. Reason strings include the day
 * context (inserted by the caller in runOne so we can dedupe by reason alone).
 */
export function checkInvariants(world: World, day: number): readonly string[] {
  const checks: ((w: World) => string | null)[] = [
    checkDesperationClause,
    checkOfferCap,
    checkOfferIdUniqueness,
    checkTierRange,
    checkRequiredRankRange,
  ];

  const reasons: string[] = [];
  for (const check of checks) {
    const violation = check(world);
    if (violation !== null) {
      reasons.push(`Day ${day}: ${violation}`);
    }
  }

  return reasons;
}
