import { describe, expect, it } from "vitest";
import { advanceDays, cargoUsed, createWorld, type LedgerEvent, type World } from "../src/sim/index.ts";
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
    expect(polls).toBe(2 * 24); // TICKS_PER_DAY
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
      expect(buys.length).toBeGreaterThan(0);
      expect(sells.length).toBeGreaterThan(0);
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
    expect(runPolicy(createWorld(1), counter, 3).memory).toBe(3 * 24);
  });
});
