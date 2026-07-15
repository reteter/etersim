import { useEffect, useState, type ComponentType, type CSSProperties, type SVGProps } from "react";
import { shortestCourse, type LaneId, type Port, type PortArchetype, type PortId, type Region, type Ship, type Voyage } from "../sim";
import { useGameStore } from "../store/gameStore";
import {
  AgrarianIcon,
  FreeportIcon,
  IndustrialIcon,
  MiningIcon,
  ShipIcon,
  UrbanIcon,
  VerdantIcon,
} from "./icons";
import { projectToViewBox } from "./mapProjection";
import { shipPosition } from "./shipPosition";
import { skiffGlyphs } from "./skiffPosition";

const VIEW_SIZE = 100;
const PADDING = 10;
const SHIP_ICON_SIZE = 4;
const PORT_ICON_SIZE = 3.5;
const PORT_DISC_RADIUS = 3;
/** projectToViewBox is a uniform scale (both axes), so this factor also
 *  converts a unit-plane distance (orbit radius) into viewBox units. */
const SCALE = VIEW_SIZE - 2 * PADDING;
const CENTER = { x: 0.5, y: 0.5 };

/** Osmosis skiff silhouette (#161, CONTEXT.md: Osmosis skiff — replaces the
 *  ambient osmosis pulses, #63): a small original hull shape (bow at local
 *  +x), *not* the vendored `ShipIcon` — this is the cosmetic ambient layer
 *  the pulses occupied (plain `<circle>`s pre-#161), not a "game-world
 *  entity" under ADR-0006's vendored-icon boundary. Deliberately distinct
 *  from both `ShipIcon` (a galleon) and the course-arrow marker (a plain
 *  triangle) so a fresh player never mistakes it for their own ship
 *  (ADR-0006, incident 0002 — no gold; tinted via `.osmosis-skiff` in
 *  index.css, a cool blue, never the Controlled Ship's gold). Bounding
 *  length ~1.8 viewBox units — clearly smaller than SHIP_ICON_SIZE (4):
 *  scale, not just color, sets the Controlled Ship apart. */
const SKIFF_HULL_POINTS = "0.9,0 0.27,-0.36 -0.81,-0.32 -0.9,0 -0.81,0.32 0.27,0.36";

/** Archetype → vendored SVG icon (#34, docs/adr/0006-svg-icon-strategy.md). */
const ARCHETYPE_ICONS: Record<PortArchetype, ComponentType<SVGProps<SVGSVGElement>>> = {
  agrarian: AgrarianIcon,
  industrial: IndustrialIcon,
  urban: UrbanIcon,
  mining: MiningIcon,
  verdant: VerdantIcon,
  freeport: FreeportIcon,
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

/** True while the user's OS/browser requests reduced motion. Read once at
 *  mount plus a live listener (Playwright's `emulateMedia` sets this before
 *  `page.goto`, so the initial `matchMedia` read already reflects it in
 *  E2E). Skiffs freeze at their spawn phase under this instead of animating
 *  — still visible, no motion (#69 review precedent, carried over from the
 *  ambient pulses this glyph replaces). */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

/**
 * SVG region map (docs/specs/E2-trade-loop.md — UI layout; #174 fixed the
 * single-ship prop so the whole fleet renders): ports as nodes, lanes as
 * edges, every Company ship positioned by shipPosition(). Clicking a port or
 * a ship updates the store's selection; clicking a ship also designates it
 * Controlled (CONTEXT.md — Controlled Ship), same as the Fleet list and
 * Harbor.
 */
export function RegionMap({
  region,
  ships,
  osmosisPulse,
  tick,
}: {
  region: Region;
  /** Every Company ship (#174) — docked and underway alike, not just [0]. */
  ships: readonly Ship[];
  osmosisPulse: Record<LaneId, number>;
  /** World.tick (CONTEXT.md: Tick) — the only clock osmosis skiffs read
   *  (#161): sim-time anchored, not wall-clock. */
  tick: number;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const selection = useGameStore((s) => s.selection);
  const select = useGameStore((s) => s.select);
  const openShip = useGameStore((s) => s.openShip);
  const controlledShipId = useGameStore((s) => s.controlledShipId);
  const selectedRouteId = useGameStore((s) => s.selectedRouteId);
  const routes = useGameStore((s) => s.world?.company.routes ?? []);

  const [hoveredPortId, setHoveredPortId] = useState<PortId | null>(null);

  // Selected Route's Stop ports (docs/specs/E9 — "on the map, the selected
  // Route only highlights its Stop ports"; map-drawn route paths are parked).
  const routeStopPortIds = new Set<PortId>(
    routes.find((r) => r.id === selectedRouteId)?.stops.map((s) => s.portId) ?? [],
  );

  const portsById = new Map(region.ports.map((p) => [p.id, p]));
  const center = project(CENTER);
  const controlledShip = ships.find((s) => s.id === controlledShipId) ?? null;

  // Controlled Ship's active course (docs/specs/E10-orrery-view.md — Lane
  // presentation): the remaining voyages of its course while underway. A
  // docked ship has no course to show, so "or selected" adds nothing beyond
  // "underway" in practice — selecting a docked Controlled Ship just yields
  // an empty course.
  const courseVoyages: readonly Voyage[] =
    controlledShip && controlledShip.location.kind === "underway"
      ? controlledShip.location.course.slice(controlledShip.location.voyageIndex)
      : [];
  const courseDestinationByLane = new Map<LaneId, PortId>(courseVoyages.map((v) => [v.laneId, v.to]));

  // Course preview (#8): while the Controlled Ship is docked, hovering another
  // port previews the shortest course from its berth as a muted dashed course —
  // a hypothesis, visually weaker than a committed course. No preview while
  // underway (a course already owns the map).
  const dockedPortId =
    controlledShip && controlledShip.location.kind === "docked" ? controlledShip.location.portId : null;
  const previewLaneIds = new Set<LaneId>(
    dockedPortId && hoveredPortId && hoveredPortId !== dockedPortId
      ? (shortestCourse(region, dockedPortId, hoveredPortId) ?? []).map((v) => v.laneId)
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
      {/* Ambient osmosis layer (CONTEXT.md: Osmosis skiff, #161 — replaces
          the ambient pulses, #63): small NPC trader ships sailing lanes with
          an active flow, one glyph = one meaning. Drawn above lanes but below
          ports/the Controlled Ship so it stays clearly subordinate. Purely
          derived from `osmosisPulse` at the current sim `tick`; no sim
          entities — the map never lies about the economy (pillar 4): a lane
          with no flow shows no skiffs. */}
      <g className="region-map__osmosis" aria-hidden="true">
        {region.lanes.map((lane) => {
          const magnitude = osmosisPulse[lane.id] ?? 0;
          // Sign convention (src/sim/osmosis.ts): positive = a -> b.
          const { from, to } = laneEndpoints(
            portsById,
            magnitude >= 0 ? lane.a : lane.b,
            magnitude >= 0 ? lane.b : lane.a,
          );
          const glyphs = skiffGlyphs(tick, magnitude, from, to, reducedMotion);
          if (glyphs.length === 0) return null;
          return (
            <g key={lane.id} className="osmosis-lane" data-lane-id={lane.id}>
              {glyphs.map((glyph, i) => (
                <polygon
                  key={i}
                  className="osmosis-skiff"
                  points={SKIFF_HULL_POINTS}
                  transform={`translate(${glyph.x}, ${glyph.y}) rotate(${glyph.angleDeg})`}
                />
              ))}
            </g>
          );
        })}
      </g>
      <g className="region-map__ports">
        {region.ports.map((port) => {
          const { x, y } = project(port);
          const isSelected = selection?.kind === "port" && selection.id === port.id;
          const isRouteStop = routeStopPortIds.has(port.id);
          const Icon = ARCHETYPE_ICONS[port.archetype];
          const className = [
            "port",
            isSelected && "port--selected",
            isRouteStop && "port--route-stop",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <g
              key={port.id}
              className={className}
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
      {/* Every Company ship (#174), drawn last so ships stay visible on top
          of ports/lanes. A docked ship is click-through (pointer-events:
          none) so the port beneath wins the hit test — port-click priority
          (#28); designating a docked ship instead goes through the Harbor or
          Fleet list (CONTEXT.md — Controlled Ship), which already give each
          docked ship its own unambiguous row — the precedent this map defers
          to for ships stacked at the same port instead of fanning them out
          spatially. Underway it stays clickable to designate it Controlled
          and open its ShipPanel; two underway ships at the exact same point
          (a rare coincidence) fall back to normal SVG stacking — the
          topmost-painted (last in `ships`) wins the hit test, with the Fleet
          list always available as an unambiguous alternative. Gold marks the
          Controlled Ship (#34) — a separate signal from UI panel selection;
          selection/course accents are #45. */}
      <g className="region-map__ships">
        {ships.map((ship) => {
          const shipPos = project(shipPosition(ship, region));
          return (
            <g
              key={ship.id}
              className={
                (ship.id === controlledShipId ? "ship ship--controlled" : "ship") +
                (ship.location.kind === "docked" ? " ship--docked" : "")
              }
              onClick={() => openShip(ship.id)}
            >
              {/* Invisible hit-target circle, painted (transparent, not
                  `fill="none"` — the latter isn't hit-testable) under the
                  glyph: an underway ship sits exactly on its lane's stroke
                  (shipPosition interpolates the same line the lane draws),
                  and the galleon silhouette's own bounding-box center often
                  lands on a transparent gap in the artwork, letting a real
                  click fall through to the lane beneath even though the
                  ship paints on top (#174 e2e discovered this: a real click
                  on the glyph consistently missed). `pointer-events` isn't
                  set here, so it inherits from the parent `<g>` — `none` on
                  a docked ship (#28 click-through preserved), `auto` while
                  underway. */}
              <circle
                className="ship__hit-target"
                cx={shipPos.x}
                cy={shipPos.y}
                r={SHIP_ICON_SIZE / 2}
                fill="transparent"
              />
              <ShipIcon
                className="ship__glyph"
                x={shipPos.x - SHIP_ICON_SIZE / 2}
                y={shipPos.y - SHIP_ICON_SIZE / 2}
                width={SHIP_ICON_SIZE}
                height={SHIP_ICON_SIZE}
              />
            </g>
          );
        })}
      </g>
    </svg>
  );
}
