import { describe, expect, it } from "vitest";
import type { Command } from "./commands";
import type { GoodId } from "./goods";
import { amountOf } from "./goodsStore";
import { TICKS_PER_DAY } from "./region";
import { advanceDays } from "./scenario";
import { tick } from "./tick";
import { createWorld, type World } from "./world";

/**
 * The scenario-runner seam (#232, docs/specs/E11-proving-grounds.md
 * §Re-review — "#202 folds in"): the one place a caller advances world time
 * by whole days. Consumed by the Vitest guardrail suites *and* by the E11
 * Harness, which imports it through the sim barrel like any other consumer
 * (ADR-0002 — the sim never imports the harness).
 */

/** A ship docked at the region's first port, with a purse — a fixture that
 *  makes a per-tick decider's `buy` command actually land. */
function dockedWorld(seed: number): World {
  const w = createWorld(seed);
  return {
    ...w,
    company: {
      ...w.company,
      thalers: 10_000,
      ships: w.company.ships.map((s, i) =>
        i === 0 ? { ...s, location: { kind: "docked" as const, portId: w.region.ports[0].id } } : s,
      ),
    },
  };
}

describe("advanceDays — the day-advance seam", () => {
  it("is exactly days × TICKS_PER_DAY calls to tick with no commands", () => {
    const start = createWorld(42);
    let manual = start;
    for (let i = 0; i < 3 * TICKS_PER_DAY; i++) manual = tick(manual, []);

    expect(advanceDays(start, 3)).toEqual(manual);
    expect(advanceDays(start, 3).tick).toBe(3 * TICKS_PER_DAY);
  });

  it("advances zero days as a no-op and never mutates its input", () => {
    const start = createWorld(7);
    const before = JSON.stringify(start);

    expect(advanceDays(start, 0)).toBe(start);
    expect(advanceDays(start, 5).tick).toBe(5 * TICKS_PER_DAY);
    expect(JSON.stringify(start)).toBe(before);
  });

  it("rejects a negative or fractional day count rather than silently rounding", () => {
    const start = createWorld(1);
    expect(() => advanceDays(start, -1)).toThrow(RangeError);
    expect(() => advanceDays(start, 1.5)).toThrow(RangeError);
  });

  it("polls the decider once per tick, with the world as it stands at that tick", () => {
    const start = createWorld(3);
    const seenTicks: number[] = [];
    const out = advanceDays(start, 2, (world) => {
      seenTicks.push(world.tick);
      return [];
    });

    expect(seenTicks).toHaveLength(2 * TICKS_PER_DAY);
    expect(seenTicks[0]).toBe(0);
    expect(seenTicks[seenTicks.length - 1]).toBe(2 * TICKS_PER_DAY - 1);
    expect(out).toEqual(advanceDays(start, 2));
  });

  it("applies the decider's commands through tick, identically to a hand-rolled loop", () => {
    const start = dockedWorld(11);
    const ship = start.company.ships[0];
    const portId = start.region.ports[0].id;
    const good: GoodId = "grain";
    const decide = (world: World): readonly Command[] => {
      const s = world.company.ships[0];
      return s.location.kind === "docked" && s.location.portId === portId && amountOf(s.cargo, good) === 0
        ? [{ kind: "buy", shipId: ship.id, good, qty: 5 }]
        : [];
    };

    let manual = start;
    for (let i = 0; i < TICKS_PER_DAY; i++) manual = tick(manual, decide(manual));

    const seamed = advanceDays(start, 1, decide);
    expect(seamed).toEqual(manual);
    // The decider really acted: the fixture bought cargo the no-command run
    // never would have.
    expect(amountOf(seamed.company.ships[0].cargo, good)).toBeGreaterThan(0);
    expect(seamed.company.thalers).toBeLessThan(start.company.thalers);
    expect(amountOf(advanceDays(start, 1).company.ships[0].cargo, good)).toBe(0);
  });
});
