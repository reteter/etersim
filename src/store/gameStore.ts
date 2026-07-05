import { create } from "zustand";
import {
  applyCommand,
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
 * applies player commands immediately (ADR-0005). No sim logic lives here.
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

  newGame(seed: number | string): void;
  loadWorld(world: World): void;
  reset(): void;
  setSpeed(speed: Speed): void;
  select(selection: Selection): void;
  /** Applies a command immediately (ADR-0005; docs/specs/E2-trade-loop.md). */
  dispatch(command: Command): void;
  /** Folds elapsed real ms into world ticks; the rAF loop feeds this. */
  advance(elapsedMs: number): void;
}

const INITIAL = {
  world: null,
  speed: "paused" as Speed,
  carryMs: 0,
  selection: null,
};

export const useGameStore = create<GameState>()((set, get) => ({
  ...INITIAL,

  newGame: (seed) => set({ ...INITIAL, world: createWorld(seed), speed: 1 }),

  loadWorld: (world) => set({ ...INITIAL, world }),

  reset: () => set(INITIAL),

  // Pause-drops-carry is owned by elapsedToTicks; the next frame applies it.
  setSpeed: (speed) => set({ speed }),

  select: (selection) => set({ selection }),

  dispatch: (command) => {
    const { world } = get();
    if (!world) return;
    set({ world: applyCommand(world, command) });
  },

  advance: (elapsedMs) => {
    const { world, speed, carryMs } = get();
    if (!world) return;
    const { ticks, carryMs: nextCarry } = elapsedToTicks(speed, elapsedMs, carryMs);
    if (ticks === 0) {
      set({ carryMs: nextCarry });
      return;
    }
    let next = world;
    for (let i = 0; i < ticks; i++) next = tick(next, []);
    set({ world: next, carryMs: nextCarry });
  },
}));
