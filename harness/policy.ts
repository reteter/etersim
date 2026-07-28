// Explicit `.ts` specifiers throughout `harness/`: the same import must
// resolve under `tsx` (Node ESM, no bundler) and under Vitest.
import { advanceDays, type Command, type World } from "../src/sim/index.ts";

/**
 * The Policy contract (CONTEXT.md — Policy; docs/specs/E11-proving-grounds.md
 * §Policy contract, locked in the 2026-07-09 grill).
 *
 * A Policy is a deterministic, parameterized playing strategy: a pure
 * function polled **every tick**. "Decide only when docked" is simply
 * returning no commands while underway — the sim is fast enough that a
 * per-tick poll costs nothing, and a per-tick contract absorbed three epics
 * (routes, construction, guilds) without an interface change (spec
 * §Re-review 2026-07-15).
 *
 * `M` is the policy's own memory: whatever it needs to carry between ticks.
 * The runner threads it; the policy never keeps state of its own, which is
 * what makes Policy + seed = the same Run, always (ADR-0003).
 *
 * A policy reads the full `World` but is honor-bound to player-visible
 * information; one that reads sim internals (flow drift, RNG state) must set
 * `diagnostic: true` — bug-hunt only.
 */
export interface Policy<M> {
  readonly name: string;
  /** Marks a policy allowed super-player knowledge (sim internals). */
  readonly diagnostic?: boolean;
  init(world: World): M;
  act(world: World, memory: M): { commands: readonly Command[]; memory: M };
}

/** The outcome of one Run: the world as it ended, plus the policy's final
 *  memory (a policy's own bookkeeping is part of what a report may read).
 *  Metrics and Ledger serialisation belong to the Batch runner (#233); the
 *  Ledger itself is already on the world (`world.company.ledger`). */
export interface RunResult<M> {
  readonly world: World;
  readonly memory: M;
}

/**
 * Runs one Policy over `days` world days from `world`, polling it every tick
 * through the sim's `advanceDays` seam (`src/sim/scenario.ts`) — the same
 * seam the sim's own guardrail suites use, so a Run and a Vitest scenario
 * advance time through identical code.
 *
 * Deterministic by construction: same policy + same starting world + same
 * day count ⇒ the same end world and the same Ledger, because every random
 * draw stays inside `tick` and the policy's memory is threaded here rather
 * than held in module scope.
 */
export function runPolicy<M>(world: World, policy: Policy<M>, days: number): RunResult<M> {
  let memory = policy.init(world);
  const ended = advanceDays(world, days, (current) => {
    const step = policy.act(current, memory);
    memory = step.memory;
    return step.commands;
  });
  return { world: ended, memory };
}
