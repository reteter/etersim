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
import { AUTOSAVE_INTERVAL_TICKS, saveAutosave } from "./persistence";

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
  /**
   * The Controlled Ship (CONTEXT.md): the ship that receives player Commands
   * (buy, sell, sailTo). Distinct from `selection`, which only drives panel
   * focus. Exactly one at a time; null before a world exists.
   */
  readonly controlledShipId: ShipId | null;

  newGame(seed: number | string): void;
  loadWorld(world: World): void;
  reset(): void;
  setSpeed(speed: Speed): void;
  select(selection: Selection): void;
  /** Designates a ship as the Controlled Ship without changing panel focus. */
  setControlledShip(id: ShipId): void;
  /** Designates a ship as Controlled and focuses its ShipPanel — the shared
   *  path for map, Harbor and header clicks (docs/specs/E2-trade-loop.md). */
  openShip(id: ShipId): void;
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
  controlledShipId: null,
};

/** The Controlled Ship a fresh world starts with — the company's first ship. */
function initialControlledShip(world: World): ShipId | null {
  return world.company.ships[0]?.id ?? null;
}

export const useGameStore = create<GameState>()((set, get) => ({
  ...INITIAL,

  newGame: (seed) => {
    const world = createWorld(seed);
    set({ ...INITIAL, world, speed: 1, controlledShipId: initialControlledShip(world) });
  },

  loadWorld: (world) =>
    set({ ...INITIAL, world, controlledShipId: initialControlledShip(world) }),

  reset: () => set(INITIAL),

  // Pause-drops-carry is owned by elapsedToTicks; the next frame applies it.
  // Pausing is also an autosave point (spec: autosave on pause).
  setSpeed: (speed) => {
    set({ speed });
    if (speed === "paused") {
      const { world } = get();
      if (world) saveAutosave(world);
    }
  },

  select: (selection) => set({ selection }),

  setControlledShip: (id) => set({ controlledShipId: id }),

  openShip: (id) => set({ controlledShipId: id, selection: { kind: "ship", id } }),

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
    // Autosave once whenever this advance crossed a 24-tick boundary, however
    // many ticks it folded (spec: autosave every 24 ticks).
    const interval = AUTOSAVE_INTERVAL_TICKS;
    if (Math.floor(next.tick / interval) > Math.floor(world.tick / interval)) {
      saveAutosave(next);
    }
  },
}));
