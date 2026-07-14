import { describe, expect, it } from "vitest";
import { TICKS_PER_DAY } from "./region";
import { tick } from "./tick";
import { createWorld } from "./world";

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
        // Boundary tick: rng must advance (driftStep is its only consumer today).
        expect(world.rng).not.toBe(prevRngAtBoundary);
        expect(world.priceSnapshots).not.toBe(beforeBoundary.priceSnapshots);
        expect(world.flowDrift).not.toBe(beforeBoundary.flowDrift);
      }
    });
  }
});
