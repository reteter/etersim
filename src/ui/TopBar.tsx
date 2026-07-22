import { useEffect, useState } from "react";
import { isUnderRefit, SPEEDS, type Speed } from "../sim";
import { useGameStore } from "../store/gameStore";
import { GameMenu } from "./GameMenu";
import { HeadquartersPanel } from "./HeadquartersPanel";
import { LedgerOverlay } from "./LedgerOverlay";
import { PriceBoardOverlay } from "./PriceBoardOverlay";
import { sailability } from "./sailability";
import { formatWorldDate } from "./worldDate";

const SPEED_LABELS: Record<Speed, string> = {
  paused: "⏸",
  1: "1x",
  10: "10x",
  100: "100x",
};

/** Text-entry elements the global hotkeys must not hijack (e.g. the seed
 *  input, market quantity fields, route-editor selects) while focused. */
const TEXT_INPUT_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

/** Digit hotkey → speed rate (#56, v1-lite fixed bindings): 1/2/3 map to the
 *  three running rates in `SPEEDS`. Pause has no digit — `<space>` owns it. */
const DIGIT_SPEEDS: Record<string, Speed> = { "1": 1, "2": 10, "3": 100 };

/** Top bar (docs/specs/E2-trade-loop.md — UI layout): thalers, world date,
 *  speed controls wired to the store's speed ladder, plus the region price
 *  board entry (#62) — a button and a default "b" hotkey, both toggling the
 *  same overlay. Speed/pause hotkeys (#56): <space> toggles pause, 1/2/3 set
 *  the rate. "g" (#217, playtest 2026-07-15) sails the Controlled Ship to the
 *  currently selected port, composing with "b" — a silent no-op (no alert,
 *  matching "b") whenever there's no Controlled Ship, the selection isn't a
 *  port, or `sailability` (sailability.ts, shared with PortPanel's Sail
 *  button) disables the sail for the
 *  same reason (underway / already docked / no course). All bindings are
 *  fixed (v1-lite) and listed in the Options → Keybinds tab; remappable
 *  bindings are deferred. */
export function TopBar() {
  const thalers = useGameStore((s) => s.world?.company.thalers ?? 0);
  const tick = useGameStore((s) => s.world?.tick ?? 0);
  const ledger = useGameStore((s) => s.world?.ledger ?? []);
  const lastSeenTick = useGameStore((s) => s.lastSeenTick);
  const markNoticesSeen = useGameStore((s) => s.markNoticesSeen);
  const speed = useGameStore((s) => s.speed);
  const pauseCause = useGameStore((s) => s.pauseCause);
  const setSpeed = useGameStore((s) => s.setSpeed);
  const togglePause = useGameStore((s) => s.togglePause);
  const hasHeadquarters = useGameStore((s) => !!s.world?.company.headquarters);
  const activeOverlay = useGameStore((s) => s.activeOverlay);
  const setActiveOverlay = useGameStore((s) => s.setActiveOverlay);
  // Which tab the board shows (#96's PriceBoardOverlay `tab`/`onTabChange`
  // props — controlled, not a mount-once `initialTab`, since #195 rider 1
  // needs a notice click to retarget the tab even while the board is already
  // open): "ceny" for every existing entry point (button, "b" hotkey —
  // unchanged behavior), "kontrakty" whenever the notice strip opens (or
  // re-targets) the board, so the click always lands on the settlement audit
  // trail regardless of what was showing before.
  const [priceBoardTab, setPriceBoardTab] = useState<"ceny" | "kontrakty">("ceny");
  // Notice strip (#97, 2026-07-14 UI grill lock 1 — replaces the spec's
  // phantom "toast pattern"): UI-side only, never the save shape. Notices are
  // derived from Ledger `settlement` events appended since `lastSeenTick` —
  // immune to tick-folding at 10x/100x by construction, since every settled
  // period appends its own event regardless of how many ticks one `advance`
  // call folds together. `lastSeenTick` lives in the store now (#195 rider 2)
  // — seeded on both `newGame` and `loadWorld`, so a mid-session JSON import
  // (also `loadWorld`, GameMenu.tsx) re-seeds it to the imported world's tick
  // exactly like the initial mount does, instead of flooding/hiding notices
  // against the previous world's watermark.
  const noticeCount = ledger.filter((e) => e.kind === "settlement" && e.tick > lastSeenTick).length;
  const openNotices = () => {
    setPriceBoardTab("kontrakty");
    setActiveOverlay("priceBoard");
    markNoticesSeen();
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && TEXT_INPUT_TAGS.has(target.tagName)) return;
      // <space> toggles pause ↔ last running speed (#56). preventDefault stops
      // the page scroll and any re-trigger of the focused button.
      if (e.key === " ") {
        e.preventDefault();
        togglePause();
        return;
      }
      const digitSpeed = DIGIT_SPEEDS[e.key];
      if (digitSpeed !== undefined) {
        setSpeed(digitSpeed);
        return;
      }
      if (e.key.toLowerCase() === "b") {
        const open = useGameStore.getState().activeOverlay === "priceBoard";
        if (!open) setPriceBoardTab("ceny");
        setActiveOverlay(open ? null : "priceBoard");
        return;
      }
      // "g" (#217): sail the Controlled Ship to the selected port — same
      // effect, same gate, as PortPanel's Sail button. Live state is read via
      // getState() rather than closed-over selector values on purpose: the
      // listener registers once on mount, so a closed-over value would freeze
      // at its first-render snapshot (controlledShipId starts null), while
      // adding world/selection/controlledShipId to the deps array below would
      // re-register the listener every tick (world changes every tick at
      // 100x) — a perf storm for no benefit, since the store already reads
      // live state the same way internally.
      if (e.key.toLowerCase() === "g") {
        const { world, controlledShipId, selection, dispatch } = useGameStore.getState();
        if (!world || !controlledShipId) return;
        if (!selection || selection.kind !== "port") return;
        const ship = world.company.ships.find((s) => s.id === controlledShipId);
        if (!ship) return;
        const { disabledHint } = sailability(ship, selection.id, world.region, isUnderRefit(world, ship.id));
        if (disabledHint !== null) return;
        dispatch({ kind: "sailTo", shipId: ship.id, portId: selection.id });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [togglePause, setSpeed, setActiveOverlay]);

  return (
    <header className="top-bar">
      <span className="top-bar__thalers">₸ {thalers}</span>
      <span className="top-bar__date">{formatWorldDate(tick)}</span>
      <div className="top-bar__speed-group">
        <div className="top-bar__speed" role="group" aria-label="Speed controls">
          {SPEEDS.map((s) => (
            <button
              key={String(s)}
              type="button"
              className={s === speed ? "speed-btn speed-btn--active" : "speed-btn"}
              aria-pressed={s === speed}
              // The pause button toggles: pausing remembers the running speed,
              // unpausing restores it (#123) — instead of resetting to 1x. The
              // rate buttons stay explicit overrides regardless of pause state.
              onClick={() => (s === "paused" ? togglePause() : setSpeed(s))}
            >
              {SPEED_LABELS[s]}
            </button>
          ))}
        </div>
        {/* Pause-cause readout (#130): answers "why is the game stopped?"
            whenever it isn't "you pressed pause" — every time the automatic
            arrival pause fires, not a one-time hint (design-notes/pause-cause-note). */}
        {pauseCause === "autoArrival" && (
          <p className="top-bar__pause-note" role="status">
            auto-pauza: statek zacumował (wyłączalna w Opcjach)
          </p>
        )}
      </div>
      {/* Persistent compact strip (grill lock 1): click opens (or retargets,
          #195 rider 1) the board straight to the Kontrakty tab, where the
          settlement audit trail lives (#96's PriceBoardOverlay `tab` prop). */}
      <button type="button" className="notice-strip" onClick={openNotices}>
        Powiadomienia
        {noticeCount > 0 && <span className="notice-strip__badge">{noticeCount}</span>}
      </button>
      <button
        type="button"
        className="menu-btn"
        onClick={() => {
          setPriceBoardTab("ceny");
          setActiveOverlay("priceBoard");
        }}
      >
        Price Board
      </button>
      <button type="button" className="menu-btn" onClick={() => setActiveOverlay("ledger")}>
        Ledger
      </button>
      {/* Persistent shortcut once the Headquarters is founded (docs/specs/E9
          — UX skeleton: "a persistent TopBar shortcut once founded"). */}
      {hasHeadquarters && (
        <button type="button" className="menu-btn" onClick={() => setActiveOverlay("hq")}>
          Headquarters
        </button>
      )}
      <GameMenu />
      {activeOverlay === "priceBoard" && (
        <PriceBoardOverlay
          onClose={() => setActiveOverlay(null)}
          tab={priceBoardTab}
          onTabChange={setPriceBoardTab}
        />
      )}
      {activeOverlay === "ledger" && <LedgerOverlay onClose={() => setActiveOverlay(null)} />}
      {activeOverlay === "hq" && <HeadquartersPanel onClose={() => setActiveOverlay(null)} />}
    </header>
  );
}
