import { create } from "zustand";
import {
  createWorld,
  elapsedToTicks,
  tick,
  type Command,
  type PortId,
  type ShipId,
  type Speed,
  type World,
} from "../sim";

/**
 * The thin bridge between the pure sim and React (ADR-0002): holds the
 * current World plus UI state, folds real elapsed time into ticks, and
 * queues player commands into the next tick. No sim logic lives here.
 */

export type Selection =
  | { readonly kind: "port"; readonly id: PortId }
  | { readonly kind: "ship"; readonly id: ShipId }
  | null;

interface GameState {
  readonly world: World | null;
  readonly speed: Speed;
  readonly carryMs: number;
  readonly selection: Selection;
  readonly pendingCommands: readonly Command[];

  newGame(seed: number | string): void;
  loadWorld(world: World): void;
  reset(): void;
  setSpeed(speed: Speed): void;
  select(selection: Selection): void;
  /** Queues a command for the next tick (docs/specs/E2-trade-loop.md). */
  dispatch(command: Command): void;
  /** Folds elapsed real ms into world ticks; the rAF loop feeds this. */
  advance(elapsedMs: number): void;
}

const INITIAL = {
  world: null,
  speed: "paused" as Speed,
  carryMs: 0,
  selection: null,
  pendingCommands: [] as readonly Command[],
};

export const useGameStore = create<GameState>()((set, get) => ({
  ...INITIAL,

  newGame: (seed) => set({ ...INITIAL, world: createWorld(seed), speed: 1 }),

  loadWorld: (world) => set({ ...INITIAL, world }),

  reset: () => set(INITIAL),

  setSpeed: (speed) =>
    // Pausing drops the carry (see elapsedToTicks) — mirror it here so a
    // long pause can't smuggle time into the next running frame.
    set(speed === "paused" ? { speed, carryMs: 0 } : { speed }),

  select: (selection) => set({ selection }),

  dispatch: (command) => set({ pendingCommands: [...get().pendingCommands, command] }),

  advance: (elapsedMs) => {
    const { world, speed, carryMs, pendingCommands } = get();
    if (!world) return;
    const { ticks, carryMs: nextCarry } = elapsedToTicks(speed, elapsedMs, carryMs);
    if (ticks === 0) {
      set({ carryMs: nextCarry });
      return;
    }
    // Queued commands enter the first folded tick only.
    let next = tick(world, pendingCommands);
    for (let i = 1; i < ticks; i++) next = tick(next, []);
    set({ world: next, carryMs: nextCarry, pendingCommands: [] });
  },
}));
