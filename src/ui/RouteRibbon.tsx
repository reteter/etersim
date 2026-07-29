import type { CSSProperties, ReactNode } from "react";
import type { PortArchetype, PortId } from "../sim";
import { ARCHETYPE_ICONS, ShipIcon } from "./icons";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

/**
 * Route ribbon (CONTEXT.md — Route ribbon; docs/specs/E16-workbench.md —
 * Route ribbon component): the single visual language for a Route — ordered
 * Stops as archetype-colored nodes along a schematic rail, port names as
 * captions, the route line, a loop-closing return arc + ↻ marker, and an
 * optional gliding Ship.
 *
 * This component only *renders* what it is given — a resolved node list
 * (`portId → archetype`/`name` already looked up by the caller), never a
 * bare `Route` — so it never reaches into the store (E16 spec, "the
 * component must not reach into the store").
 *
 * **E16 visual prototype (#468 D6):** the rail moved from a single flat SVG
 * to a DOM rail with an SVG only for the return arc, because the mockup
 * (`docs/design-notes/m4-workbench-mockup.html`) puts three DOM-natural
 * tiers under each node: a **reserved status band above** the node (empty
 * today, room the owner asked for explicitly), the **port-name caption**,
 * and an **action row of order chips**. The ribbon is fixed *horizontally*
 * (legs flex, so ten Stops do not make it taller) and grows *vertically in
 * one step* when the action row appears — animated, `prefers-reduced-motion`
 * honored, via two known `min-height` values in `index.css` (a
 * `height: auto` transition would silently no-op).
 */

/** One order chip on a Stop's action row. Resolved by the caller — the
 *  ribbon never maps a `StopOrder` to Polish itself. `drawer` is the board's
 *  existing "więcej" panel, rendered under its chip rather than in the grid
 *  cell the chip used to live in (#468 D7 moves the surface, not the rules). */
export interface RouteRibbonOrderChip {
  readonly key: string;
  /** Player-facing, already legible (spec §Runtime execution legibility):
   *  `kup · Zboże`, `sprzedaj całość · Zboże` — never an opaque "sell". */
  readonly label: string;
  /** Which side of the trade the chip is — drives the dedicated trade pair
   *  (#468 D4): `sell` renders rust, `buy` green. `plain` is the market-free
   *  three (deliver/store/withdraw), which take no trade hue at all. */
  readonly side: "buy" | "sell" | "plain";
  readonly ariaLabel?: string;
  readonly onClick?: () => void;
  readonly onRemove?: () => void;
  readonly removeAriaLabel?: string;
  readonly drawer?: ReactNode;
}

export interface RouteRibbonNode {
  readonly portId: PortId;
  readonly name: string;
  readonly archetype: PortArchetype;
  /** Absent/empty ⇒ this Stop contributes no action row. */
  readonly orders?: readonly RouteRibbonOrderChip[];
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
   *  roster rows, and the Trasy roster) — the "no authoring affordances"
   *  guarantee that mode's test asserts. */
  readonly edit?: {
    readonly onRemoveStop: (index: number) => void;
    readonly onMoveStop: (index: number, direction: -1 | 1) => void;
  };
  /** Stop selection (#468 D3): the selected Stop's port drives the board's
   *  producing/consuming highlight. Selection is a *reading* gesture — it
   *  never moves where an order attaches. Read-only mode passes neither. */
  readonly selectedIndex?: number | null;
  readonly onSelectStop?: (index: number) => void;
  /** Compact roster variant (Trasy tab): same rail, smaller nodes, no
   *  reserved status band, captions kept. */
  readonly compact?: boolean;
}

/** Ship position along the loop, as a percentage of the rail's width.
 *  Forward legs walk left→right across the rail; the return leg walks back.
 *  Approximate by design — the rail is a flex layout, so node centers are
 *  not exactly at `i/(n-1)`; nothing depends on sub-pixel accuracy here. */
function shipOnRail(
  nodeCount: number,
  progress: number,
): { percent: number; onReturnLeg: boolean } {
  const legCount = nodeCount;
  const wrapped = ((progress % legCount) + legCount) % legCount;
  const leg = Math.min(legCount - 1, Math.floor(wrapped));
  const t = wrapped - leg;
  const onReturnLeg = leg === legCount - 1;
  const span = nodeCount - 1;
  if (!onReturnLeg) return { percent: ((leg + t) / span) * 100, onReturnLeg };
  return { percent: (1 - t) * 100, onReturnLeg };
}

export function RouteRibbon({
  routeName,
  nodes,
  ship,
  paused,
  edit,
  selectedIndex,
  onSelectStop,
  compact,
}: RouteRibbonProps) {
  const reducedMotion = usePrefersReducedMotion();
  const animating = ship !== undefined && !reducedMotion && !paused;

  if (nodes.length < 2) return null; // route.ts: a Route needs >=2 Stops to exist at all

  const shipState = ship ? shipOnRail(nodes.length, ship.progress) : null;
  const dimIntermediates = shipState?.onReturnLeg ?? false;
  // D6's second vertical state: the action row exists at all. One boolean for
  // the whole ribbon, not per Stop — the rail grows once, uniformly, so the
  // captions of order-less Stops stay on the same baseline as the rest.
  const hasActionRow = nodes.some((n) => (n.orders?.length ?? 0) > 0);

  const classes = ["route-ribbon"];
  if (compact) classes.push("route-ribbon--compact");

  return (
    <div
      className={classes.join(" ")}
      data-has-actions={hasActionRow}
      aria-label={`Wstążka trasy: ${routeName}`}
      role="group"
    >
      <div className="route-ribbon__rail">
        {nodes.map((node, i) => {
          const Icon = ARCHETYPE_ICONS[node.archetype];
          // Intermediate Stops (neither the return leg's origin — the last
          // Stop — nor its destination — the first Stop) dim while the Ship
          // is on the return leg, so the return reads as a direct trip home
          // (E16 spec — "passing over, not stopping at, the middle Stops").
          const isIntermediate = i > 0 && i < nodes.length - 1;
          const dim = dimIntermediates && isIntermediate;
          const selected = selectedIndex === i;
          const stopClasses = ["route-ribbon__node"];
          if (dim) stopClasses.push("route-ribbon__node--dim");
          if (selected) stopClasses.push("route-ribbon__node--selected");
          const orders = node.orders ?? [];
          return (
            <div className="route-ribbon__slot" key={node.portId}>
              {i > 0 && <div className="route-ribbon__leg" aria-hidden="true" />}
              <div
                className={stopClasses.join(" ")}
                data-testid="route-ribbon__node"
                data-archetype={node.archetype}
                style={{ "--port-color": `var(--archetype-${node.archetype})` } as CSSProperties}
              >
                {/* Reserved room for future port-status icons (#468, owner
                    dictation: "space reserved above each icon"). Rendered
                    always and at a fixed height — the band is the reason ten
                    Stops cannot make the ribbon taller, so it must never
                    collapse just because it is empty today. */}
                <div className="route-ribbon__status" aria-hidden="true" />
                {onSelectStop ? (
                  <button
                    type="button"
                    className="route-ribbon__disc route-ribbon__disc--btn"
                    aria-pressed={selected}
                    aria-label={`Przystanek ${i + 1}: ${node.name} — pokaż role portu`}
                    onClick={() => onSelectStop(i)}
                  >
                    <Icon className="route-ribbon__node-icon" aria-hidden="true" />
                  </button>
                ) : (
                  <span className="route-ribbon__disc">
                    <Icon className="route-ribbon__node-icon" aria-hidden="true" />
                  </span>
                )}
                <span className="route-ribbon__node-label">{node.name}</span>
                {/* Stop controls live **inside the Stop's own column**, not
                    in a shared row under the rail. A shared row wraps once a
                    Route gets long, which made the ribbon grow with Stop
                    count — exactly what D6 forbids ("ten Stops must not make
                    it taller"). Per-column, every Stop pays the same fixed
                    height and the growth is horizontal, where the legs
                    already flex. */}
                {edit && (
                  <div
                    className="route-ribbon__edit"
                    role="group"
                    aria-label={`Przystanek ${i + 1}: ${node.name} — edycja`}
                  >
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
                      aria-label={`Usuń przystanek ${i + 1}: ${node.name}`}
                      onClick={() => edit.onRemoveStop(i)}
                    >
                      ✕
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
                  </div>
                )}
                <div className="route-ribbon__orders">
                  {orders.map((chip) => (
                    <div className="route-ribbon__order" key={chip.key}>
                      <span className={`route-ribbon__chip route-ribbon__chip--${chip.side}`}>
                        {chip.onClick ? (
                          <button
                            type="button"
                            className="route-ribbon__chip-label route-ribbon__chip-label--btn"
                            aria-label={chip.ariaLabel}
                            onClick={chip.onClick}
                          >
                            {chip.label}
                          </button>
                        ) : (
                          <span className="route-ribbon__chip-label">{chip.label}</span>
                        )}
                        {chip.onRemove && (
                          <button
                            type="button"
                            className="route-ribbon__chip-x"
                            aria-label={chip.removeAriaLabel}
                            onClick={chip.onRemove}
                          >
                            ×
                          </button>
                        )}
                      </span>
                      {chip.drawer}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Loop closure: the return leg as an arc under the rail plus a ↻
          marker (CONTEXT.md — Route ribbon: "a cycle, not a dead-end line").
          Drawn as one non-uniformly-scaled path spanning first node → last
          node, the mockup's `.loop-arc` idiom — the rail is a flex layout,
          so there are no absolute node coordinates to fit a curve to. */}
      <svg
        className="route-ribbon__arc"
        viewBox="0 0 100 20"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path className="route-ribbon__return-arc" d="M 100 1 Q 50 30 0 1" fill="none" />
      </svg>
      <span className="route-ribbon__loop-marker" title="Pętla wraca do przystanku 1">
        ↻
      </span>

      {shipState && (
        <span
          className={
            animating ? "route-ribbon__ship route-ribbon__ship--animating" : "route-ribbon__ship"
          }
          data-testid="route-ribbon__ship"
          data-animating={animating}
          style={{ left: `${shipState.percent}%` } as CSSProperties}
        >
          <ShipIcon aria-hidden="true" />
        </span>
      )}

    </div>
  );
}
