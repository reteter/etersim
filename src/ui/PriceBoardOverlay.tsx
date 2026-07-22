import { useState, type CSSProperties } from "react";
import {
  effectiveBase,
  GOOD_IDS,
  GOODS,
  price,
  type GoodId,
  type Port,
  type PortId,
  type Route,
} from "../sim";
import { useGameStore } from "../store/gameStore";
import { computeMarketSignal, quotePortGood } from "../store/marketSignal";
import { KontraktyTab } from "./KontraktyTab";
import { OverlayShell } from "./OverlayShell";
import { priceTrend, TREND_GLYPH, TREND_LEGEND, type Trend } from "./priceTrend";
import { quoteLabel } from "./quoteFormat";
import {
  appendStop,
  inferOrderKind,
  isValidRouteDraft,
  lastStopIndexForPort,
  moveStop,
  nextRouteId,
  parseMinMarginInput,
  parseQtyInput,
  patchStopOrder,
  removeStop,
  removeStopOrder,
  setStopOrder,
  suggestedPairingPortIds,
} from "./routeAuthoring";
import { RouteRibbon, type RouteRibbonNode } from "./RouteRibbon";
import { Tabs } from "./Tabs";

/** #96 (docs/specs/E3-contracts-and-guilds.md — UX skeleton): the overlay's
 *  two tabs. "ceny" behaves exactly as before this issue; "kontrakty" is new
 *  (KontraktyTab.tsx). */
type Tab = "ceny" | "kontrakty";

/** One port×good cell's two-sided quote plus the mid-price trend (E8). */
interface Cell {
  readonly bid: number | null;
  readonly ask: number | null;
  readonly trend: Trend;
}

/** All cells for one port, keyed by good. `quotePortGood` (store/marketSignal)
 *  is the single quote source this board and the market-quality signal both
 *  read — sharing it is load-bearing (E16 spec — Trap 2): reimplementing the
 *  quote here would let the board's numbers silently drift from the signal's. */
function portCells(port: Port, snapshot: Record<GoodId, number>): Record<GoodId, Cell> {
  const cells = {} as Record<GoodId, Cell>;
  for (const good of GOOD_IDS) {
    const { bid, ask } = quotePortGood(port, good);
    const base = effectiveBase(port, good);
    cells[good] = { bid, ask, trend: priceTrend(price(port.market[good], base), snapshot[good]) };
  }
  return cells;
}

const ORDER_KIND_LABEL: Record<"buy" | "sell", string> = { buy: "Kup", sell: "Sprzedaj" };

/**
 * Region price board (#62): a bid/ask overview across every port and good so
 * the player can compare markets without sailing to each one and opening its
 * panel. Opened from TopBar.tsx (button + a "b" hotkey); clicking a row jumps
 * straight to that port's own panel (docs/specs/E8-living-economy.md — Price
 * bias, Bid-ask spread).
 *
 * #394 (docs/specs/E16-workbench.md — board fusion): the Ceny tab gains a
 * **board-authoring layer**, additive over the existing navigation gesture.
 * Resolved ambiguity (flagged for the Orchestrator): the spec's "click a
 * port's row → append a Stop" would otherwise collide with the existing
 * "click a row → open that port's panel" gesture (#62, still under E2E
 * coverage). The two coexist by gating on **whether a draft is active**
 * (`draft !== null`, started via the "Nowa trasa" button, mirroring
 * `RoutesTab`'s `draft ? <editor> : <New route button>` shape): no draft ⇒
 * unchanged row-click-opens-port navigation; a draft active ⇒ row clicks
 * build the route instead. `B` still just opens the board (no new keybind).
 */
export function PriceBoardOverlay({
  onClose,
  tab,
  onTabChange,
}: {
  onClose: () => void;
  /** Controlled, not mount-once (#195 rider 1): the caller (TopBar) owns the
   *  tab so a notice-strip click can retarget an already-open board straight
   *  to Kontrakty, not just pick its *initial* tab. */
  tab: Tab;
  onTabChange: (tab: Tab) => void;
}) {
  const world = useGameStore((s) => s.world);
  const controlledShipId = useGameStore((s) => s.controlledShipId);
  const select = useGameStore((s) => s.select);
  const dispatch = useGameStore((s) => s.dispatch);
  const selectRoute = useGameStore((s) => s.selectRoute);

  // Board-authoring draft (#394 pin #1): held locally, only dispatched to the
  // sim at a valid checkpoint ("Zapisz trasę"), never on every gesture — a
  // sub-valid draft would silently no-op through `isValidRoute`
  // (commands.ts). New-route authoring only (#394 scope note #3) — loading
  // an existing Route into the board editor is #393's roster "Edytuj →" seam.
  const [draft, setDraft] = useState<Route | null>(null);
  // Progressive disclosure (spec §Attaching orders): which (stopIndex, good)
  // cells have their qty/minMargin fields expanded via "więcej".
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  if (!world) return null;

  const { ports } = world.region;
  const controlledShip = world.company.ships.find((s) => s.id === controlledShipId);
  const dockedPortId =
    controlledShip?.location.kind === "docked" ? controlledShip.location.portId : null;

  const cellsByPort = {} as Record<PortId, Record<GoodId, Cell>>;
  for (const port of ports) {
    cellsByPort[port.id] = portCells(port, world.priceSnapshots[port.id]);
  }
  // Market-quality signal (store bridge, docs/specs/E16-workbench.md):
  // computed once here and subsumes this board's old local `columnExtremes`
  // helper — "best" highlight now reads tier === "strong" (a tie at the
  // regional extreme lights up every tied port, not just a singular id). It
  // also drives #394's inferred-kind rule and highlight-only pairing assist.
  const signal = computeMarketSignal(ports);

  const authoring = draft !== null;
  const suggestedPortIds = draft ? suggestedPairingPortIds(draft, signal) : new Set<PortId>();

  const openPort = (portId: PortId) => {
    select({ kind: "port", id: portId });
    onClose();
  };

  const startDraft = () => {
    setDraft({ id: nextRouteId(world), name: `Trasa ${world.company.routes.length + 1}`, stops: [] });
    setExpanded(new Set());
  };
  const cancelDraft = () => {
    setDraft(null);
    setExpanded(new Set());
  };
  const saveDraft = () => {
    if (!draft || !isValidRouteDraft(draft)) return;
    dispatch({ kind: "createRoute", route: draft });
    selectRoute(draft.id);
    setDraft(null);
    setExpanded(new Set());
  };

  // Port-row click (spec §Construction is port-centric — the port-centric
  // spine): appends the port as a new Stop. Only reachable while a draft is
  // active — see the class doc comment above for the coexistence rule with
  // the default (no-draft) row-click-opens-port navigation.
  const handleRowClick = (portId: PortId) => {
    if (!draft) return;
    setDraft(appendStop(draft, portId));
  };

  // Good-cell click (spec §Attaching orders): attaches an order to the most
  // recently appended Stop at this port, kind inferred from the
  // market-quality signal (stronger tier wins; tie/both-weak/both-absent
  // handled by `inferOrderKind`). A cell for a port with no Stop yet in the
  // draft does nothing — the player must place the Stop first (port-centric
  // spine, not good-centric wiring).
  const handleCellClick = (portId: PortId, good: GoodId) => {
    if (!draft) return;
    const stopIndex = lastStopIndexForPort(draft, portId);
    if (stopIndex === null) return;
    const entry = signal.entries[portId][good];
    const existingKind = draft.stops[stopIndex].orders.find((o) => o.good === good)?.kind;
    const kind = existingKind === "buy" || existingKind === "sell" ? existingKind : inferOrderKind(entry);
    if (kind === null) return;
    setDraft(setStopOrder(draft, stopIndex, good, kind));
  };

  const flipOrderKind = (stopIndex: number, good: GoodId, current: "buy" | "sell") => {
    if (!draft) return;
    setDraft(setStopOrder(draft, stopIndex, good, current === "buy" ? "sell" : "buy"));
  };

  const removeOrder = (stopIndex: number, good: GoodId) => {
    if (!draft) return;
    setDraft(removeStopOrder(draft, stopIndex, good));
  };

  const toggleExpanded = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const isValid = draft ? isValidRouteDraft(draft) : false;

  const ribbonNodes: RouteRibbonNode[] = (draft?.stops ?? []).map((stop) => {
    const port = ports.find((p) => p.id === stop.portId)!;
    return { portId: port.id, name: port.name, archetype: port.archetype };
  });

  return (
    <OverlayShell
      ariaLabel="Price board"
      title="Price Board"
      onClose={onClose}
      wide
      tabs={
        <Tabs
          ariaLabel="Price board tabs"
          active={tab}
          onChange={onTabChange}
          tabs={[
            { id: "ceny", label: authoring ? "Ceny · Trasa" : "Ceny" },
            { id: "kontrakty", label: "Kontrakty" },
          ]}
        />
      }
    >
      {tab === "kontrakty" ? (
        <KontraktyTab world={world} />
      ) : (
        <>
          <p className="price-board__legend">{TREND_LEGEND}</p>
          <div className="price-board__authoring-bar">
            {!authoring ? (
              <button type="button" className="menu-btn" onClick={startDraft}>
                Nowa trasa
              </button>
            ) : (
              <>
                <span className="price-board__authoring-hint">
                  {draft!.stops.length === 0
                    ? "Kliknij port, aby dodać pierwszy przystanek."
                    : draft!.stops.length === 1
                      ? "Kliknij kolejny port, aby dodać drugi przystanek."
                      : "Kliknij port, aby dodać przystanek; kliknij komórkę towaru, aby dodać zlecenie."}
                </span>
                <button
                  type="button"
                  className="menu-btn"
                  disabled={!isValid}
                  onClick={saveDraft}
                >
                  Zapisz trasę
                </button>
                <button type="button" className="menu-btn" onClick={cancelDraft}>
                  Anuluj
                </button>
              </>
            )}
          </div>
          <div className="price-board" role="table" aria-label="Region price board">
          <div className="price-board__row price-board__row--header" role="row">
            <span className="price-board__port-header">Port</span>
            {GOOD_IDS.map((good) => (
              <span key={good} className="price-board__good-header" title={TREND_LEGEND}>
                {GOODS[good].name}
              </span>
            ))}
          </div>
          {ports.map((port) => {
            const docked = port.id === dockedPortId;
            const stopIndex = authoring && draft ? lastStopIndexForPort(draft, port.id) : null;
            const inDraft = stopIndex !== null;
            const suggested = authoring && suggestedPortIds.has(port.id) && !inDraft;
            const rowClasses = ["price-board__row"];
            if (docked) rowClasses.push("price-board__row--docked");
            if (inDraft) rowClasses.push("price-board__row--in-draft");
            if (suggested) rowClasses.push("price-board__row--suggested");
            return (
              <div
                key={port.id}
                className={rowClasses.join(" ")}
                data-archetype={port.archetype}
                style={{ "--port-color": `var(--archetype-${port.archetype})` } as CSSProperties}
                role="row"
                tabIndex={0}
                onClick={() => (authoring ? handleRowClick(port.id) : openPort(port.id))}
                onKeyDown={(e) => {
                  // Enter/Space activate the row, matching native button
                  // behavior (Harbor.tsx uses real <button>s for its rows;
                  // here role="row" must stay valid grid semantics, so
                  // keyboard activation is wired explicitly instead).
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    if (authoring) handleRowClick(port.id);
                    else openPort(port.id);
                  }
                }}
              >
                <span className="price-board__port-name">
                  {port.name}
                  {suggested && (
                    <span className="price-board__pairing-hint" title="Sugerowany kolejny przystanek">
                      {" "}
                      ★
                    </span>
                  )}
                </span>
                {GOOD_IDS.map((good) => {
                  const cell = cellsByPort[port.id][good];
                  const isBestAsk = signal.entries[port.id][good].buyTier === "strong";
                  const isBestBid = signal.entries[port.id][good].sellTier === "strong";
                  const order =
                    stopIndex !== null
                      ? draft!.stops[stopIndex].orders.find((o) => o.good === good)
                      : undefined;
                  const cellKey = `${stopIndex}:${good}`;
                  const cellContent = (
                    <>
                      <span
                        className={
                          isBestBid ? "price-board__bid price-board__bid--best" : "price-board__bid"
                        }
                      >
                        {quoteLabel(cell.bid)}
                      </span>
                      <span
                        className={`price-board__trend price-board__trend--${cell.trend}`}
                        title={TREND_LEGEND}
                      >
                        {TREND_GLYPH[cell.trend]}
                      </span>
                      <span
                        className={
                          isBestAsk ? "price-board__ask price-board__ask--best" : "price-board__ask"
                        }
                      >
                        {quoteLabel(cell.ask)}
                      </span>
                    </>
                  );
                  return (
                    <span key={good} className="price-board__cell" role="cell">
                      {authoring && inDraft ? (
                        <button
                          type="button"
                          className="price-board__cell-btn"
                          aria-label={`${GOODS[good].name} w ${port.name}: dodaj zlecenie`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCellClick(port.id, good);
                          }}
                        >
                          {cellContent}
                        </button>
                      ) : (
                        cellContent
                      )}
                      {order && order.kind !== "deliver" && order.kind !== "store" && order.kind !== "withdraw" && (
                        <span
                          className="price-board__order-chip"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="price-board__order-chip-label">
                            {ORDER_KIND_LABEL[order.kind]}
                            {order.qty === undefined
                              ? order.kind === "sell"
                                ? " · sprzedaj całość"
                                : ""
                              : ` · ${order.qty} szt.`}
                          </span>
                          <button
                            type="button"
                            className="menu-btn"
                            aria-label={`${GOODS[good].name}: zmień na ${order.kind === "buy" ? "sprzedaż" : "kupno"}`}
                            onClick={() => flipOrderKind(stopIndex!, good, order.kind as "buy" | "sell")}
                          >
                            ⇄
                          </button>
                          <button
                            type="button"
                            className="menu-btn"
                            aria-label={`${GOODS[good].name}: więcej opcji`}
                            onClick={() => toggleExpanded(cellKey)}
                          >
                            więcej
                          </button>
                          <button
                            type="button"
                            className="menu-btn"
                            aria-label={`${GOODS[good].name}: usuń zlecenie`}
                            onClick={() => removeOrder(stopIndex!, good)}
                          >
                            ×
                          </button>
                          {expanded.has(cellKey) && (
                            <span className="price-board__order-more">
                              <input
                                type="number"
                                min={1}
                                step={1}
                                placeholder="ile"
                                title="Ile jednostek (puste = maksymalnie)"
                                aria-label={`${GOODS[good].name} ile sztuk`}
                                value={order.qty ?? ""}
                                onChange={(e) => {
                                  const result = parseQtyInput(e.target.value);
                                  if (result.kind === "ignore" || !draft) return;
                                  setDraft(
                                    patchStopOrder(draft, stopIndex!, good, {
                                      qty: result.kind === "set" ? result.qty : undefined,
                                    }),
                                  );
                                }}
                              />
                              {order.kind === "buy" && (
                                <input
                                  type="number"
                                  step={1}
                                  placeholder="próg marży"
                                  title="Próg marży: czekaj, aż dowóz się opłaci (puste = bez progu)"
                                  aria-label={`${GOODS[good].name} próg marży`}
                                  value={order.minMargin ?? ""}
                                  onChange={(e) => {
                                    const result = parseMinMarginInput(e.target.value);
                                    if (result.kind === "ignore" || !draft) return;
                                    setDraft(
                                      patchStopOrder(draft, stopIndex!, good, {
                                        minMargin: result.kind === "set" ? result.minMargin : undefined,
                                      }),
                                    );
                                  }}
                                />
                              )}
                            </span>
                          )}
                        </span>
                      )}
                    </span>
                  );
                })}
              </div>
            );
          })}
          </div>
          {authoring && draft && draft.stops.length >= 2 && (
            <div className="price-board__ribbon-dock">
              <RouteRibbon
                routeName={draft.name}
                nodes={ribbonNodes}
                edit={{
                  onRemoveStop: (index) => setDraft(removeStop(draft, index)),
                  onMoveStop: (index, direction) => setDraft(moveStop(draft, index, direction)),
                }}
              />
            </div>
          )}
        </>
      )}
    </OverlayShell>
  );
}
