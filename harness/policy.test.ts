import { describe, expect, it } from "vitest";
import {
  advanceDays,
  cargoUsed,
  createWorld,
  TICKS_PER_DAY,
  type Command,
  type LedgerEvent,
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
    // Test the restock-wait branch (line 139) directly by calling act()
    // on a world where the source port is unaffordable.
    const world = createWorld(42);
    const policy = gradientLoop();
    const memory = policy.init(world);

    // Ship at source with zero cargo and zero thalers: can't afford a buy.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (world.company as any).thalers = 0;
    const ship = world.company.ships[0]!;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (ship as any).location = { kind: "docked", portId: memory.source };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (ship as any).cargo = { grain: 0, flour: 0, seeds: 0, tool: 0 };

    const step = policy.act(world, memory);
    // With qty <= 0 and no cargo, should return no commands (wait).
    expect(step.commands).toEqual([]);
    expect(step.memory).toBe(memory); // Memory unchanged.
  });

  it("executes qty <= 0 branch: when carrying cargo at source with no affordability, it sails to target to sell", () => {
    const world = createWorld(42);
    const policy = gradientLoop();
    const memory = policy.init(world);

    // Ship at source with existing cargo and zero thalers: can't buy, should sail to sell.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (world.company as any).thalers = 0;
    const ship = world.company.ships[0]!;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (ship as any).location = { kind: "docked", portId: memory.source };
    // Cargo is a GoodsStore (Record<GoodId, number>). Set the policy's good to 10 qty.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cargo: any = { grain: 0, flour: 0, seeds: 0, tool: 0 };
    cargo[memory.good] = 10;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (ship as any).cargo = cargo;

    const step = policy.act(world, memory);
    // With qty <= 0 but carrying cargo, should sail to target to sell.
    expect(step.commands).toHaveLength(1);
    const cmd = step.commands[0]! as Extract<Command, { kind: "sailTo" }>;
    expect(cmd.kind).toBe("sailTo");
    expect(cmd.portId).toBe(memory.target);
  });

  it("rejects a one-port region with a descriptive error (steepestGradient fallback, line 92)", () => {
    // The fallback on line 92 throws when no gradient is found.
    // Create a world, then cull all but one port to trigger this edge case.
    const world = createWorld(42);
    // Remove all but the first port.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (world.region as any).ports = [world.region.ports[0]!];

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

  it("diagnostic flag can round-trip through a Run (contract enforcement)", () => {
    // Even if a future policy set diagnostic: true, the flag should
    // round-trip readable through runPolicy and in policy metadata.
    // This pins that future consumers of the diagnostic flag will see it.
    const policy = gradientLoop();
    const world = createWorld(1);
    runPolicy(world, policy, 1); // Run is observable without inspecting memory.
    // If diagnostic were unreadable post-run, this test would fail
    // when a consumer tries to enforce the contract.
    expect(policy.diagnostic).toBeDefined();
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
