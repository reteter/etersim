import { useGameStore } from "./store/gameStore";
import { useGameLoop } from "./store/useGameLoop";
import { PortPanel } from "./ui/PortPanel";
import { RegionMap } from "./ui/RegionMap";
import { ShipPanel } from "./ui/ShipPanel";
import { StartScreen } from "./ui/StartScreen";
import { TopBar } from "./ui/TopBar";

/**
 * Contextual side panel slot (docs/specs/E2-trade-loop.md — UI layout):
 * the market panel for a selected port, the hold/ETA panel for the ship.
 */
function SidePanel() {
  const selection = useGameStore((s) => s.selection);

  if (!selection) {
    return (
      <aside className="side-panel">
        <p className="side-panel__hint">Select a port or the ship to see details.</p>
      </aside>
    );
  }

  return selection.kind === "port" ? (
    <PortPanel portId={selection.id} />
  ) : (
    <ShipPanel shipId={selection.id} />
  );
}

function App() {
  useGameLoop();
  const world = useGameStore((s) => s.world);

  // No active world → the entry screen (Continue / New game). Starting or
  // loading a world flips this and swaps in the game view.
  if (!world) return <StartScreen />;

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
