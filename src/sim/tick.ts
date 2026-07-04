import type { World } from "./world";

/**
 * Command: a player order applied at a tick boundary (CONTEXT.md). No
 * commands exist yet — E2 (trade loop) adds the first ones — so the union
 * is empty and `[]` is the only valid command list.
 */
export type Command = never;

/**
 * Advances the World by exactly one tick (ADR-0003). Pure: never mutates
 * its input. Commands are applied first, then world systems run — the
 * skeleton has no systems yet, so this only moves time forward and will
 * grow phases (voyages, markets) in later epics.
 */
export function tick(world: World, commands: readonly Command[]): World {
  void commands;
  return {
    ...world,
    tick: world.tick + 1,
  };
}
