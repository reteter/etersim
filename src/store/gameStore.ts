import { create } from "zustand";
import {
  applyCommand,
  createWorld,
  elapsedToTicks,
  isRouteActive,
  tick,
  type Command,
  type GoodId,
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

/**
 * Routed-sale note (#398, pause-cause kin — #130): an ephemeral, UI-only
 * readout of the most recent routed **greedy** sell (a Stop's "sell all"
 * order, `StopOrder.qty === undefined`, route.ts) executed during the last
 * `advance()` — so the moment a Stop empties the hold of a good, the player
 * sees why (docs/design-notes/pause-cause-note-2026-07-14.md's pattern,
 * applied to an edge-triggered event instead of a level-triggered pause).
 * Derived entirely from values the sim already exposes (the Ledger's `trade`
 * events, tagged with `routeId` for a route-driven trade, plus the Route's
 * own Stop list to recover which Stop it was and confirm the order was
 * greedy) — no new sim event, no sim change. `stopIndex` is 1-based (matches
 * the roster's own `#{i+1}` numbering) and resolves to the *first* Stop on
 * the route selling `good` at `portId` with no qty cap; a route that sells
 * the same good at the same port twice (rare) picks the first such Stop.
 * Never serialized (not the save, not settings) — like `pauseCause`, a UI
 * state readout, not a domain concept. Persists until superseded by the next
 * qualifying sale or cleared by `newGame`/`loadWorld`/`reset` — no timer (no
 * `Date.now`/`setTimeout`), so it never flickers for a single frame at high
 * game speed.
 */
export interface RoutedSaleNote {
  readonly portName: string;
  readonly good: GoodId;
  readonly qty: number;
  readonly stopIndex: number;
}

/**
 * TopBar's overlays (#320): one field replaces three independent booleans
 * (`priceBoardOpen`/`ledgerOpen`/`headquartersOpen`) so opening one overlay
 * is structurally exclusive with the others — a fourth overlay costs a new
 * union member, not a new boolean. UI-only, never serialized.
 */
export type Overlay = "priceBoard" | "ledger" | "hq";

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
  /**
   * Ephemeral routed-sale readout (#398): the most recent routed greedy sell
   * `advance()` observed, or null before any has happened this session. See
   * `RoutedSaleNote` above. Never serialized.
   */
  readonly routedSaleNote: RoutedSaleNote | null;
  /**
   * Notice strip watermark (#97, moved to the store 2026-07-15 — issue #195
   * rider 2): the last world tick the player has seen settlement notices up
   * to. Seeded to the just-loaded world's tick by both `newGame` and
   * `loadWorld` — including a mid-session JSON import, which also calls
   * `loadWorld` (GameMenu.tsx) — so importing a save re-seeds this the same
   * way the initial mount does (owner decision, wave-check finding 3: seed =
   * current tick, never 0, to avoid flooding the badge with a save's entire
   * settlement history). UI-only: never serialized (not the save, not
   * settings).
   */
  readonly lastSeenTick: number;
  /**
   * The human-readable seed name the current world was created from (#221),
   * kept only in the store — `createWorld` hashes it into the RNG state and
   * discards it, so `World` itself carries no seed. Powers the export
   * filename (GameMenu.tsx). `newGame` sets it; `loadWorld` (JSON import, or
   * the autosave-continue path in StartScreen.tsx) nulls it — an imported or
   * resumed-from-autosave world has no seed name to offer. Not part of the
   * save shape.
   */
  readonly seed: string | null;
  /**
   * The overlay TopBar currently shows, or none (#320). At most one at a
   * time by construction — opening one replaces whatever was active, so
   * "two overlays stacked" is unrepresentable rather than merely prevented
   * by UI discipline.
   */
  readonly activeOverlay: Overlay | null;

  newGame(seed: number | string): void;
  loadWorld(world: World): void;
  reset(): void;
  /** Watermarks `lastSeenTick` to the current world tick (TopBar's notice
   *  strip, #97) — a no-op with no world loaded. */
  markNoticesSeen(): void;
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
  /** Opens `overlay`, replacing whatever was active (#320) — the single home
   *  for mutual exclusion, instead of each caller having to close the others. */
  openOverlay(overlay: Overlay): void;
  /** Closes the active overlay; a no-op if none is open. */
  closeOverlay(): void;
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
  routedSaleNote: null,
  lastSeenTick: 0,
  seed: null,
  activeOverlay: null as Overlay | null,
};

/**
 * Fleet-resolution selector (#319): "which of my ships is relevant here" for
 * a given context — the Controlled Ship (CONTEXT.md) if it still exists in
 * `world`, else the company's first ship, else none. The single place this
 * fallback logic lives; every surface that needs "the relevant ship" (the
 * store's own initial-selection seeding, `PortPanel`) resolves through this
 * instead of re-deriving the exact-match-then-first-ship pattern inline.
 */
export function resolveRelevantShip(world: World, controlledShipId: ShipId | null): Ship | null {
  const ships = world.company.ships;
  return ships.find((s) => s.id === controlledShipId) ?? ships[0] ?? null;
}

/** The Controlled Ship a fresh world starts with — the company's first ship. */
function initialControlledShip(world: World): ShipId | null {
  return resolveRelevantShip(world, null)?.id ?? null;
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
  return isRouteActive(ship);
}

/**
 * Scans the Ledger events appended since `before` (append-only, so a length
 * diff on `after.ledger` is exactly "what happened this `advance()`") for the
 * most recent routed greedy sell, and resolves it to a `RoutedSaleNote`
 * (#398). Returns null when no such event fired — the caller then keeps
 * whatever note was already showing (persist-until-superseded, no timer).
 */
function detectRoutedSaleNote(before: World, after: World): RoutedSaleNote | null {
  const newEvents = after.ledger.slice(before.ledger.length);
  for (let i = newEvents.length - 1; i >= 0; i--) {
    const event = newEvents[i];
    if (event.kind !== "trade" || event.side !== "sell" || event.routeId === undefined) continue;
    const route = after.company.routes.find((r) => r.id === event.routeId);
    if (!route) continue;
    const stopIndex = route.stops.findIndex(
      (stop) =>
        stop.portId === event.portId &&
        stop.orders.some(
          (order) => order.kind === "sell" && order.good === event.good && order.qty === undefined,
        ),
    );
    if (stopIndex === -1) continue; // not a greedy "sell all" order — no note
    const port = after.region.ports.find((p) => p.id === event.portId);
    return { portName: port?.name ?? event.portId, good: event.good, qty: event.qty, stopIndex: stopIndex + 1 };
  }
  return null;
}

export const useGameStore = create<GameState>()((set, get) => ({
  ...INITIAL,
  // Read once at store creation (docs/specs — Options / settings view: "load
  // the setting when the store initializes"); not part of INITIAL so
  // newGame/loadWorld/reset never reset a player's persisted preference.
  autoPauseOnArrival: loadSettings().autoPauseOnArrival,

  newGame: (seed) => {
    const world = createWorld(seed);
    set({
      ...INITIAL,
      world,
      speed: 1,
      controlledShipId: initialControlledShip(world),
      lastSeenTick: world.tick,
      seed: String(seed),
    });
  },

  loadWorld: (world) =>
    set({
      ...INITIAL,
      world,
      controlledShipId: initialControlledShip(world),
      lastSeenTick: world.tick,
    }),

  reset: () => set(INITIAL),

  markNoticesSeen: () => {
    const { world } = get();
    if (world) set({ lastSeenTick: world.tick });
  },

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

  openOverlay: (overlay) => set({ activeOverlay: overlay }),

  closeOverlay: () => set({ activeOverlay: null }),

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
    // #398: detect a routed greedy sell across every tick this advance folded
    // (the Ledger diff is length-based, so folding many ticks into one call
    // loses nothing — only the most recent qualifying sale is kept, matching
    // "persist until superseded").
    const routedSaleNote = detectRoutedSaleNote(world, next);
    set({ world: next, carryMs: nextCarry, ...(routedSaleNote ? { routedSaleNote } : {}) });
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
