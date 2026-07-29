import { describe, expect, it } from "vitest";
import {
  advanceDays,
  cargoUsed,
  createWorld,
  storeOf,
  TICKS_PER_DAY,
  type Command,
  type LedgerEvent,
  type Ship,
  type World,
} from "../src/sim/index.ts";
import { doNothing } from "./policies/doNothing.ts";
import { gradientLoop } from "./policies/gradientLoop.ts";
import { runPolicy, type Policy } from "./policy.ts";

/**
 * Policy contract + determinism (docs/specs/E11-proving-grounds.md §Testing):
 * "a trivial do-nothing policy and a gradient-loop policy run a full Batch
 * without violations" and "same policy + seed + days ⇒ deep-equal outcome and
 * byte-equal Ledger".
 */

const SEEDS = [1, 7, 42];
const DAYS = 40;

const trades = (world: World) => world.ledger.filter((e): e is Extract<LedgerEvent, { kind: "trade" }> => e.kind === "trade");

/** Immutable-spread rebuild of `world` with `patch` applied to its first
 *  ship and `thalers` set on the Company — the fixture-construction pattern
 *  used by `harness/invariants.test.ts`'s deliberately-broken worlds, so
 *  these tests exercise the same "spread, no `any`" shape rather than
 *  mutating a `readonly World` in place through an `as any` escape hatch. */
function withFirstShipAndPurse(world: World, thalers: number, patch: Partial<Ship>): World {
  const [first, ...rest] = world.company.ships;
  if (first === undefined) {
    throw new Error("withFirstShipAndPurse: fixture requires at least one ship");
  }
  return {
    ...world,
    company: {
      ...world.company,
      thalers,
      ships: [{ ...first, ...patch }, ...rest],
    },
  };
}

describe("doNothing — the null baseline", () => {
  it("issues no commands: the Run is indistinguishable from letting the world tick alone", () => {
    const start = createWorld(42);
    const run = runPolicy(start, doNothing, DAYS);

    expect(run.world).toEqual(advanceDays(start, DAYS));
    expect(trades(run.world)).toHaveLength(0);
    expect(run.world.company.thalers).toBe(start.company.thalers);
    // The world itself did move — otherwise "no trades" would be vacuous.
    expect(run.world.tick).toBeGreaterThan(0);
    expect(run.world.ledger.length).toBeGreaterThan(0);
  });

  it("is polled every tick all the same (the contract is per-tick, not per-day)", () => {
    let polls = 0;
    const counting: Policy<null> = {
      name: "counting",
      init: () => null,
      act: () => {
        polls++;
        return { commands: [], memory: null };
      },
    };
    runPolicy(createWorld(3), counting, 2);
    expect(polls).toBe(2 * TICKS_PER_DAY);
  });
});

describe("gradientLoop — the reference trader", () => {
  for (const seed of SEEDS) {
    it(`seed ${seed}: runs ${DAYS} days without violations, actually trading its chosen gradient`, () => {
      const start = createWorld(seed);
      const { world, memory } = runPolicy(start, gradientLoop(), DAYS);

      // It picked a real, non-degenerate loop.
      expect(memory.source).not.toBe(memory.target);
      // It traded both sides of that loop, in its own good, at its own ports.
      const booked = trades(world);
      const buys = booked.filter((e) => e.side === "buy");
      const sells = booked.filter((e) => e.side === "sell");
      // Strengthen assertion: with 40 days and an active policy, expect
      // at least one full round trip (buy-sail-sell). Measured observed:
      // seed 1: 18 buys/17 sells, seed 7: 7/7, seed 42: 4/4.
      expect(buys.length).toBeGreaterThanOrEqual(2);
      expect(sells.length).toBeGreaterThanOrEqual(2);
      for (const event of booked) {
        expect(event.good).toBe(memory.good);
        expect([memory.source, memory.target]).toContain(event.portId);
      }
      expect(buys.every((e) => e.portId === memory.source)).toBe(true);
      expect(sells.every((e) => e.portId === memory.target)).toBe(true);

      // No violations: solvent purse, hold never overfilled, quantities real.
      expect(world.company.thalers).toBeGreaterThanOrEqual(0);
      for (const ship of world.company.ships) {
        expect(cargoUsed(ship)).toBeLessThanOrEqual(ship.hold);
      }
      for (const event of booked) expect(event.qty).toBeGreaterThan(0);
    });
  }

  it("honors explicit parameters over the gradient it would have found", () => {
    const start = createWorld(11);
    const [a, b] = start.region.ports;
    const { memory, world } = runPolicy(
      start,
      gradientLoop({ good: "grain", sourcePortId: a.id, targetPortId: b.id }),
      DAYS,
    );
    expect(memory).toEqual({ good: "grain", source: a.id, target: b.id });
    expect(trades(world).every((e) => e.good === "grain")).toBe(true);
    expect(trades(world).length).toBeGreaterThan(0);
  });

  // TDD red-evidence for the four tests below (CODER.md's per-test
  // discrimination rule — these were added after gradientLoop.ts's fix, so
  // each needed a named, reproducible red before being accepted as
  // contract-conformant rather than just non-vacuous). Verified by targeted
  // mutation, each reverted immediately after observing the result:
  //   - "rejects a bad sourcePortId": removing `init`'s sourcePortId check
  //     alone turns this test red (`gradientLoop: sourcePortId does not
  //     exist` never thrown) while "rejects a bad targetPortId" stays green.
  //   - "rejects a bad targetPortId": removing the targetPortId check alone
  //     (sourcePortId's check left in place) turns this test red while the
  //     sourcePortId test stays green — proves the two checks are
  //     independently covered, not just one guarding both.
  //   - "executes qty <= 0 branch ... no buy command": forcing a spurious
  //     `buy` command in the `carried === 0` arm of the qty<=0 branch turns
  //     only this test red; "...sails to target to sell" (carried > 0)
  //     stays green.
  //   - "executes qty <= 0 branch ... sails to target to sell": forcing an
  //     empty command list in the `carried > 0` arm turns only this test
  //     red; the `carried === 0` test stays green.
  //   - "rejects a one-port region": reverting the fallback throw to
  //     return a same-port (source === target) memory instead of throwing
  //     turns this test red (`no tradeable gradient` never thrown).
  // Each mutation targeted exactly the branch its test names, and each
  // left every other test in the file passing — genuine per-test
  // discrimination, not a shared trip-wire.
  it("rejects a bad sourcePortId with a descriptive error, not a silent null deref", () => {
    const start = createWorld(42);
    expect(() => {
      runPolicy(start, gradientLoop({ sourcePortId: "nonexistent-port" }), 5);
    }).toThrow(/port|id|source/i);
  });

  it("rejects a bad targetPortId with a descriptive error, not a silent null deref", () => {
    const start = createWorld(42);
    expect(() => {
      runPolicy(start, gradientLoop({ targetPortId: "nonexistent-port" }), 5);
    }).toThrow(/port|id|target/i);
  });

  it("executes qty <= 0 branch: when a port has insufficient stock or affordability, act() returns no buy command", () => {
    // Test the restock-wait branch directly by calling act() on a world
    // where the source port is unaffordable.
    const base = createWorld(42);
    const policy = gradientLoop();
    const memory = policy.init(base);

    // Ship at source with zero cargo and zero thalers: can't afford a buy.
    const world = withFirstShipAndPurse(base, 0, {
      location: { kind: "docked", portId: memory.source },
      cargo: storeOf({}),
    });

    const step = policy.act(world, memory);
    // With qty <= 0 and no cargo, should return no commands (wait).
    expect(step.commands).toEqual([]);
    expect(step.memory).toBe(memory); // Memory unchanged.
  });

  it("executes qty <= 0 branch: when carrying cargo at source with no affordability, it sails to target to sell", () => {
    const base = createWorld(42);
    const policy = gradientLoop();
    const memory = policy.init(base);

    // Ship at source with existing cargo and zero thalers: can't buy, should sail to sell.
    const world = withFirstShipAndPurse(base, 0, {
      location: { kind: "docked", portId: memory.source },
      cargo: storeOf({ [memory.good]: 10 }),
    });

    const step = policy.act(world, memory);
    // With qty <= 0 but carrying cargo, should sail to target to sell.
    expect(step.commands).toHaveLength(1);
    const cmd = step.commands[0]! as Extract<Command, { kind: "sailTo" }>;
    expect(cmd.kind).toBe("sailTo");
    expect(cmd.portId).toBe(memory.target);
  });

  it("rejects a one-port region with a descriptive error (steepestGradient fallback)", () => {
    // The fallback throws when no gradient is found. Build a world with all
    // but one port removed via immutable spread — no in-place mutation.
    const base = createWorld(42);
    const [onlyPort] = base.region.ports;
    const world: World = {
      ...base,
      region: { ...base.region, ports: onlyPort === undefined ? [] : [onlyPort] },
    };

    expect(() => {
      gradientLoop().init(world);
    }).toThrow(/no tradeable gradient|2 ports|price dispersion/i);
  });

  it("diagnostic flag: gradientLoop is not diagnostic (reads only player-visible prices)", () => {
    // The diagnostic flag marks a policy allowed super-player knowledge
    // (sim internals like flow drift or RNG state). gradientLoop reads only
    // market quotes and effective base prices—player-visible info—so it is not diagnostic.
    // A test that pins this contract enforces §Laws on future consumers.
    const policy = gradientLoop();
    expect(policy.diagnostic).toBe(false);
  });
});

describe("determinism (spec §Testing)", () => {
  for (const seed of SEEDS) {
    it(`seed ${seed}: same policy + seed + days ⇒ deep-equal world and byte-equal Ledger`, () => {
      const first = runPolicy(createWorld(seed), gradientLoop(), DAYS);
      const second = runPolicy(createWorld(seed), gradientLoop(), DAYS);

      // Discriminating precondition: an empty Run would make both sides
      // trivially equal (incident 0005).
      expect(first.world.ledger.length).toBeGreaterThan(0);
      expect(trades(first.world).length).toBeGreaterThan(0);
      expect(first.world.company.thalers).not.toBe(createWorld(seed).company.thalers);

      expect(second.world).toEqual(first.world);
      expect(second.memory).toEqual(first.memory);
      // Byte-equal Ledger: compared between two in-process Runs, never
      // pinned as a fixture (incidents 0023/0024 — float bytes are not
      // portable across platforms, but two runs on one machine must agree
      // exactly, so no rounding is applied here on purpose).
      expect(JSON.stringify(second.world.ledger)).toBe(JSON.stringify(first.world.ledger));
    });
  }

  it("a different seed produces a different Ledger (the equality above is not vacuous)", () => {
    const a = runPolicy(createWorld(1), gradientLoop(), DAYS);
    const b = runPolicy(createWorld(7), gradientLoop(), DAYS);
    expect(JSON.stringify(b.world.ledger)).not.toBe(JSON.stringify(a.world.ledger));
  });

  it("threads policy memory rather than letting a policy keep state of its own", () => {
    const counter: Policy<number> = {
      name: "counter",
      init: () => 0,
      act: (_world, memory) => ({ commands: [], memory: memory + 1 }),
    };
    expect(runPolicy(createWorld(1), counter, 3).memory).toBe(3 * TICKS_PER_DAY);
  });
});
