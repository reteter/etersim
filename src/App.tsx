import { useGameStore } from "./store/gameStore";
import { useGameLoop } from "./store/useGameLoop";
import { FleetList } from "./ui/FleetList";
import { PortPanel } from "./ui/PortPanel";
import { RegionMap } from "./ui/RegionMap";
import { ShipPanel } from "./ui/ShipPanel";
import { StartScreen } from "./ui/StartScreen";
import { TopBar } from "./ui/TopBar";

/**
 * Contextual side panel (docs/specs/E9-fleet-and-routes.md — UX skeleton): the
 * always-visible Fleet list on top (#83, replaces the single-ship #32
 * header), then the market panel for a selected port or the hold/ETA panel
 * for a selected ship.
 */
function SidePanel() {
  const selection = useGameStore((s) => s.selection);

  return (
    <aside className="side-panel">
      <FleetList />
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
        <RegionMap
          region={world.region}
          ships={world.company.ships}
          shipyard={world.company.shipyard}
          osmosisPulse={world.osmosisPulse}
          tick={world.tick}
        />
        <SidePanel />
      </div>
    </div>
  );
}

export default App;
