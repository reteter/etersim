import type { CSSProperties } from "react";
import type { PortArchetype, PortId } from "../sim";
import { ARCHETYPE_ICONS, ShipIcon } from "./icons";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

/**
 * Route ribbon (CONTEXT.md — Route ribbon; docs/specs/E16-workbench.md —
 * Route ribbon component): the single visual language for a Route — ordered
 * Stops as planet-style archetype-colored nodes along a schematic rail, the
 * route line, a loop-closing return arc + ↻ marker, and an optional gliding
 * Ship.
 *
 * This component only *renders* what it is given — a resolved node list
 * (`portId → archetype`/`name` already looked up by the caller), never a
 * bare `Route` — so it never reaches into the store (E16 spec, "the
 * component must not reach into the store"). Read-only mode shipped in #392
 * (no `edit` prop passed: no add/remove/reorder affordances). #394 adds an
 * **editable mode** (`edit` prop): per-node remove + reorder buttons. Order
 * attach/edit itself lives in the board's grid cells, not the ribbon (E16
 * spec — UX latitude on "where order-editing lives"), so the ribbon's
 * authoring surface is deliberately scoped to Stop-level manipulation.
 */

export interface RouteRibbonNode {
  readonly portId: PortId;
  readonly name: string;
  readonly archetype: PortArchetype;
}

/**
 * A route is a loop of `nodes.length` Stops, so it has exactly
 * `nodes.length` legs: `nodes.length - 1` forward legs (Stop i -> Stop i+1)
 * plus one return leg (last Stop -> Stop 0, the loop closure). `progress` is
 * the Ship's position along that cycle: the integer part is the leg index
 * (0-based; the last leg, index `nodes.length - 1`, is the return leg), the
 * fractional part is how far along that leg the Ship has traveled.
 */
export interface RouteRibbonShipState {
  readonly progress: number;
}

export interface RouteRibbonProps {
  readonly routeName: string;
  readonly nodes: readonly RouteRibbonNode[];
  /** Omitted when no Ship is assigned to this Route — the ribbon still
   *  shows the loop, just without a gliding glyph. */
  readonly ship?: RouteRibbonShipState;
  /** Sim-time law (ADR-0003, #161 skiff-anchoring precedent): the caller
   *  passes the game's actual pause state. The Ship glyph freezes at its
   *  current position — still visible, no motion — exactly like a skiff
   *  under `prefers-reduced-motion`, so pausing never looks like motion
   *  snuck in behind the pause. */
  readonly paused?: boolean;
  /** Present ⇒ editable mode (#394 board authoring): each node gets a
   *  remove button and reorder (◀/▶) buttons. Absent ⇒ read-only (#392
   *  roster rows) — the "no authoring affordances" guarantee that mode's
   *  test asserts. */
  readonly edit?: {
    readonly onRemoveStop: (index: number) => void;
    readonly onMoveStop: (index: number, direction: -1 | 1) => void;
  };
}

const NODE_SPACING = 32;
const NODE_Y = 14;
const RETURN_ARC_DIP = 22;
const NODE_RADIUS = 6;
const ICON_SIZE = 7;
const SHIP_ICON_SIZE = 6;

interface Point {
  readonly x: number;
  readonly y: number;
}

function nodeCenter(i: number): Point {
  return { x: NODE_SPACING / 2 + i * NODE_SPACING, y: NODE_Y };
}

/** Point at parameter `t` (0..1) along a quadratic Bezier from `a` to `b`
 *  with control point `c` — used both to draw the return-arc `<path>` and to
 *  place the Ship glyph on it at the same `t`, so the glyph never drifts off
 *  the drawn line. */
function quadraticPoint(a: Point, b: Point, c: Point, t: number): Point {
  const mt = 1 - t;
  return {
    x: mt * mt * a.x + 2 * mt * t * c.x + t * t * b.x,
    y: mt * mt * a.y + 2 * mt * t * c.y + t * t * b.y,
  };
}

/** Ship position along the loop at `progress` (see RouteRibbonShipState),
 *  plus which leg it's on (needed by the caller to decide intermediate-Stop
 *  dimming during the return phase). */
function shipOnRibbon(
  nodes: readonly RouteRibbonNode[],
  progress: number,
): { point: Point; onReturnLeg: boolean } {
  const legCount = nodes.length;
  const wrapped = ((progress % legCount) + legCount) % legCount;
  const leg = Math.min(legCount - 1, Math.floor(wrapped));
  const t = wrapped - leg;
  const onReturnLeg = leg === legCount - 1;

  if (!onReturnLeg) {
    const a = nodeCenter(leg);
    const b = nodeCenter(leg + 1);
    return { point: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, onReturnLeg };
  }

  const last = nodeCenter(legCount - 1);
  const first = nodeCenter(0);
  const control = { x: (last.x + first.x) / 2, y: RETURN_ARC_DIP };
  return { point: quadraticPoint(last, first, control, t), onReturnLeg };
}

export function RouteRibbon({ routeName, nodes, ship, paused, edit }: RouteRibbonProps) {
  const reducedMotion = usePrefersReducedMotion();
  const animating = ship !== undefined && !reducedMotion && !paused;

  if (nodes.length < 2) return null; // route.ts: a Route needs >=2 Stops to exist at all

  const width = NODE_SPACING * nodes.length;
  const height = RETURN_ARC_DIP + 6;
  const last = nodeCenter(nodes.length - 1);
  const first = nodeCenter(0);
  const control = { x: (last.x + first.x) / 2, y: RETURN_ARC_DIP };
  const arcMid = quadraticPoint(last, first, control, 0.5);

  const shipState = ship ? shipOnRibbon(nodes, ship.progress) : null;
  const dimIntermediates = shipState?.onReturnLeg ?? false;

  return (
    <div
      className="route-ribbon"
      role="img"
      aria-label={`Wstążka trasy: ${routeName}`}
    >
      <svg
        className="route-ribbon__svg"
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
      >
        {/* Forward legs — the route line proper. */}
        {nodes.slice(0, -1).map((node, i) => {
          const a = nodeCenter(i);
          const b = nodeCenter(i + 1);
          return (
            <line
              key={`leg-${node.portId}`}
              className="route-ribbon__leg"
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
            />
          );
        })}

        {/* Loop closure: the return leg drawn as a subtle arc + a ↻ marker
            (CONTEXT.md — Route ribbon: "a cycle, not a dead-end line"). */}
        <path
          className="route-ribbon__return-arc"
          d={`M ${last.x} ${last.y} Q ${control.x} ${control.y} ${first.x} ${first.y}`}
          fill="none"
        />
        <text
          className="route-ribbon__loop-marker"
          x={arcMid.x}
          y={arcMid.y}
          textAnchor="middle"
        >
          ↻
        </text>

        {nodes.map((node, i) => {
          const { x, y } = nodeCenter(i);
          const Icon = ARCHETYPE_ICONS[node.archetype];
          // Intermediate Stops (neither the return leg's origin — the last
          // Stop — nor its destination — the first Stop) dim while the Ship
          // is on the return leg, so the return reads as a direct trip home
          // (E16 spec — "passing over, not stopping at, the middle Stops").
          const isIntermediate = i > 0 && i < nodes.length - 1;
          const dim = dimIntermediates && isIntermediate;
          return (
            <g
              key={node.portId}
              className={dim ? "route-ribbon__node route-ribbon__node--dim" : "route-ribbon__node"}
              data-testid="route-ribbon__node"
              data-archetype={node.archetype}
              style={{ "--port-color": `var(--archetype-${node.archetype})` } as CSSProperties}
            >
              <circle className="route-ribbon__node-disc" cx={x} cy={y} r={NODE_RADIUS} />
              <Icon
                className="route-ribbon__node-icon"
                x={x - ICON_SIZE / 2}
                y={y - ICON_SIZE / 2}
                width={ICON_SIZE}
                height={ICON_SIZE}
              />
              <text className="route-ribbon__node-label" x={x} y={y + NODE_RADIUS + 6} textAnchor="middle">
                {node.name}
              </text>
            </g>
          );
        })}

        {shipState && (
          // Position via a wrapping <g>'s CSS `transform` (not the x/y
          // attributes) so `.route-ribbon__ship--animating`'s transition
          // has a property that actually changes between `progress` updates.
          <g
            className={
              animating
                ? "route-ribbon__ship route-ribbon__ship--animating"
                : "route-ribbon__ship"
            }
            data-testid="route-ribbon__ship"
            data-animating={animating}
            style={
              {
                transform: `translate(${shipState.point.x}px, ${shipState.point.y}px)`,
              } as CSSProperties
            }
          >
            <ShipIcon
              x={-SHIP_ICON_SIZE / 2}
              y={-SHIP_ICON_SIZE / 2}
              width={SHIP_ICON_SIZE}
              height={SHIP_ICON_SIZE}
            />
          </g>
        )}
      </svg>
      {edit && (
        <div className="route-ribbon__edit" role="group" aria-label="Edytuj przystanki">
          {nodes.map((node, i) => (
            <div key={node.portId} className="route-ribbon__edit-row">
              <span className="route-ribbon__edit-name">
                #{i + 1} {node.name}
              </span>
              <button
                type="button"
                className="menu-btn"
                aria-label={`Przesuń przystanek ${i + 1} wcześniej`}
                disabled={i === 0}
                onClick={() => edit.onMoveStop(i, -1)}
              >
                ◀
              </button>
              <button
                type="button"
                className="menu-btn"
                aria-label={`Przesuń przystanek ${i + 1} później`}
                disabled={i === nodes.length - 1}
                onClick={() => edit.onMoveStop(i, 1)}
              >
                ▶
              </button>
              <button
                type="button"
                className="menu-btn"
                aria-label={`Usuń przystanek ${i + 1}: ${node.name}`}
                onClick={() => edit.onRemoveStop(i)}
              >
                Usuń
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
