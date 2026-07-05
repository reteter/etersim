import { SPEEDS, type Speed } from "../sim";
import { useGameStore } from "../store/gameStore";
import { GameMenu } from "./GameMenu";
import { formatWorldDate } from "./worldDate";

const SPEED_LABELS: Record<Speed, string> = {
  paused: "⏸",
  1: "1x",
  10: "10x",
  100: "100x",
};

/** Top bar (docs/specs/E2-trade-loop.md — UI layout): thalers, world date,
 *  speed controls wired to the store's speed ladder. */
export function TopBar() {
  const thalers = useGameStore((s) => s.world?.company.thalers ?? 0);
  const tick = useGameStore((s) => s.world?.tick ?? 0);
  const speed = useGameStore((s) => s.speed);
  const setSpeed = useGameStore((s) => s.setSpeed);

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
      <GameMenu />
    </header>
  );
}
