import { create } from "zustand";
import {
  applyCommand,
  createWorld,
  elapsedToTicks,
  tick,
  type Command,
  type PortId,
  type RouteId,
  type Ship,
  type ShipId,
  type Speed,
  type World,
} from "../sim";
import { AUTOSAVE_INTERVAL_TICKS, saveAutosave } from "./persistence";
import { loadSettings, saveSettings } from "./settings";

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
  /**
   * The most recent non-"paused" Speed the player selected (#123): a pause —
   * manual or automatic (e.g. arrival auto-pause) — never overwrites this, so
   * `togglePause` can restore exactly the rate the player had chosen instead
   * of always falling back to 1x.
   */
  readonly lastActiveSpeed: Speed;
  readonly carryMs: number;
  readonly selection: Selection;
  /**
   * The Controlled Ship (CONTEXT.md): the ship that receives player Commands
   * (buy, sell, sailTo). Distinct from `selection`, which only drives panel
   * focus. Exactly one at a time; null before a world exists.
   */
  readonly controlledShipId: ShipId | null;
  /**
   * Auto-pause on arrival (docs/design-notes/trade-loop-followups.md item 4):
   * pauses the game when the Controlled Ship docks at its final destination.
   * A player preference, persisted separately from the game save (item 5) —
   * untouched by newGame/loadWorld/reset.
   */
  readonly autoPauseOnArrival: boolean;
  /**
   * The Route selected in the Headquarters panel's Trasy tab (E9): drives
   * the map's Stop-port highlighting only (docs/specs/E9 — "on the map, the
   * selected Route only highlights its Stop ports"). Independent of
   * `selection` (port/ship panel focus).
   */
  readonly selectedRouteId: RouteId | null;

  newGame(seed: number | string): void;
  loadWorld(world: World): void;
  reset(): void;
  setSpeed(speed: Speed): void;
  /** Pauses at the current speed (remembered in `lastActiveSpeed`) if
   *  running, or resumes to `lastActiveSpeed` if already paused (#123). The
   *  TopBar's pause button uses this instead of `setSpeed("paused")` so
   *  unpausing restores the player's chosen rate rather than resetting it. */
  togglePause(): void;
  setAutoPauseOnArrival(value: boolean): void;
  select(selection: Selection): void;
  selectRoute(routeId: RouteId | null): void;
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
  lastActiveSpeed: 1 as Speed,
  carryMs: 0,
  selection: null,
  controlledShipId: null,
  selectedRouteId: null,
};

/** The Controlled Ship a fresh world starts with — the company's first ship. */
function initialControlledShip(world: World): ShipId | null {
  return world.company.ships[0]?.id ?? null;
}

/**
 * True when `before` was underway to some destination and `after` is now
 * docked at that same destination — i.e. a *final* arrival, not an
 * intermediate lane hop. `advanceShip` (src/sim/ship.ts) only transitions a
 * ship from "underway" to "docked" once its course is exhausted; an
 * intermediate voyage completing instead rolls straight into the next
 * voyage, keeping the ship "underway" with the same `destination`. So this
 * underway→docked transition can only fire on the final destination.
 */
function arrivedAtFinalDestination(before: Ship, after: Ship): boolean {
  return (
    before.location.kind === "underway" &&
    after.location.kind === "docked" &&
    after.location.portId === before.location.destination
  );
}

export const useGameStore = create<GameState>()((set, get) => ({
  ...INITIAL,
  // Read once at store creation (docs/specs — Options / settings view: "load
  // the setting when the store initializes"); not part of INITIAL so
  // newGame/loadWorld/reset never reset a player's persisted preference.
  autoPauseOnArrival: loadSettings().autoPauseOnArrival,

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
    set((state) => ({
      speed,
      // A pause (any Speed === "paused") never overwrites lastActiveSpeed —
      // it keeps remembering the rate the player had running (#123).
      lastActiveSpeed: speed === "paused" ? state.lastActiveSpeed : speed,
    }));
    if (speed === "paused") {
      const { world } = get();
      if (world) saveAutosave(world);
    }
  },

  togglePause: () => {
    const { speed, lastActiveSpeed, setSpeed } = get();
    setSpeed(speed === "paused" ? lastActiveSpeed : "paused");
  },

  setAutoPauseOnArrival: (value) => {
    set({ autoPauseOnArrival: value });
    saveSettings({ autoPauseOnArrival: value });
  },

  select: (selection) => set({ selection }),

  selectRoute: (routeId) => set({ selectedRouteId: routeId }),

  openShip: (id) => set({ controlledShipId: id, selection: { kind: "ship", id } }),

  dispatch: (command) => {
    const { world } = get();
    if (!world) return;
    set({ world: applyCommand(world, command) });
  },

  advance: (elapsedMs) => {
    const { world, speed, carryMs, controlledShipId, autoPauseOnArrival } = get();
    if (!world) return;
    const { ticks, carryMs: nextCarry } = elapsedToTicks(speed, elapsedMs, carryMs);
    if (ticks === 0) {
      set({ carryMs: nextCarry });
      return;
    }
    const shipBefore = world.company.ships.find((s) => s.id === controlledShipId) ?? null;
    let next = world;
    for (let i = 0; i < ticks; i++) next = tick(next, []);
    set({ world: next, carryMs: nextCarry });
    // Autosave once whenever this advance crossed a 24-tick boundary, however
    // many ticks it folded (spec: autosave every 24 ticks).
    const interval = AUTOSAVE_INTERVAL_TICKS;
    if (Math.floor(next.tick / interval) > Math.floor(world.tick / interval)) {
      saveAutosave(next);
    }
    // Auto-pause on arrival (design-notes item 4): only on the Controlled
    // Ship's final-destination arrival, never intermediate ports; a no-op if
    // already paused (reuses setSpeed so it also autosaves, matching the
    // regular pause path).
    if (autoPauseOnArrival && speed !== "paused" && shipBefore) {
      const shipAfter = next.company.ships.find((s) => s.id === controlledShipId);
      if (shipAfter && arrivedAtFinalDestination(shipBefore, shipAfter)) {
        get().setSpeed("paused");
      }
    }
  },
}));
