import type { ComponentType, CSSProperties, SVGProps } from "react";
import type { Port, PortArchetype, Region, Ship } from "../sim";
import { useGameStore } from "../store/gameStore";
import { AgrarianIcon, IndustrialIcon, MiningIcon, ShipIcon, UrbanIcon, VerdantIcon } from "./icons";
import { projectToViewBox } from "./mapProjection";
import { shipPosition } from "./shipPosition";

const VIEW_SIZE = 100;
const PADDING = 10;
const SHIP_ICON_SIZE = 4;
const PORT_ICON_SIZE = 3.5;
const PORT_DISC_RADIUS = 3;
/** projectToViewBox is a uniform scale (both axes), so this factor also
 *  converts a unit-plane distance (orbit radius) into viewBox units. */
const SCALE = VIEW_SIZE - 2 * PADDING;
const CENTER = { x: 0.5, y: 0.5 };

/** Archetype → vendored SVG icon (#34, docs/adr/0006-svg-icon-strategy.md). */
const ARCHETYPE_ICONS: Record<PortArchetype, ComponentType<SVGProps<SVGSVGElement>>> = {
  agrarian: AgrarianIcon,
  industrial: IndustrialIcon,
  urban: UrbanIcon,
  mining: MiningIcon,
  verdant: VerdantIcon,
};

/** Orbit ring radius (viewBox units): distance from the region center
 *  (0.5, 0.5) to the port, in unit-plane space, then projected. Nothing new
 *  is persisted — the ring is derived from the port's existing x/y (CONTEXT.md:
 *  Orbit ring). */
function ringRadius(port: Pick<Port, "x" | "y">): number {
  const dx = port.x - CENTER.x;
  const dy = port.y - CENTER.y;
  return Math.sqrt(dx * dx + dy * dy) * SCALE;
}

function project(point: Pick<Port, "x" | "y">): { x: number; y: number } {
  return {
    x: projectToViewBox(point.x, VIEW_SIZE, PADDING),
    y: projectToViewBox(point.y, VIEW_SIZE, PADDING),
  };
}

/**
 * SVG region map (docs/specs/E2-trade-loop.md — UI layout): ports as nodes,
 * lanes as edges, the ship positioned by shipPosition(). Clicking a port or
 * the ship updates the store's selection.
 */
export function RegionMap({ region, ship }: { region: Region; ship: Ship }) {
  const selection = useGameStore((s) => s.selection);
  const select = useGameStore((s) => s.select);
  const openShip = useGameStore((s) => s.openShip);
  const controlledShipId = useGameStore((s) => s.controlledShipId);

  const portsById = new Map(region.ports.map((p) => [p.id, p]));
  const shipPos = project(shipPosition(ship, region));
  const center = project(CENTER);

  return (
    <svg
      className="region-map"
      viewBox={`0 0 ${VIEW_SIZE} ${VIEW_SIZE}`}
      role="img"
      aria-label="Region map"
    >
      <defs>
        <radialGradient id="star-gradient" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fff6d8" />
          <stop offset="55%" stopColor="#f2c46b" />
          <stop offset="100%" stopColor="#c98a2e" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* Star: pure decoration (docs/specs/E10-orrery-view.md — Planets, star,
          glow), not clickable, no mechanics. */}
      <g className="region-map__star" aria-hidden="true">
        <circle className="star__glow" cx={center.x} cy={center.y} r={7} />
        <circle
          className="star__disc"
          cx={center.x}
          cy={center.y}
          r={3.5}
          fill="url(#star-gradient)"
        />
      </g>
      {/* Orbit rings: weakest layer in the visual hierarchy (planets >
          accented lanes > default lanes > rings), radii derived from each
          port's existing position — nothing new persisted. */}
      <g className="region-map__rings" aria-hidden="true">
        {region.ports.map((port) => (
          <circle
            key={port.id}
            className="orbit-ring"
            cx={center.x}
            cy={center.y}
            r={ringRadius(port)}
          />
        ))}
      </g>
      <g className="region-map__lanes">
        {region.lanes.map((lane) => {
          const a = project(portsById.get(lane.a)!);
          const b = project(portsById.get(lane.b)!);
          return <line key={lane.id} className="lane" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
        })}
      </g>
      <g className="region-map__ports">
        {region.ports.map((port) => {
          const { x, y } = project(port);
          const isSelected = selection?.kind === "port" && selection.id === port.id;
          const Icon = ARCHETYPE_ICONS[port.archetype];
          return (
            <g
              key={port.id}
              className={isSelected ? "port port--selected" : "port"}
              data-archetype={port.archetype}
              style={{ "--port-color": `var(--archetype-${port.archetype})` } as CSSProperties}
              onClick={() => select({ kind: "port", id: port.id })}
            >
              <circle className="port__disc" cx={x} cy={y} r={PORT_DISC_RADIUS} />
              <Icon
                className="port__icon"
                x={x - PORT_ICON_SIZE / 2}
                y={y - PORT_ICON_SIZE / 2}
                width={PORT_ICON_SIZE}
                height={PORT_ICON_SIZE}
              />
              <text className="port__label" x={x} y={y - 4} textAnchor="middle">
                {port.name}
              </text>
            </g>
          );
        })}
      </g>
      {/* Drawn last so it stays visible on top, but a docked ship is
          click-through (pointer-events: none) so the port beneath wins the
          hit test — port-click priority (#28). Underway it stays clickable to
          designate it Controlled and open its ShipPanel. Gold marks the
          Controlled Ship (#34) — a separate signal from UI panel selection;
          selection/course accents are #45. */}
      <g
        className={
          (ship.id === controlledShipId ? "ship ship--controlled" : "ship") +
          (ship.location.kind === "docked" ? " ship--docked" : "")
        }
        onClick={() => openShip(ship.id)}
      >
        <ShipIcon
          className="ship__glyph"
          x={shipPos.x - SHIP_ICON_SIZE / 2}
          y={shipPos.y - SHIP_ICON_SIZE / 2}
          width={SHIP_ICON_SIZE}
          height={SHIP_ICON_SIZE}
        />
      </g>
    </svg>
  );
}
