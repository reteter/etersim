import { useState } from "react";
import {
  cargoUsed,
  etaTicks,
  GOOD_IDS,
  GOODS,
  isUnderRefit,
  MAX_SHIP_NAME_LENGTH,
  type PortId,
  type Ship,
  type ShipId,
} from "../sim";
import { useGameStore } from "../store/gameStore";
import { portName } from "./portName";

/**
 * Editable display-name field (#54): local input state so keystrokes don't
 * dispatch a Command each time, committed on blur/Enter via `renameShip`. An
 * empty/whitespace commit is silently reverted — a ship's name is always
 * present (sim rejects it too; this just avoids a jarring round-trip). The
 * caller keys this on `ship.id` so React remounts (and resyncs `value`) when
 * the panel switches to a different ship, instead of an effect-driven
 * setState (react-hooks/set-state-in-effect).
 */
function ShipNameField({ ship }: { ship: Ship }) {
  const dispatch = useGameStore((s) => s.dispatch);
  const [value, setValue] = useState(ship.name);

  const commit = () => {
    const trimmed = value.trim();
    if (trimmed && trimmed !== ship.name) {
      dispatch({ kind: "renameShip", shipId: ship.id, name: trimmed });
    } else {
      setValue(ship.name);
    }
  };

  return (
    <input
      className="ship-panel__name-input"
      type="text"
      value={value}
      maxLength={MAX_SHIP_NAME_LENGTH}
      aria-label="Ship name"
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") setValue(ship.name);
      }}
    />
  );
}

/**
 * Contextual panel for the selected ship (docs/specs/E2-trade-loop.md — UI
 * layout): hold contents, and destination with ETA in ticks while underway.
 * Market access lives in the port view (Harbor + Sail control, #33) — this
 * panel no longer hosts an "Open market" shortcut. The heading stays the
 * generic "Ship" label; the ship's own (editable) name lives in the field
 * right below it (#54/#83 — no raw id anywhere in the UI).
 */
export function ShipPanel({ shipId }: { shipId: ShipId }) {
  const world = useGameStore((s) => s.world);
  const select = useGameStore((s) => s.select);
  if (!world) return null;

  const ship = world.company.ships.find((s) => s.id === shipId);
  if (!ship) return null;

  const name = (id: PortId) => portName(world.region, id);
  const used = cargoUsed(ship);
  const loaded = GOOD_IDS.filter((good) => ship.cargo[good] > 0);
  const location = ship.location;

  // Opens the named Port's panel — the same `select` action the map's port
  // nodes dispatch (RegionMap.tsx `onClick`) — so the "Docked at"/"Underway
  // to" line doubles as a shortcut instead of a plain-text dead end (#196).
  const portLink = (portId: PortId) => (
    <button
      type="button"
      className="port-link"
      onClick={() => select({ kind: "port", id: portId })}
    >
      {name(portId)}
    </button>
  );

  return (
    <>
      <h2 className="side-panel__title">Ship</h2>
      <ShipNameField key={ship.id} ship={ship} />
      {isUnderRefit(world, ship.id) && (
        // "w przebudowie" status (#276, ADR-0006 — same violet as
        // FleetList's status word / the map's refit bubble, one meaning
        // everywhere it shows).
        <p className="ship-panel__status ship-panel__status--refit">W przebudowie</p>
      )}
      {location.kind === "docked" ? (
        <p className="side-panel__subtitle">Docked at {portLink(location.portId)}</p>
      ) : (
        <p className="side-panel__subtitle">
          Underway to {portLink(location.destination)} — ETA {etaTicks(ship, world.region)} ticks
        </p>
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
    </>
  );
}
