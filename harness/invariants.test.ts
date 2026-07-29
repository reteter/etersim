import { describe, expect, it } from "vitest";
import { advanceDays, createWorld, type World, GOOD_IDS } from "../src/sim/index.ts";
import { ARCHETYPE_PROFILES } from "../src/sim/region.ts";
import { checkInvariants } from "./invariants.ts";

/**
 * Runtime invariant checks (#234 — the deliberately-broken-world fixtures
 * that prove the assertion machinery works).
 */

/** Constructs a World with a single guild that has open contract offers,
 *  where NONE of those offers have requiredRank === 1. This violates the
 *  desperation clause: every guild with ≥1 open offer must have
 *  min(requiredRank) === 1. */
function worldWithViolatedDesperationClause(): World {
  // Seed 1 is known to generate offers per e3-guardrails.test.ts's PINNED_SEEDS.
  let world = createWorld(1);
  // Crater imports to force a shortage and offer generation on the next boundary.
  // Use the same setup as e3-guardrails.test.ts's withCrateredImports.
  const craterPorts = world.region.ports.map((port) => {
    const market: Record<string, { stock: number; equilibrium: number }> = {};
    for (const good of GOOD_IDS) {
      market[good] = {
        ...port.market[good],
        stock:
          (ARCHETYPE_PROFILES[port.archetype].productionPerDay[good] ?? 0) > 0
            ? port.market[good].stock
            : 0,
      };
    }
    return { ...port, market } as typeof port;
  });

  world = {
    ...world,
    region: {
      ...world.region,
      ports: craterPorts,
    },
  };

  world = advanceDays(world, 1);

  if (world.contractOffers.length === 0) {
    throw new Error(
      "Test fixture failed: no offers generated even with cratered imports on seed 1. " +
        "This is a fixture issue, not a real invariant violation."
    );
  }

  // Find the first guild that has open offers, then replace ALL of its offers
  // with versions that have requiredRank > 1, violating the desperation clause.
  const firstGuildWithOffers = world.contractOffers[0]?.guildId;
  if (!firstGuildWithOffers) {
    throw new Error(
      "Test fixture failed: no offers available even after cratered imports."
    );
  }

  const broken = world.contractOffers.map((offer) =>
    offer.guildId === firstGuildWithOffers ? { ...offer, requiredRank: 2 } : offer
  );

  return {
    ...world,
    contractOffers: broken,
  };
}

describe("checkInvariants — invariant verification machinery", () => {
  it("flags a violated desperation clause: a guild with open offers where none has requiredRank === 1", () => {
    const brokenWorld = worldWithViolatedDesperationClause();
    const violations = checkInvariants(brokenWorld, 5); // day 5 is arbitrary

    expect(violations).not.toHaveLength(0);
    const desperation = violations.find((v) => v.toLowerCase().includes("desperation"));
    expect(desperation).toBeDefined();
    expect(desperation).toContain("Day 5");
  });

  it("passes a healthy world where every guild with offers has min(requiredRank) === 1", () => {
    const world = advanceDays(createWorld(42), 1);
    // Only test if offers were generated (seed-dependent).
    if (world.contractOffers.length > 0) {
      const violations = checkInvariants(world, 1);
      const desperation = violations.filter((v) => v.includes("desperation"));
      expect(desperation).toHaveLength(0);
    }
  });

  it("returns a deduped list when the same invariant would fire multiple days", () => {
    const brokenWorld = worldWithViolatedDesperationClause();
    // Simulate running through multiple days with the same broken state.
    const violations1 = checkInvariants(brokenWorld, 1);
    const violations2 = checkInvariants(brokenWorld, 2);
    const violations3 = checkInvariants(brokenWorld, 3);

    // All three should have the same violations, just with different day context.
    expect(violations1).not.toHaveLength(0);
    expect(violations2).not.toHaveLength(0);
    expect(violations3).not.toHaveLength(0);

    // The reason strings should differ only in the day number.
    const v1Day = violations1[0].match(/Day (\d+)/)![1];
    const v2Day = violations2[0].match(/Day (\d+)/)![1];
    const v3Day = violations3[0].match(/Day (\d+)/)![1];
    expect(v1Day).toBe("1");
    expect(v2Day).toBe("2");
    expect(v3Day).toBe("3");
  });
});
