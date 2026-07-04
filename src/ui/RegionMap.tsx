import type { Port, PortArchetype, Region, Ship } from "../sim";
import { useGameStore } from "../store/gameStore";
import { projectToViewBox } from "./mapProjection";
import { shipPosition } from "./shipPosition";

const VIEW_SIZE = 100;
const PADDING = 10;

/** Simple, distinct per-archetype glyphs (CONTEXT.md: Port archetype). */
const ARCHETYPE_GLYPHS: Record<PortArchetype, string> = {
  agrarian: "🌾",
  industrial: "⚙",
  urban: "🏙",
  mining: "⛏",
  verdant: "🌳",
};

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

  const portsById = new Map(region.ports.map((p) => [p.id, p]));
  const shipPos = project(shipPosition(ship, region));

  return (
    <svg
      className="region-map"
      viewBox={`0 0 ${VIEW_SIZE} ${VIEW_SIZE}`}
      role="img"
      aria-label="Region map"
    >
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
          return (
            <g
              key={port.id}
              className={isSelected ? "port port--selected" : "port"}
              onClick={() => select({ kind: "port", id: port.id })}
            >
              <circle cx={x} cy={y} r={3} />
              <text className="port__glyph" x={x} y={y + 1} textAnchor="middle">
                {ARCHETYPE_GLYPHS[port.archetype]}
              </text>
              <text className="port__label" x={x} y={y - 4} textAnchor="middle">
                {port.name}
              </text>
            </g>
          );
        })}
      </g>
      {/* Drawn last so it wins the hit test when overlapping a docked port. */}
      <g
        className={selection?.kind === "ship" ? "ship ship--selected" : "ship"}
        onClick={() => select({ kind: "ship", id: ship.id })}
      >
        <text className="ship__glyph" x={shipPos.x} y={shipPos.y + 1} textAnchor="middle">
          ⛵
        </text>
      </g>
    </svg>
  );
}
