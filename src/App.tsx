import { useEffect } from "react";
import { etaTicks } from "./sim";
import { useGameStore } from "./store/gameStore";
import { useGameLoop } from "./store/useGameLoop";
import { RegionMap } from "./ui/RegionMap";
import { TopBar } from "./ui/TopBar";

/**
 * Contextual side panel slot (docs/specs/E2-trade-loop.md — UI layout).
 * Lightweight placeholder for now: full market/ship panels are #16.
 */
function SidePanel() {
  const world = useGameStore((s) => s.world);
  const selection = useGameStore((s) => s.selection);

  if (!world || !selection) {
    return (
      <aside className="side-panel">
        <p className="side-panel__hint">Select a port or the ship to see details.</p>
      </aside>
    );
  }

  if (selection.kind === "port") {
    const port = world.region.ports.find((p) => p.id === selection.id);
    if (!port) return null;
    return (
      <aside className="side-panel">
        <h2>{port.name}</h2>
        <p>Archetype: {port.archetype}</p>
      </aside>
    );
  }

  const ship = world.company.ships.find((s) => s.id === selection.id);
  if (!ship) return null;
  const location = ship.location;
  return (
    <aside className="side-panel">
      <h2>Ship</h2>
      {location.kind === "docked" ? (
        <p>Docked at {world.region.ports.find((p) => p.id === location.portId)?.name}</p>
      ) : (
        <p>
          Underway to {world.region.ports.find((p) => p.id === location.destination)?.name}
          {" — ETA "}
          {etaTicks(ship, world.region)} ticks
        </p>
      )}
    </aside>
  );
}

function App() {
  useGameLoop();
  const world = useGameStore((s) => s.world);
  const newGame = useGameStore((s) => s.newGame);

  // No StartScreen yet (that's a later issue): bootstrap a fresh world once
  // on mount. Guarded against React StrictMode's double effect invocation.
  useEffect(() => {
    if (!useGameStore.getState().world) newGame(Date.now());
  }, [newGame]);

  if (!world) {
    return (
      <main className="app">
        <p>Generating world...</p>
      </main>
    );
  }

  return (
    <div className="app">
      <TopBar />
      <div className="app__body">
        <RegionMap region={world.region} ship={world.company.ships[0]} />
        <SidePanel />
      </div>
    </div>
  );
}

export default App;
