import { useState, type ComponentType, type CSSProperties, type ReactNode, type SVGProps } from "react";
import { shortestRoute, type LaneId, type Port, type PortArchetype, type PortId, type Region, type Ship, type Voyage } from "../sim";
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

/** Ambient osmosis layer (docs/specs/E8-living-economy.md — Ambient ships):
 *  lanes whose |osmosisPulse| stays at or below this display threshold read
 *  as quiet — the "quieter lanes" calm of PR #55. Threshold is in the same
 *  value-weighted units as `osmosisPulse` (thalers moved this tick);
 *  tuning is not spec drift. */
const PULSE_DISPLAY_THRESHOLD = 1;
/** Pulse dot radius (viewBox units) — clearly smaller than SHIP_ICON_SIZE
 *  (4): signal moving through the network, not a vessel. */
const PULSE_RADIUS = 0.5;
/** Dot count and speed both grow with magnitude, one extra dot (and a
 *  proportionally shorter travel duration) per this many units of flow,
 *  capped so a very hot lane doesn't turn into clutter. */
const PULSE_INTENSITY_SCALE = 4;
const PULSE_MAX_COUNT = 4;
/** Travel duration (seconds) for a barely-active lane; speed scales up
 *  (duration shrinks) with magnitude down to this floor. */
const PULSE_DURATION_BASE = 2.4;
const PULSE_DURATION_MIN = 0.7;
/** prefers-reduced-motion (owner call, 2026-07-08): dots freeze in place
 *  instead of animating, so opacity carries the intensity signal instead —
 *  bounds below. */
const PULSE_STATIC_OPACITY_MIN = 0.45;
const PULSE_STATIC_OPACITY_MAX = 1;

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

/** Projects a lane's two endpoints given which port id is the source and
 *  which is the destination — the lanes layer (course direction) and the
 *  osmosis layer (flow sign) each pick `fromId`/`toId` differently but share
 *  this lookup + projection step. */
function laneEndpoints(
  portsById: Map<PortId, Port>,
  fromId: PortId,
  toId: PortId,
): { from: { x: number; y: number }; to: { x: number; y: number } } {
  return { from: project(portsById.get(fromId)!), to: project(portsById.get(toId)!) };
}

const LANE_LABEL_OFFSET = 2.5;

/** Midpoint of an accented lane, nudged perpendicular to the line so the
 *  tick label doesn't sit on top of the stroke (docs/specs/E10-orrery-view.md
 *  — Lane presentation: labels appear only on accented lanes). */
function laneLabelPosition(a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy) || 1;
  return {
    x: (a.x + b.x) / 2 + (-dy / length) * LANE_LABEL_OFFSET,
    y: (a.y + b.y) / 2 + (dx / length) * LANE_LABEL_OFFSET,
  };
}

/** Ambient pulse dots for one lane, travelling from the flow's source to its
 *  destination (sign convention: positive `osmosisPulse` = lane's `a` sent
 *  goods to `b`, src/sim/osmosis.ts). Density and speed both scale with
 *  |magnitude|; count/duration formulas are tuning, not contract. Returns
 *  null when the lane is at or below the display threshold — a quiet lane
 *  renders nothing (PR #55 calm). */
function osmosisDots(
  magnitude: number,
  from: { x: number; y: number },
  to: { x: number; y: number },
): ReactNode {
  if (Math.abs(magnitude) <= PULSE_DISPLAY_THRESHOLD) return null;

  const intensity = Math.abs(magnitude) / PULSE_INTENSITY_SCALE;
  const count = Math.min(PULSE_MAX_COUNT, Math.max(1, Math.floor(1 + intensity)));
  const duration = Math.max(PULSE_DURATION_MIN, PULSE_DURATION_BASE / (1 + intensity));
  const staticOpacity = Math.min(
    PULSE_STATIC_OPACITY_MAX,
    PULSE_STATIC_OPACITY_MIN + intensity * 0.2,
  );
  // Positive pulse = a -> b already reflected by the caller's from/to.
  const dx = to.x - from.x;
  const dy = to.y - from.y;

  return Array.from({ length: count }, (_, i) => (
    <circle
      key={i}
      className="osmosis-pulse"
      cx={from.x}
      cy={from.y}
      r={PULSE_RADIUS}
      style={
        {
          "--pulse-dx": `${dx}px`,
          "--pulse-dy": `${dy}px`,
          // Reduced-motion fallback (owner call, 2026-07-08): each dot
          // freezes at its phase along the lane instead of animating, so
          // the lane still reads as busy without motion.
          "--pulse-phase": String(i / count),
          "--pulse-static-opacity": String(staticOpacity),
          animationDuration: `${duration}s`,
          // Negative delay: the animation starts already mid-cycle, so
          // dots 2..n are immediately phased along the lane instead of
          // sitting static (at full opacity) at the source for up to a
          // full duration whenever the lane activates or the keyframe
          // restarts (duration/direction can change as magnitude shifts).
          animationDelay: `${(-i * duration) / count}s`,
        } as CSSProperties
      }
    />
  ));
}

/**
 * SVG region map (docs/specs/E2-trade-loop.md — UI layout): ports as nodes,
 * lanes as edges, the ship positioned by shipPosition(). Clicking a port or
 * the ship updates the store's selection.
 */
export function RegionMap({
  region,
  ship,
  osmosisPulse,
}: {
  region: Region;
  ship: Ship;
  osmosisPulse: Record<LaneId, number>;
}) {
  const selection = useGameStore((s) => s.selection);
  const select = useGameStore((s) => s.select);
  const openShip = useGameStore((s) => s.openShip);
  const controlledShipId = useGameStore((s) => s.controlledShipId);

  const [hoveredPortId, setHoveredPortId] = useState<PortId | null>(null);

  const portsById = new Map(region.ports.map((p) => [p.id, p]));
  const shipPos = project(shipPosition(ship, region));
  const center = project(CENTER);

  // Controlled Ship's active course (docs/specs/E10-orrery-view.md — Lane
  // presentation): the remaining voyages of its route while underway. A
  // docked ship has no route to show, so "or selected" adds nothing beyond
  // "underway" in practice — selecting a docked Controlled Ship just yields
  // an empty course.
  const courseVoyages: readonly Voyage[] =
    ship.id === controlledShipId && ship.location.kind === "underway"
      ? ship.location.route.slice(ship.location.voyageIndex)
      : [];
  const courseDestinationByLane = new Map<LaneId, PortId>(courseVoyages.map((v) => [v.laneId, v.to]));

  // Route preview (#8): while the Controlled Ship is docked, hovering another
  // port previews the shortest route from its berth as a muted dashed course —
  // a hypothesis, visually weaker than a committed course. No preview while
  // underway (a course already owns the map).
  const dockedPortId =
    ship.id === controlledShipId && ship.location.kind === "docked" ? ship.location.portId : null;
  const previewLaneIds = new Set<LaneId>(
    dockedPortId && hoveredPortId && hoveredPortId !== dockedPortId
      ? (shortestRoute(region, dockedPortId, hoveredPortId) ?? []).map((v) => v.laneId)
      : [],
  );

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
        {/* Arrowhead for the Controlled Ship's course accent — direction
            comes from the voyage's `to`, not the lane's fixed a/b order. */}
        <marker
          id="course-arrow"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="3.5"
          markerHeight="3.5"
          orient="auto-start-reverse"
        >
          <path d="M0,0 L10,5 L0,10 Z" fill="#e0a840" />
        </marker>
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
          const isPortAccented = selection?.kind === "port" && (lane.a === selection.id || lane.b === selection.id);
          const courseTo = courseDestinationByLane.get(lane.id);
          const isCourseAccented = courseTo !== undefined;

          // Lanes are undirected (a/b); orient the endpoints toward the
          // voyage's destination so the course arrowhead points the right way.
          const fromId = isCourseAccented && courseTo === lane.a ? lane.b : lane.a;
          const toId = isCourseAccented && courseTo === lane.a ? lane.a : lane.b;
          const { from, to } = laneEndpoints(portsById, fromId, toId);

          const isHoverPreview = previewLaneIds.has(lane.id);

          const className = [
            "lane",
            isHoverPreview && "lane--hover-preview",
            isPortAccented && "lane--port-accent",
            isCourseAccented && "lane--course-accent",
          ]
            .filter(Boolean)
            .join(" ");
          const label = laneLabelPosition(from, to);

          return (
            <g key={lane.id}>
              <line
                className={className}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                markerEnd={isCourseAccented ? "url(#course-arrow)" : undefined}
              />
              {(isPortAccented || isCourseAccented) && (
                <text className="lane__label" x={label.x} y={label.y} textAnchor="middle">
                  {lane.voyageTicks}t
                </text>
              )}
            </g>
          );
        })}
      </g>
      {/* Ambient osmosis layer (docs/specs/E8-living-economy.md — Ambient
          ships): small pulses travelling along lanes with an active flow —
          signal moving through a network, not vessels. Drawn above lanes but
          below ports/the Controlled Ship so it stays clearly subordinate.
          Purely derived from `osmosisPulse`; no sim entities. */}
      <g className="region-map__osmosis" aria-hidden="true">
        {region.lanes.map((lane) => {
          const magnitude = osmosisPulse[lane.id] ?? 0;
          // Sign convention (src/sim/osmosis.ts): positive = a -> b.
          const { from, to } = laneEndpoints(
            portsById,
            magnitude >= 0 ? lane.a : lane.b,
            magnitude >= 0 ? lane.b : lane.a,
          );
          const dots = osmosisDots(magnitude, from, to);
          if (!dots) return null;
          return (
            <g key={lane.id} className="osmosis-lane" data-lane-id={lane.id}>
              {dots}
            </g>
          );
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
              onMouseEnter={() => setHoveredPortId(port.id)}
              onMouseLeave={() => setHoveredPortId((prev) => (prev === port.id ? null : prev))}
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
