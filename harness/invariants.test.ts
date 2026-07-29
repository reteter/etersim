import { describe, expect, it } from "vitest";
import { advanceDays, createWorld, type World, GOOD_IDS } from "../src/sim/index.ts";
import { ARCHETYPE_PROFILES } from "../src/sim/region.ts";
import { checkInvariants, dedupeViolationsByDay } from "./invariants.ts";

/**
 * Runtime invariant checks (#234 — the deliberately-broken-world fixtures
 * that prove the assertion machinery works).
 */

/** Craters every non-domain good at every port to 0 stock — a real,
 *  immediate shortage on the next tick's day boundary, forcing offer
 *  generation (the same device `e3-guardrails.test.ts`'s
 *  `withCrateredImports` and `contract.test.ts`'s feasibility property test
 *  use — a fresh World's stocks otherwise start at equilibrium, with no
 *  shortage to generate an offer from). */
function withCrateredImports(world: World): World {
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
  return { ...world, region: { ...world.region, ports: craterPorts } };
}

/** A World with real, freshly-generated contract offers to test against —
 *  seed 1 is known to generate offers per e3-guardrails.test.ts's
 *  PINNED_SEEDS, once cratered. */
function worldWithGeneratedOffers(): World {
  return advanceDays(withCrateredImports(createWorld(1)), 1);
}

/** Constructs a World with a single guild that has open contract offers,
 *  where NONE of those offers have requiredRank === 1. This violates the
 *  desperation clause: every guild with ≥1 open offer must have
 *  min(requiredRank) === 1. */
function worldWithViolatedDesperationClause(): World {
  const world = worldWithGeneratedOffers();

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
    const violations = checkInvariants(brokenWorld);

    expect(violations).not.toHaveLength(0);
    const desperation = violations.find((v) => v.toLowerCase().includes("desperation"));
    expect(desperation).toBeDefined();
  });

  it("passes a healthy world where every guild with offers has min(requiredRank) === 1", () => {
    const world = advanceDays(createWorld(42), 1);
    // Only test if offers were generated (seed-dependent).
    if (world.contractOffers.length > 0) {
      const violations = checkInvariants(world);
      const desperation = violations.filter((v) => v.includes("desperation"));
      expect(desperation).toHaveLength(0);
    }
  });

  it("flags a haulability violation: an offer with fewer than 2 expected round trips (AC1: e3-guardrails.test.ts's feasibility property)", () => {
    const world = worldWithGeneratedOffers();
    const [offer] = world.contractOffers;
    if (offer === undefined) throw new Error("fixture requires at least one generated offer");

    const broken = { ...offer, basis: { ...offer.basis, expectedTrips: 1 } };
    const brokenWorld = { ...world, contractOffers: [broken] };

    const violations = checkInvariants(brokenWorld);
    const haulability = violations.find((v) => v.toLowerCase().includes("haulability"));
    expect(haulability).toBeDefined();
    expect(haulability).toContain("expectedTrips=1");
  });

  it("flags a haulability violation: an offer whose quota exceeds the 0.7-slack budget for a reference-hold ship", () => {
    const world = worldWithGeneratedOffers();
    const [offer] = world.contractOffers;
    if (offer === undefined) throw new Error("fixture requires at least one generated offer");

    // quotaPerPeriod far beyond floor(0.7 * expectedTrips * STARTING_HOLD).
    const broken = { ...offer, quotaPerPeriod: 10_000 };
    const brokenWorld = { ...world, contractOffers: [broken] };

    const violations = checkInvariants(brokenWorld);
    const haulability = violations.find((v) => v.toLowerCase().includes("haulability"));
    expect(haulability).toBeDefined();
    expect(haulability).toContain("quotaPerPeriod=10000");
  });

  it("passes every naturally-generated offer's haulability (feasible-by-construction, e3-guardrails.test.ts)", () => {
    const world = worldWithGeneratedOffers();
    expect(world.contractOffers.length).toBeGreaterThan(0);
    const violations = checkInvariants(world);
    const haulability = violations.filter((v) => v.toLowerCase().includes("haulability"));
    expect(haulability).toHaveLength(0);
  });
});

describe("dedupeViolationsByDay — the real dedup guard (#234 wave-check fix)", () => {
  it("collapses the same reason recurring across 3+ days into exactly one entry, at its first day", () => {
    // The bug this replaces: checkInvariants used to bake "Day N: " into the
    // reason string itself, so a persistent violation across many days never
    // matched itself under a naive Set-based dedup — one entry per day
    // instead of one entry total. dedupeViolationsByDay dedupes on `reason`
    // alone, formatting `Day N: reason` only after the dedup decision.
    const reason = 'Desperation clause violation: guild "smiths" has 2 open offer(s) but min(requiredRank) = 2, not 1.';
    const occurrences = [
      { day: 1, reason },
      { day: 2, reason },
      { day: 3, reason },
    ];

    const deduped = dedupeViolationsByDay(occurrences);

    expect(deduped).toHaveLength(1);
    expect(deduped[0]).toBe(`Day 1: ${reason}`);
  });

  it("keeps distinct reasons as distinct entries, each at its own first day", () => {
    const occurrences = [
      { day: 1, reason: "Tier range violation: offer x has tier 5" },
      { day: 2, reason: "Tier range violation: offer x has tier 5" },
      { day: 2, reason: "Offer cap violation: guild y has 4 open offers" },
      { day: 4, reason: "Offer cap violation: guild y has 4 open offers" },
    ];

    const deduped = dedupeViolationsByDay(occurrences);

    expect(deduped).toEqual([
      "Day 1: Tier range violation: offer x has tier 5",
      "Day 2: Offer cap violation: guild y has 4 open offers",
    ]);
  });

  it("returns an empty list for an empty occurrence stream (no violations across the whole Run)", () => {
    expect(dedupeViolationsByDay([])).toEqual([]);
  });
});
