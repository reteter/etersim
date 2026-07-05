import { useState, type FormEvent } from "react";
import { useGameStore } from "../store/gameStore";
import { hasAutosave, loadAutosave } from "../store/persistence";

/**
 * Entry screen (docs/specs/E2-trade-loop.md — Save/load): Continue an
 * existing autosave, or start a New game with an optional seed (blank =
 * random). Shown by App whenever there is no active world.
 */
export function StartScreen() {
  const newGame = useGameStore((s) => s.newGame);
  const loadWorld = useGameStore((s) => s.loadWorld);
  const [seed, setSeed] = useState("");

  // Read once per render; nothing mutates storage while this screen is up.
  const canContinue = hasAutosave();

  const onContinue = () => {
    const world = loadAutosave();
    if (world) loadWorld(world);
  };

  const onNewGame = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = seed.trim();
    // Blank seed = random: Date.now() is fine in the UI layer (not in src/sim).
    newGame(trimmed === "" ? Date.now() : trimmed);
  };

  return (
    <main className="start-screen">
      <div className="start-screen__panel">
        <h1 className="start-screen__title">etersim</h1>
        <p className="start-screen__tagline">An aether-punk trading venture.</p>

        {canContinue && (
          <button
            type="button"
            className="start-btn start-btn--primary"
            onClick={onContinue}
          >
            Continue
          </button>
        )}

        <form className="start-screen__new" onSubmit={onNewGame}>
          <label className="start-screen__label" htmlFor="seed-input">
            Seed <span className="start-screen__note">(blank = random)</span>
          </label>
          <input
            id="seed-input"
            className="start-screen__seed"
            type="text"
            value={seed}
            placeholder="random"
            onChange={(e) => setSeed(e.target.value)}
          />
          <button type="submit" className="start-btn">
            New game
          </button>
        </form>
      </div>
    </main>
  );
}
