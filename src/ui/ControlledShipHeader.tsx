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
  const select = useGameStore((s) => s.select);

  if (!world || !controlledShipId) return null;
  const ship = world.company.ships.find((s) => s.id === controlledShipId);
  if (!ship) return null;

  const loc = ship.location;
  const name = (id: string) => portName(world.region, id);

  const viewingThisShip = selection?.kind === "ship" && selection.id === ship.id;

  let status: string;
  if (loc.kind === "docked") {
    // "Docked here" whenever the header points at its own port context —
    // either the port panel is open, or the ship panel is (and clicking
    // toggles back to that port). Reads as the anchor of the toggle (#5).
    const atThisPortContext =
      (selection?.kind === "port" && selection.id === loc.portId) || viewingThisShip;
    status = atThisPortContext ? `Docked here — ${name(loc.portId)}` : `Docked at ${name(loc.portId)}`;
  } else {
    status = `Underway to ${name(loc.destination)} • ~${etaTicks(ship, world.region)}`;
  }

  // Toggle (#5): from the ShipPanel of a docked ship, return to its port
  // panel; otherwise open the ShipPanel. Underway there is no port to
  // toggle to, so it just (re)opens the ShipPanel.
  const handleClick =
    viewingThisShip && loc.kind === "docked"
      ? () => select({ kind: "port", id: loc.portId })
      : () => openShip(ship.id);

  return (
    <button
      type="button"
      className="ctrl-ship"
      onClick={handleClick}
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
