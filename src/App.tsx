import { useGameStore } from "./store/gameStore";
import { useGameLoop } from "./store/useGameLoop";
import { ControlledShipHeader } from "./ui/ControlledShipHeader";
import { PortPanel } from "./ui/PortPanel";
import { RegionMap } from "./ui/RegionMap";
import { ShipPanel } from "./ui/ShipPanel";
import { StartScreen } from "./ui/StartScreen";
import { TopBar } from "./ui/TopBar";

/**
 * Contextual side panel (docs/specs/E2-trade-loop.md — UI layout): the
 * always-visible Controlled Ship header on top (#32), then the market panel
 * for a selected port or the hold/ETA panel for a selected ship.
 */
function SidePanel() {
  const selection = useGameStore((s) => s.selection);

  return (
    <aside className="side-panel">
      <ControlledShipHeader />
      {!selection ? (
        <p className="side-panel__hint">Select a port or the ship to see details.</p>
      ) : selection.kind === "port" ? (
        <PortPanel portId={selection.id} />
      ) : (
        <ShipPanel shipId={selection.id} />
      )}
    </aside>
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
        <RegionMap region={world.region} ship={world.company.ships[0]} osmosisPulse={world.osmosisPulse} />
        <SidePanel />
      </div>
    </div>
  );
}

export default App;
