import { cargoUsed, etaTicks, GOOD_IDS, GOODS, type ShipId } from "../sim";
import { useGameStore } from "../store/gameStore";

/**
 * Contextual panel for the selected ship (docs/specs/E2-trade-loop.md — UI
 * layout): hold contents, and destination with ETA in ticks while underway.
 */
export function ShipPanel({ shipId }: { shipId: ShipId }) {
  const world = useGameStore((s) => s.world);
  const select = useGameStore((s) => s.select);
  if (!world) return null;

  const ship = world.company.ships.find((s) => s.id === shipId);
  if (!ship) return null;

  const portName = (id: string) => world.region.ports.find((p) => p.id === id)?.name ?? id;
  const used = cargoUsed(ship);
  const loaded = GOOD_IDS.filter((good) => ship.cargo[good] > 0);
  const location = ship.location;

  return (
    <aside className="side-panel">
      <h2 className="side-panel__title">Ship</h2>
      {location.kind === "docked" ? (
        <p className="side-panel__subtitle">Docked at {portName(location.portId)}</p>
      ) : (
        <p className="side-panel__subtitle">
          Underway to {portName(location.destination)} — ETA {etaTicks(ship, world.region)} ticks
        </p>
      )}

      {/* The docked port's ⛵ overlaps its node on the map and wins the click,
          so open its market from here — the panel path to trading. */}
      {location.kind === "docked" && (
        <button
          type="button"
          className="sail-btn"
          onClick={() => select({ kind: "port", id: location.portId })}
        >
          Open market
        </button>
      )}

      <h3 className="side-panel__heading">
        Hold {used}/{ship.hold}
      </h3>
      {loaded.length === 0 ? (
        <p className="side-panel__hint">Empty</p>
      ) : (
        <ul className="hold">
          {loaded.map((good) => (
            <li key={good} className="hold__item">
              <span>{GOODS[good].name}</span>
              <span>{ship.cargo[good]}</span>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
