import { cargoUsed, etaTicks } from "../sim";
import { useGameStore } from "../store/gameStore";
import { ShipIcon } from "./icons";
import { portName } from "./portName";

/**
 * Thin, always-visible header for the Controlled Ship (docs/specs/E2-trade-loop.md
 * — #32). Sits at the top of the side panel across all panel states. Shows the
 * ship's icon + id, its status/location, and hold usage; clicking it designates
 * the ship as Controlled and opens its ShipPanel. The icon is always gold here
 * — this header only ever shows the Controlled Ship (#34).
 */
export function ControlledShipHeader() {
  const world = useGameStore((s) => s.world);
  const controlledShipId = useGameStore((s) => s.controlledShipId);
  const selection = useGameStore((s) => s.selection);
  const openShip = useGameStore((s) => s.openShip);

  if (!world || !controlledShipId) return null;
  const ship = world.company.ships.find((s) => s.id === controlledShipId);
  if (!ship) return null;

  const loc = ship.location;
  const name = (id: string) => portName(world.region, id);

  let status: string;
  if (loc.kind === "docked") {
    const viewingThisPort = selection?.kind === "port" && selection.id === loc.portId;
    status = viewingThisPort ? `Docked here — ${name(loc.portId)}` : `Docked at ${name(loc.portId)}`;
  } else {
    status = `Underway to ${name(loc.destination)} • ~${etaTicks(ship, world.region)}`;
  }

  return (
    <button
      type="button"
      className="ctrl-ship"
      onClick={() => openShip(ship.id)}
      aria-label={`Controlled ship ${ship.id}`}
    >
      <ShipIcon className="ctrl-ship__glyph" />
      <span className="ctrl-ship__id">{ship.id}</span>
      <span className="ctrl-ship__status">{status}</span>
      <span className="ctrl-ship__hold">
        {cargoUsed(ship)}/{ship.hold}
      </span>
    </button>
  );
}
