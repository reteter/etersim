import { useGameStore } from "../store/gameStore";

/**
 * Options/settings overlay (#37): a unified settings surface reconciled with
 * the #17 menu (GameMenu.tsx) rather than a separate/duplicate one. First
 * tenant is the auto-pause-on-arrival toggle (#36); persists via
 * `setAutoPauseOnArrival`, which writes the standalone settings localStorage
 * key (src/store/settings.ts) independent of game saves.
 */
export function OptionsOverlay({ onClose }: { onClose: () => void }) {
  const autoPauseOnArrival = useGameStore((s) => s.autoPauseOnArrival);
  const setAutoPauseOnArrival = useGameStore((s) => s.setAutoPauseOnArrival);

  return (
    <div className="overlay" role="dialog" aria-label="Options" aria-modal="true">
      <div className="overlay__panel">
        <h2 className="overlay__title">Options</h2>
        <label className="overlay__row">
          <input
            type="checkbox"
            checked={autoPauseOnArrival}
            onChange={(e) => setAutoPauseOnArrival(e.target.checked)}
          />
          Auto-pause on arrival
        </label>
        <button type="button" className="menu-btn" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
