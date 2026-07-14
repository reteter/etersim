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

/** Why the game is currently paused (#130 — pause-cause note): a UI-only
 *  readout, never a domain concept (docs/design-notes/pause-cause-note-2026-07-14.md).
 *  "manual" covers the pause button and its hotkey; "autoArrival" is the
 *  arrival auto-pause (see `advance` below). */
export type PauseCause = "manual" | "autoArrival";

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
  /**
   * Ephemeral pause-cause readout (#130), meaningful only while
   * `speed === "paused"`: null otherwise. Never serialized (not the save,
   * not settings) — a UI state readout, not a domain concept.
   */
  readonly pauseCause: PauseCause | null;

  newGame(seed: number | string): void;
  loadWorld(world: World): void;
  reset(): void;
  /** `cause` defaults to "manual" — every caller except the arrival
   *  auto-pause path (below) is a player-initiated pause. Ignored (and the
   *  cause cleared to null) when `speed !== "paused"`. */
  setSpeed(speed: Speed, cause?: PauseCause): void;
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
  pauseCause: null,
};

/** The Controlled Ship a fresh world starts with — the company's first ship. */
function initialControlledShip(world: World): ShipId | null {
  return world.company.ships[0]?.id ?? null;
}

/**
 * True when `before` was underway to some destination and `after` is now
 * docked at that same destination. `advanceShip` (src/sim/ship.ts) only
 * transitions a ship from "underway" to "docked" once its *course* is
 * exhausted; intermediate voyages within one course roll straight into the
 * next, keeping the ship "underway". So this fires at a course terminal —
 * but a route's per-leg courses each span a single Stop-to-Stop hop
 * (tick.ts `dispatchToStop`), so every route Stop is a course terminal too.
 * Distinguishing a manual sailTo's real destination from a route Stop needs
 * `underActiveRoute` below, not this geometry alone (#151).
 */
function arrivedAtCourseDestination(before: Ship, after: Ship): boolean {
  return (
    before.location.kind === "underway" &&
    after.location.kind === "docked" &&
    after.location.portId === before.location.destination
  );
}

/**
 * True when the ship is running a Route on autopilot (assigned, not
 * suspended). Such a ship has no *final* destination — it loops its Stops
 * forever — so arrival auto-pause must never fire for it (#151; design lock
 * trade-loop-followups.md §4: "not intermediate ports"). A manual sailTo
 * auto-suspends the assignment (commands.ts), flipping this false so the
 * arrival pauses as it did before the ship was ever routed.
 */
function underActiveRoute(ship: Ship): boolean {
  return ship.assignment !== undefined && !ship.assignment.suspended;
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
  setSpeed: (speed, cause = "manual") => {
    set((state) => ({
      speed,
      // A pause (any Speed === "paused") never overwrites lastActiveSpeed —
      // it keeps remembering the rate the player had running (#123).
      lastActiveSpeed: speed === "paused" ? state.lastActiveSpeed : speed,
      // #130: cause is only meaningful while paused; resuming (any non-paused
      // speed) always clears it, regardless of what set it.
      pauseCause: speed === "paused" ? cause : null,
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
    // regular pause path). A ship under active route autopilot is exempt — its
    // Stops are all intermediate, so it has no final destination to pause on
    // (#151).
    if (autoPauseOnArrival && speed !== "paused" && shipBefore) {
      const shipAfter = next.company.ships.find((s) => s.id === controlledShipId);
      if (
        shipAfter &&
        !underActiveRoute(shipAfter) &&
        arrivedAtCourseDestination(shipBefore, shipAfter)
      ) {
        get().setSpeed("paused", "autoArrival");
      }
    }
  },
}));
