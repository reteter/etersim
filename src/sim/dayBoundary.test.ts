import { describe, expect, it } from "vitest";
import { CONSTRUCTION_RESERVE } from "./building";
import type { ActiveContract } from "./contract";
import { GOOD_IDS } from "./goods";
import { type GuildId, UPKEEP_PER_DAY } from "./guild";
import { TICKS_PER_DAY } from "./region";
import { nextUint32 } from "./rng";
import { emptyCargo, type Ship } from "./ship";
import { DAY_BOUNDARY_PHASES, tick } from "./tick";
import { createWorld, type World } from "./world";

/**
 * Behavior contracts for the #168 `dayBoundary(world)` extraction
 * (docs/specs/E3-contracts-and-guilds.md — Tick day-boundary order). These
 * tests intentionally avoid pinned hashes/JSON constants: an earlier version
 * of this file pinned `fnv1a(JSON.stringify(world))` values captured locally
 * on Windows/Node, but CI's Linux V8 build produces last-ulp-different float
 * formatting in the price-curve math, making byte-level whole-world hashes
 * engine-dependent and unsuitable for CI. Behavior preservation of the #168
 * refactor itself was proven at refactor time via a local golden diff and a
 * field-for-field reviewer trace (PR #169 discussion) — this file instead
 * asserts the durable, platform-robust behavior contracts: determinism,
 * boundary cadence, and RNG usage confined to boundary ticks.
 */
describe("dayBoundary behavior contracts (#168)", () => {
  const SEEDS = [1, 7, 13];

  for (const seed of SEEDS) {
    it(`seed ${seed}: two fresh runs with the same seed and no commands are byte-equal`, () => {
      const run = () => {
        let world = createWorld(seed);
        for (let i = 0; i < 30 * TICKS_PER_DAY; i++) world = tick(world, []);
        return world;
      };
      expect(JSON.stringify(run())).toBe(JSON.stringify(run()));
    });

    it(`seed ${seed}: exactly one netWorth Ledger event per day boundary, none between`, () => {
      let world = createWorld(seed);
      let netWorthEventsSeen = 0;
      for (let day = 1; day <= 30; day++) {
        for (let i = 0; i < TICKS_PER_DAY - 1; i++) {
          world = tick(world, []);
          const total = world.ledger.filter((e) => e.kind === "netWorth").length;
          expect(total).toBe(netWorthEventsSeen);
        }
        world = tick(world, []);
        netWorthEventsSeen += 1;
        const netWorthEvents = world.ledger.filter((e) => e.kind === "netWorth");
        expect(netWorthEvents.length).toBe(netWorthEventsSeen);
        expect(netWorthEvents[netWorthEvents.length - 1].tick).toBe(world.tick);
      }
    });

    it(`seed ${seed}: priceSnapshots and flowDrift change only at day boundaries; rng advances only at boundary ticks`, () => {
      let world = createWorld(seed);
      for (let day = 1; day <= 10; day++) {
        const beforeBoundary = world;
        for (let i = 0; i < TICKS_PER_DAY - 1; i++) {
          const prevRng = world.rng;
          const prevSnapshots = world.priceSnapshots;
          const prevDrift = world.flowDrift;
          world = tick(world, []);
          expect(world.rng).toBe(prevRng);
          expect(world.priceSnapshots).toBe(prevSnapshots);
          expect(world.flowDrift).toBe(prevDrift);
        }
        const prevRngAtBoundary = world.rng;
        world = tick(world, []);
        // Boundary tick: rng must advance (day-boundary consumers — drift,
        // offer generation (#93) — draw from isolated `deriveSubstream`
        // substreams derived from the pre-advance state; the main stream
        // itself advances exactly once, unconditionally).
        expect(world.rng).not.toBe(prevRngAtBoundary);
        expect(world.priceSnapshots).not.toBe(beforeBoundary.priceSnapshots);
        expect(world.flowDrift).not.toBe(beforeBoundary.flowDrift);
      }
    });

    it(`seed ${seed}: the main rng advances exactly once per day boundary (#93 — no double draw, substreams never leak into the main stream)`, () => {
      let world = createWorld(seed);
      for (let day = 1; day <= 10; day++) {
        for (let i = 0; i < TICKS_PER_DAY - 1; i++) world = tick(world, []);
        const prevRng = world.rng;
        world = tick(world, []);
        const [, expected] = nextUint32(prevRng);
        expect(world.rng).toBe(expected);
      }
    });
  }
});

/** A second ship at the same home port, for the multi-ship sequential-clamp
 *  test — cargo/location don't matter for upkeep, only fleet-array order. */
function shipAt(id: string, portId: string): Ship {
  return { id, name: id, hold: 50, cargo: emptyCargo(), location: { kind: "docked", portId } };
}

/** World with an arbitrary purse and fleet, one day (24 ticks) away from its
 *  first boundary — upkeep has no Headquarters precondition (spec: a ship
 *  costs thalers even when idle, HQ or not). */
function worldWith(thalers: number, ships: readonly Ship[]): World {
  const w = createWorld("upkeep-fixture");
  return { ...w, company: { ...w.company, thalers, ships } };
}

describe("ship upkeep (#95 — daily per-ship charge, Reserve floor)", () => {
  const homePort = createWorld("upkeep-fixture").region.ports[0].id;

  it("charges UPKEEP_PER_DAY per ship when the purse sits comfortably above the Reserve", () => {
    let world = worldWith(10_000, [shipAt("s0", homePort)]);
    for (let i = 0; i < TICKS_PER_DAY; i++) world = tick(world, []);
    expect(world.company.thalers).toBe(10_000 - UPKEEP_PER_DAY);
    const upkeepEvents = world.ledger.filter((e) => e.kind === "upkeep");
    expect(upkeepEvents).toEqual([
      { kind: "upkeep", tick: world.tick, shipId: "s0", thalers: UPKEEP_PER_DAY },
    ]);
  });

  it("purse at the Reserve exactly: no charge, no Ledger event", () => {
    let world = worldWith(CONSTRUCTION_RESERVE, [shipAt("s0", homePort)]);
    for (let i = 0; i < TICKS_PER_DAY; i++) world = tick(world, []);
    expect(world.company.thalers).toBe(CONSTRUCTION_RESERVE);
    expect(world.ledger.filter((e) => e.kind === "upkeep")).toEqual([]);
  });

  it("purse below the Reserve: no charge, no Ledger event", () => {
    let world = worldWith(CONSTRUCTION_RESERVE - 50, [shipAt("s0", homePort)]);
    for (let i = 0; i < TICKS_PER_DAY; i++) world = tick(world, []);
    expect(world.company.thalers).toBe(CONSTRUCTION_RESERVE - 50);
    expect(world.ledger.filter((e) => e.kind === "upkeep")).toEqual([]);
  });

  it("partial charge lands exactly at the Reserve when the full fee would cross it", () => {
    let world = worldWith(CONSTRUCTION_RESERVE + 5, [shipAt("s0", homePort)]);
    for (let i = 0; i < TICKS_PER_DAY; i++) world = tick(world, []);
    expect(world.company.thalers).toBe(CONSTRUCTION_RESERVE);
    expect(world.ledger.filter((e) => e.kind === "upkeep")).toEqual([
      { kind: "upkeep", tick: world.tick, shipId: "s0", thalers: 5 },
    ]);
  });

  it("multi-ship sequential clamp: fleet-array order, one ship's charge limits the next's", () => {
    // purse = RESERVE + 15: s0 charged min(10, 15) = 10 (purse -> RESERVE+5),
    // s1 charged min(10, 5) = 5 (purse -> RESERVE exactly). Deterministic on
    // fleet-array order, not ship id.
    let world = worldWith(CONSTRUCTION_RESERVE + 15, [
      shipAt("s0", homePort),
      shipAt("s1", homePort),
    ]);
    for (let i = 0; i < TICKS_PER_DAY; i++) world = tick(world, []);
    expect(world.company.thalers).toBe(CONSTRUCTION_RESERVE);
    expect(world.ledger.filter((e) => e.kind === "upkeep")).toEqual([
      { kind: "upkeep", tick: world.tick, shipId: "s0", thalers: 10 },
      { kind: "upkeep", tick: world.tick, shipId: "s1", thalers: 5 },
    ]);
  });

  it("a zero-per-ship charge never emits a Ledger event, even mid-fleet", () => {
    // purse = RESERVE exactly + one ship's headroom fully consumed by s0:
    // s0 charged 10 (purse -> RESERVE), s1 charged 0 (no headroom) -> no event.
    let world = worldWith(CONSTRUCTION_RESERVE + 10, [
      shipAt("s0", homePort),
      shipAt("s1", homePort),
    ]);
    for (let i = 0; i < TICKS_PER_DAY; i++) world = tick(world, []);
    expect(world.company.thalers).toBe(CONSTRUCTION_RESERVE);
    expect(world.ledger.filter((e) => e.kind === "upkeep")).toEqual([
      { kind: "upkeep", tick: world.tick, shipId: "s0", thalers: 10 },
    ]);
  });

  it("upkeep lands inside the same day's netWorth curve point", () => {
    let world = worldWith(10_000, [shipAt("s0", homePort)]);
    for (let i = 0; i < TICKS_PER_DAY; i++) world = tick(world, []);
    const netWorth = world.ledger.filter((e) => e.kind === "netWorth");
    expect(netWorth.length).toBe(1);
    expect(netWorth[0]).toMatchObject({ thalers: 10_000 - UPKEEP_PER_DAY });
  });

  it("charged before contract settlements/offer refresh, after price snapshots (order asserted via netWorth total)", () => {
    // With no HQ (no cargo value) and one ship, netWorth.total must equal the
    // post-upkeep purse exactly — proving upkeep already landed before the
    // snapshot, not after.
    let world = worldWith(10_000, [shipAt("s0", homePort)]);
    for (let i = 0; i < TICKS_PER_DAY; i++) world = tick(world, []);
    const netWorth = world.ledger.filter((e) => e.kind === "netWorth")[0] as {
      total: number;
    };
    expect(netWorth.total).toBe(10_000 - UPKEEP_PER_DAY);
  });

  it("determinism: two fresh runs with the same seed/fleet/purse are byte-equal", () => {
    const run = () => {
      let world = worldWith(CONSTRUCTION_RESERVE + 15, [
        shipAt("s0", homePort),
        shipAt("s1", homePort),
      ]);
      for (let i = 0; i < 5 * TICKS_PER_DAY; i++) world = tick(world, []);
      return world;
    };
    expect(JSON.stringify(run())).toBe(JSON.stringify(run()));
  });
});

describe("day-boundary ordering (#204 — settleContracts lands inside the same day's netWorth)", () => {
  const homePort = createWorld("dayboundary-ordering-fixture").region.ports[0].id;
  // GuildId (EconomicArchetype) is a strict subset of PortArchetype
  // ("freeport" has no guild) — pick a fixed economic archetype rather than
  // the home port's own archetype, which may land on "freeport".
  const guildId: GuildId = "agrarian";

  /** A contract already at quota, whose single-day period ends exactly at the
   *  first day boundary (startTick 0, periodDays 1 -> periodEndTick ==
   *  TICKS_PER_DAY) — so it settles `met` on the very first `tick()` call that
   *  crosses a day boundary. */
  function metContractFixture(feePerPeriod: number): ActiveContract {
    return {
      id: "guild:port:good",
      guildId,
      portId: homePort,
      good: GOOD_IDS[0],
      quotaPerPeriod: 1,
      periodDays: 1,
      minPeriods: 1,
      feePerPeriod,
      tier: 1,
      basis: { sourcePortId: homePort, roundTripTicks: 10, expectedTrips: 1 },
      startTick: 0,
      periodIndex: 0,
      deliveredThisPeriod: 1,
      consecutiveMisses: 0,
    };
  }

  it("a contract settling met at the boundary has its feePerPeriod payout inside THAT day's netWorth ledger point", () => {
    const feePerPeriod = 777;
    let world = createWorld("dayboundary-ordering-fixture");
    world = {
      ...world,
      company: { ...world.company, thalers: 10_000, contracts: [metContractFixture(feePerPeriod)] },
    };

    for (let i = 0; i < TICKS_PER_DAY; i++) world = tick(world, []);

    const contractFeeEvents = world.ledger.filter((e) => e.kind === "contractFee");
    expect(contractFeeEvents).toEqual([
      { kind: "contractFee", tick: world.tick, guildId, contractId: "guild:port:good", thalers: feePerPeriod },
    ]);

    const netWorthEvents = world.ledger.filter((e) => e.kind === "netWorth");
    expect(netWorthEvents.length).toBe(1);
    // No cargo/build-site value in this fixture, and the purse is well clear
    // of the upkeep Reserve (docs/specs/E3 — Upkeep, #95) so the default
    // ship's daily charge also lands the same boundary: netWorth.total must
    // equal thalers exactly, proving the settlement fee already landed before
    // the snapshot rather than in some later day.
    expect(world.company.thalers).toBe(10_000 - UPKEEP_PER_DAY + feePerPeriod);
    expect((netWorthEvents[0] as { total: number }).total).toBe(world.company.thalers);
  });
});

describe("DAY_BOUNDARY_PHASES structural order (#204)", () => {
  it("pins the exact phase order, so a new phase must slot in consciously", () => {
    expect(DAY_BOUNDARY_PHASES.map((p) => p.name)).toEqual([
      "drift",
      "priceSnapshot",
      "upkeep",
      "settleContracts",
      "refreshOffers",
      "netWorth",
    ]);
  });

  it("netWorth is always last", () => {
    expect(DAY_BOUNDARY_PHASES[DAY_BOUNDARY_PHASES.length - 1].name).toBe("netWorth");
  });
});
