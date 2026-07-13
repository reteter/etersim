import { useState } from "react";
import { useGameStore } from "../store/gameStore";

type Tab = "general" | "keybinds";

/** The fixed key bindings surfaced read-only in the Keybinds tab (#56,
 *  v1-lite). Source of truth for the *behaviour* is TopBar's keydown handler;
 *  this list mirrors it for discoverability. Remappable bindings are deferred,
 *  so a static list is the whole feature here. */
const KEYBINDS: ReadonlyArray<{ keys: string; action: string }> = [
  { keys: "Space", action: "Pause / resume" },
  { keys: "1 / 2 / 3", action: "Speed 1x / 10x / 100x" },
  { keys: "B", action: "Price Board" },
];

/**
 * Options/settings overlay (#37): a unified settings surface reconciled with
 * the #17 menu (GameMenu.tsx) rather than a separate/duplicate one. Two tabs
 * (#56): "General" holds the auto-pause-on-arrival toggle (#36, persisted via
 * `setAutoPauseOnArrival` → the standalone settings localStorage key,
 * src/store/settings.ts); "Keybinds" lists the fixed speed/pause hotkeys
 * read-only. "General" is the default tab so the toggle stays first-class.
 */
export function OptionsOverlay({ onClose }: { onClose: () => void }) {
  const autoPauseOnArrival = useGameStore((s) => s.autoPauseOnArrival);
  const setAutoPauseOnArrival = useGameStore((s) => s.setAutoPauseOnArrival);
  const [tab, setTab] = useState<Tab>("general");

  return (
    <div className="overlay" role="dialog" aria-label="Options" aria-modal="true">
      <div className="overlay__panel">
        <h2 className="overlay__title">Options</h2>
        <div className="options__tabs" role="tablist" aria-label="Options tabs">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "general"}
            className={tab === "general" ? "options__tab options__tab--active" : "options__tab"}
            onClick={() => setTab("general")}
          >
            General
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "keybinds"}
            className={tab === "keybinds" ? "options__tab options__tab--active" : "options__tab"}
            onClick={() => setTab("keybinds")}
          >
            Keybinds
          </button>
        </div>

        {tab === "general" ? (
          <label className="overlay__row">
            <input
              type="checkbox"
              checked={autoPauseOnArrival}
              onChange={(e) => setAutoPauseOnArrival(e.target.checked)}
            />
            Auto-pause on arrival
          </label>
        ) : (
          <dl className="keybinds">
            {KEYBINDS.map(({ keys, action }) => (
              <div className="keybinds__row" key={keys}>
                <dt className="keybinds__keys">{keys}</dt>
                <dd className="keybinds__action">{action}</dd>
              </div>
            ))}
          </dl>
        )}

        <button type="button" className="menu-btn" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
