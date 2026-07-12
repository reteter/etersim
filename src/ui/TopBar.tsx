import { useEffect, useState } from "react";
import { SPEEDS, type Speed } from "../sim";
import { useGameStore } from "../store/gameStore";
import { GameMenu } from "./GameMenu";
import { HeadquartersPanel } from "./HeadquartersPanel";
import { LedgerOverlay } from "./LedgerOverlay";
import { PriceBoardOverlay } from "./PriceBoardOverlay";
import { formatWorldDate } from "./worldDate";

const SPEED_LABELS: Record<Speed, string> = {
  paused: "⏸",
  1: "1x",
  10: "10x",
  100: "100x",
};

/** Text-entry elements the "b" hotkey must not hijack (e.g. the seed input,
 *  market quantity fields) while they're focused. */
const TEXT_INPUT_TAGS = new Set(["INPUT", "TEXTAREA"]);

/** Top bar (docs/specs/E2-trade-loop.md — UI layout): thalers, world date,
 *  speed controls wired to the store's speed ladder, plus the region price
 *  board entry (#62) — a button and a default "b" hotkey, both toggling the
 *  same overlay. Hotkey configurability is deferred to #56. */
export function TopBar() {
  const thalers = useGameStore((s) => s.world?.company.thalers ?? 0);
  const tick = useGameStore((s) => s.world?.tick ?? 0);
  const speed = useGameStore((s) => s.speed);
  const setSpeed = useGameStore((s) => s.setSpeed);
  const hasHeadquarters = useGameStore((s) => !!s.world?.company.headquarters);
  const [priceBoardOpen, setPriceBoardOpen] = useState(false);
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [headquartersOpen, setHeadquartersOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && TEXT_INPUT_TAGS.has(target.tagName)) return;
      if (e.key.toLowerCase() !== "b") return;
      setPriceBoardOpen((open) => !open);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <header className="top-bar">
      <span className="top-bar__thalers">₸ {thalers}</span>
      <span className="top-bar__date">{formatWorldDate(tick)}</span>
      <div className="top-bar__speed" role="group" aria-label="Speed controls">
        {SPEEDS.map((s) => (
          <button
            key={String(s)}
            type="button"
            className={s === speed ? "speed-btn speed-btn--active" : "speed-btn"}
            aria-pressed={s === speed}
            onClick={() => setSpeed(s)}
          >
            {SPEED_LABELS[s]}
          </button>
        ))}
      </div>
      <button type="button" className="menu-btn" onClick={() => setPriceBoardOpen(true)}>
        Price Board
      </button>
      <button type="button" className="menu-btn" onClick={() => setLedgerOpen(true)}>
        Ledger
      </button>
      {/* Persistent shortcut once the Headquarters is founded (docs/specs/E9
          — UX skeleton: "a persistent TopBar shortcut once founded"). */}
      {hasHeadquarters && (
        <button type="button" className="menu-btn" onClick={() => setHeadquartersOpen(true)}>
          Headquarters
        </button>
      )}
      <GameMenu />
      {priceBoardOpen && <PriceBoardOverlay onClose={() => setPriceBoardOpen(false)} />}
      {ledgerOpen && <LedgerOverlay onClose={() => setLedgerOpen(false)} />}
      {headquartersOpen && <HeadquartersPanel onClose={() => setHeadquartersOpen(false)} />}
    </header>
  );
}
