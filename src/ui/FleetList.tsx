import { cargoUsed, etaTicks, type Region, type Route, type Ship } from "../sim";
import { useGameStore } from "../store/gameStore";
import { ShipIcon } from "./icons";
import { portName } from "./portName";

/**
 * Fleet list (docs/specs/E9-fleet-and-routes.md — UX skeleton, #83): replaces
 * the single-ship `ControlledShipHeader`. Always-visible at the top of the
 * side panel — every Company ship, its status and assigned Route (by name,
 * never id); clicking a row designates it the Controlled Ship, the same
 * click-to-designate mechanic Harbor and the map already use (#28/#32).
 */

/** One status word per ship, in priority order: a suspended assignment beats
 *  "on route" (still assigned, just not driving right now), which beats the
 *  raw location state. Matches the AC vocabulary exactly (docked / underway /
 *  on route / suspended) so the four values are mutually exclusive. */
function statusLabel(ship: Ship, region: Region): string {
  const loc = ship.location;
  const locDetail =
    loc.kind === "docked"
      ? `at ${portName(region, loc.portId)}`
      : `to ${portName(region, loc.destination)} · ~${etaTicks(ship, region)}`;
  if (ship.assignment?.suspended) return `Suspended — ${locDetail}`;
  if (ship.assignment) return `On route — ${locDetail}`;
  return loc.kind === "docked" ? `Docked ${locDetail}` : `Underway ${locDetail}`;
}

/** The assigned Route's display name, or null if unassigned or (edge case)
 *  the route was deleted out from under a still-assigned ship. Binds
 *  `ship.assignment` to a local so TS narrows it inside the closure below —
 *  a repeated property read wouldn't narrow, forcing a `!` otherwise. */
function routeName(ship: Ship, routes: readonly Route[]): string | null {
  const assignment = ship.assignment;
  if (!assignment) return null;
  return routes.find((r) => r.id === assignment.routeId)?.name ?? null;
}

export function FleetList() {
  const world = useGameStore((s) => s.world);
  const controlledShipId = useGameStore((s) => s.controlledShipId);
  const openShip = useGameStore((s) => s.openShip);

  if (!world) return null;
  const { ships, routes } = world.company;
  if (ships.length === 0) return null;

  return (
    <div className="fleet-list">
      <h3 className="side-panel__heading fleet-list__heading">Fleet</h3>
      <ul className="fleet-list__items">
        {ships.map((ship) => {
          const controlled = ship.id === controlledShipId;
          const route = routeName(ship, routes);
          return (
            <li key={ship.id}>
              <button
                type="button"
                className={controlled ? "fleet-list__item fleet-list__item--controlled" : "fleet-list__item"}
                onClick={() => openShip(ship.id)}
                aria-label={`Ship ${ship.name}`}
              >
                <ShipIcon
                  className={
                    controlled ? "fleet-list__glyph fleet-list__glyph--controlled" : "fleet-list__glyph"
                  }
                />
                <span className="fleet-list__name">{ship.name}</span>
                <span className="fleet-list__status">{statusLabel(ship, world.region)}</span>
                {route && <span className="fleet-list__route">{route}</span>}
                <span className="fleet-list__hold">
                  {cargoUsed(ship)}/{ship.hold}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
