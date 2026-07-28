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
  type StopOrder,
} from "../sim";
import { useGameStore } from "../store/gameStore";
import { computeMarketSignal, quotePortGood } from "../store/marketSignal";
import { computeOfferLabels, OFFER_LABEL_TEXT } from "../store/offerLabels";
import { KontraktyTab } from "./KontraktyTab";
import { OverlayShell } from "./OverlayShell";
import { priceTrend, TREND_GLYPH, TREND_LEGEND, type Trend } from "./priceTrend";
import { quoteLabel } from "./quoteFormat";
import {
  appendStop,
  inferOrderKind,
  isValidRouteDraft,
  lastStopIndexForPort,
  legalOrderKinds,
  moveStop,
  nextRouteId,
  parseMinMarginInput,
  parseQtyInput,
  patchStopOrder,
  removeStop,
  removeStopOrder,
  setStopOrder,
  setStopOrderKind,
  storehouseAt,
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

// Widened to all five kinds (#419): the market-free three reuse RoutesTab's
// exact Polish labels (`stop-row` STORE_ORDER_KIND_LABEL/ORDER_KIND_LABEL) —
// no new player-facing strings for the same concept on two surfaces.
const ORDER_KIND_LABEL: Record<StopOrder["kind"], string> = {
  buy: "Kup",
  sell: "Sprzedaj",
  deliver: "Dostarcz",
  store: "Złóż",
  withdraw: "Pobierz",
};
const MARKET_FREE_KINDS = new Set<StopOrder["kind"]>(["deliver", "store", "withdraw"]);

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
  // Progressive disclosure (spec §Attaching orders): which cells have their
  // qty/minMargin fields expanded via "więcej". Keyed `${portId}:${good}` —
  // not `${stopIndex}:${good}` (#405 nit 1): every cell-level gesture in
  // this file (attach/flip/remove/patch, via `lastStopIndexForPort`) already
  // targets "the port's most recent Stop", so portId is exactly as stable an
  // identity for this cell as everything else here already assumes. A
  // positional index isn't — reorder/remove shifts it, silently collapsing
  // an expanded panel or (rarer) flipping it onto a different Stop sharing
  // the new index.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  // Contextual focus (#395, spec §Information density): one good, or none.
  // Set automatically the moment an order is attached/edited for a good
  // (`setFocusedGood` calls below) and by a manual header click — deliberately
  // one shared piece of state rather than two precedence-ranked ones: the
  // simplest rule that doesn't leave the manual control "dead" while
  // authoring is "latest gesture wins" (an attach always wins *at the
  // moment it fires*, since that's the task the player is mid-doing; but a
  // manual click right after is a real gesture too and takes back the
  // wheel). Reset whenever a draft starts/ends — "reverts when not
  // building" per the AC — a stale focus from mid-authoring shouldn't
  // linger into a fresh session or a closed board.
  const [focusedGood, setFocusedGood] = useState<GoodId | null>(null);
  // Column pinning (#395): goods hidden from the grid. Purely a display
  // filter — never touches `draft`/orders/the sim (an already-attached
  // order on a hidden good stays committed; it just isn't shown while
  // hidden). Not persisted (UI-local only, per the task package).
  const [hiddenGoods, setHiddenGoods] = useState<Set<GoodId>>(new Set());

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
  // Offer labels (#397, spec §Market-quality signal rendering 3): composed
  // over the same signal, never a second computation of the tier itself.
  const offerLabels = computeOfferLabels(ports, signal, world.company.contracts);

  const authoring = draft !== null;
  const suggestedPortIds = draft ? suggestedPairingPortIds(draft, signal) : new Set<PortId>();

  const openPort = (portId: PortId) => {
    select({ kind: "port", id: portId });
    onClose();
  };

  const startDraft = () => {
    setDraft({ id: nextRouteId(world), name: `Trasa ${world.company.routes.length + 1}`, stops: [] });
    setExpanded(new Set());
    setFocusedGood(null);
  };
  const cancelDraft = () => {
    setDraft(null);
    setExpanded(new Set());
    setFocusedGood(null);
  };
  const saveDraft = () => {
    if (!draft || !isValidRouteDraft(draft)) return;
    dispatch({ kind: "createRoute", route: draft });
    selectRoute(draft.id);
    setDraft(null);
    setExpanded(new Set());
    setFocusedGood(null);
  };

  // Port-row click (spec §Construction is port-centric — the port-centric
  // spine): appends the port as a new Stop. Only reachable while a draft is
  // active — see the class doc comment above for the coexistence rule with
  // the default (no-draft) row-click-opens-port navigation.
  const handleRowClick = (portId: PortId) => {
    if (!draft) return;
    setDraft(appendStop(draft, portId));
  };

  // Removes the Stop at `index` (ribbon's "Usuń"/reorder dock, and the
  // 1-stop draft's standalone remove affordance, #405 nit 2). Also prunes
  // any "więcej" expansion for that port if the port no longer appears
  // anywhere in the draft afterward — otherwise a later re-add of the same
  // port would reappear pre-expanded, which would read as a stray bug even
  // though it can't corrupt anything (the key is portId-scoped, #405 nit 1).
  const removeStopFromDraft = (index: number) => {
    if (!draft) return;
    const removedPortId = draft.stops[index].portId;
    const nextDraft = removeStop(draft, index);
    setDraft(nextDraft);
    if (!nextDraft.stops.some((s) => s.portId === removedPortId)) {
      setExpanded((prev) => {
        const next = new Set(prev);
        for (const key of prev) {
          if (key.startsWith(`${removedPortId}:`)) next.delete(key);
        }
        return next;
      });
    }
  };

  // Good-cell click (spec §Attaching orders): attaches an order to the most
  // recently appended Stop at this port, kind inferred from the
  // market-quality signal (stronger tier wins; tie/both-weak/both-absent
  // handled by `inferOrderKind`). A cell for a port with no Stop yet in the
  // draft does nothing — the player must place the Stop first (port-centric
  // spine, not good-centric wiring).
  //
  // #419 AC3 — market-free cells are click-inert: a cell whose good already
  // carries `deliver`/`store`/`withdraw` returns early, **before** reaching
  // `inferOrderKind`. That inference always resolves to buy/sell when the
  // good has any market at all (routeAuthoring.ts), so falling through would
  // silently overwrite the market-free order with no cue — the exact bug
  // #404/#419 exist to close. Removal is the chip's `×` only; changing kind
  // goes through the drawer (`setStopOrderKind` below).
  const handleCellClick = (portId: PortId, good: GoodId) => {
    if (!draft) return;
    const stopIndex = lastStopIndexForPort(draft, portId);
    if (stopIndex === null) return;
    const existingKind = draft.stops[stopIndex].orders.find((o) => o.good === good)?.kind;
    if (existingKind !== undefined && MARKET_FREE_KINDS.has(existingKind)) return;
    const entry = signal.entries[portId][good];
    const kind = existingKind === "buy" || existingKind === "sell" ? existingKind : inferOrderKind(entry);
    if (kind === null) return;
    setDraft(setStopOrder(draft, stopIndex, good, kind));
    setFocusedGood(good); // contextual focus (#395): attaching follows the task
  };

  const flipOrderKind = (stopIndex: number, good: GoodId, current: "buy" | "sell") => {
    if (!draft) return;
    setDraft(setStopOrder(draft, stopIndex, good, current === "buy" ? "sell" : "buy"));
    setFocusedGood(good);
  };

  // Drawer's kind picker (#419 AC1: "the drawer is the complete truth about
  // kind", every legal kind including buy/sell). `setStopOrderKind` always
  // *sets* — never toggles off on re-picking the active kind, unlike the
  // plain-click `setStopOrder` path, so a `store` order can't vanish from a
  // radio-style re-click of its own kind.
  const pickOrderKind = (stopIndex: number, good: GoodId, kind: StopOrder["kind"]) => {
    if (!draft) return;
    setDraft(setStopOrderKind(draft, stopIndex, good, kind));
    setFocusedGood(good);
  };

  const removeOrder = (stopIndex: number, good: GoodId) => {
    if (!draft) return;
    setDraft(removeStopOrder(draft, stopIndex, good));
  };

  const toggleExpanded = (key: string, good: GoodId) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setFocusedGood(good); // editing qty/minMargin is squarely "attaching"
  };

  // Manual contextual focus (#395 AC2): the whole header cell toggles focus
  // on/off for its good, independent of authoring. "Latest gesture wins"
  // (see the `focusedGood` state comment above) — a manual click always
  // takes over, even mid-authoring.
  const toggleManualFocus = (good: GoodId) => {
    setFocusedGood((prev) => (prev === good ? null : good));
  };

  // Column pinning (#395 AC3): display-only, recoverable. Hiding the
  // currently-focused good is handled by `effectiveFocus` below (derived,
  // not an extra effect) rather than by clearing `focusedGood` here — that
  // way un-hiding the same good later resumes its focus for free.
  const hideGood = (good: GoodId) => {
    setHiddenGoods((prev) => new Set(prev).add(good));
  };
  const restoreHiddenGoods = () => {
    setHiddenGoods(new Set());
  };

  const isValid = draft ? isValidRouteDraft(draft) : false;
  const visibleGoodIds = GOOD_IDS.filter((good) => !hiddenGoods.has(good));
  // Strand detection (#413): a hidden column can still carry a live draft
  // order — it's fully committable via "Zapisz trasę" while invisible on
  // the grid. Purely a read of `draft`, never a mutation (hiding stays the
  // display-only filter #395 established) — badges the existing
  // hidden-columns affordance instead of restricting or auto-unhiding.
  const hiddenGoodsHaveOrders =
    draft !== null &&
    draft.stops.some((stop) => stop.orders.some((order) => hiddenGoods.has(order.good)));
  // Never dims/focuses a good that's currently hidden — a hidden column has
  // nothing to emphasize against, and the board would otherwise read as
  // uniformly dimmed with nothing standing out.
  const effectiveFocus: GoodId | null =
    focusedGood !== null && !hiddenGoods.has(focusedGood) ? focusedGood : null;

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
          {hiddenGoods.size > 0 && (
            <div
              className={
                hiddenGoodsHaveOrders
                  ? "price-board__hidden-note price-board__hidden-note--strand"
                  : "price-board__hidden-note"
              }
            >
              <span>
                Ukryte kolumny: {hiddenGoods.size}
                {hiddenGoodsHaveOrders &&
                  " · zawiera zlecenie w trasie — pozostaje zapisywalne mimo ukrycia"}
              </span>
              <button type="button" className="menu-btn" onClick={restoreHiddenGoods}>
                Pokaż wszystkie
              </button>
            </div>
          )}
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
          <div
            className="price-board"
            role="table"
            aria-label="Region price board"
            style={{ "--good-count": visibleGoodIds.length } as CSSProperties}
          >
          <div className="price-board__row price-board__row--header" role="row">
            <span className="price-board__port-header">Port</span>
            {visibleGoodIds.map((good) => {
              const focused = effectiveFocus === good;
              const dim = effectiveFocus !== null && !focused;
              return (
                <span key={good} className="price-board__good-col" role="columnheader">
                  <button
                    type="button"
                    className={
                      dim ? "price-board__good-header price-board__good-header--dim" : "price-board__good-header"
                    }
                    title={TREND_LEGEND}
                    aria-pressed={focused}
                    aria-label={`Skup uwagę na: ${GOODS[good].name}`}
                    onClick={() => toggleManualFocus(good)}
                  >
                    {GOODS[good].name}
                  </button>
                  <button
                    type="button"
                    className="menu-btn price-board__good-hide-btn"
                    aria-label={`Ukryj kolumnę: ${GOODS[good].name}`}
                    onClick={() => hideGood(good)}
                  >
                    ✕
                  </button>
                </span>
              );
            })}
          </div>
          {ports.map((port) => {
            const docked = port.id === dockedPortId;
            const stopIndex = authoring && draft ? lastStopIndexForPort(draft, port.id) : null;
            const inDraft = stopIndex !== null;
            const suggested = authoring && suggestedPortIds.has(port.id) && !inDraft;
            // Storehouse marker (#419, spec — "port row header carries a
            // marker ... whenever the Company has a Storehouse at that
            // port"): port-level (not per-cell), visible always — not
            // gated on `authoring` — since it states a fact about the
            // Company's own holdings, not a market suggestion (§Signal
            // boundary). Hue-free glyph, ADR-0006.
            const hasStorehouse = storehouseAt(world.company.buildings, port.id) !== undefined;
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
                  {hasStorehouse && (
                    <span className="price-board__storehouse-marker" title="Firma posiada tu Skład">
                      {" "}
                      ▣
                    </span>
                  )}
                  {suggested && (
                    <span className="price-board__pairing-hint" title="Sugerowany kolejny przystanek">
                      {" "}
                      ★
                    </span>
                  )}
                </span>
                {visibleGoodIds.map((good) => {
                  const cell = cellsByPort[port.id][good];
                  const isBestAsk = signal.entries[port.id][good].buyTier === "strong";
                  const isBestBid = signal.entries[port.id][good].sellTier === "strong";
                  const order =
                    stopIndex !== null
                      ? draft!.stops[stopIndex].orders.find((o) => o.good === good)
                      : undefined;
                  // Stable identity for the "więcej" expansion (#405 nit 1):
                  // portId, not stopIndex — see the `expanded` state comment.
                  const cellKey = `${port.id}:${good}`;
                  const dim = effectiveFocus !== null && effectiveFocus !== good;
                  // Offer labels (#397, spec §Market-quality signal rendering
                  // 3): the word rendering of the same signal driving
                  // isBestAsk/isBestBid above — buy-side labels ride the ask,
                  // sell-side the bid, matching which quote each label
                  // actually reasons about.
                  const cellLabels = offerLabels.entries[port.id][good];
                  const buyLabelText = cellLabels.buy.map((l) => OFFER_LABEL_TEXT[l]).join(" · ");
                  const sellLabelText = cellLabels.sell.map((l) => OFFER_LABEL_TEXT[l]).join(" · ");
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
                      {sellLabelText !== "" && (
                        <span className="price-board__offer-label" title="Sygnał jakości rynku — sprzedaż">
                          {sellLabelText}
                        </span>
                      )}
                      {buyLabelText !== "" && (
                        <span className="price-board__offer-label" title="Sygnał jakości rynku — kupno">
                          {buyLabelText}
                        </span>
                      )}
                    </>
                  );
                  // #419 AC3: a cell already carrying a market-free order is
                  // click-inert — the button stays a real <button> (#414's
                  // grid ARIA/focus contract), but its label stops promising
                  // an action it won't perform.
                  const isMarketFree = order !== undefined && MARKET_FREE_KINDS.has(order.kind);
                  const cellAriaLabel = isMarketFree
                    ? `${GOODS[good].name} w ${port.name}: zlecenie ${ORDER_KIND_LABEL[order!.kind]} — zmień przez „więcej”`
                    : `${GOODS[good].name} w ${port.name}: dodaj zlecenie`;
                  // Drawer's complete kind set (#419 AC1/AC7) — computed for
                  // every cell that has an active order, shared with
                  // RoutesTab via `legalOrderKinds` (routeAuthoring.ts).
                  const legalKinds =
                    order !== undefined ? legalOrderKinds(world.company.buildings, port.id, good) : [];
                  return (
                    <span
                      key={good}
                      className={dim ? "price-board__cell price-board__cell--dim" : "price-board__cell"}
                      role="cell"
                    >
                      {authoring && inDraft ? (
                        <button
                          type="button"
                          className="price-board__cell-btn"
                          aria-label={cellAriaLabel}
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
                      {order && (
                        <span
                          className="price-board__order-chip"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="price-board__order-chip-label">
                            {order.kind === "sell" && order.qty === undefined
                              ? // #398: a greedy sell order (route.ts's "today's
                                // greedy behavior" — no qty cap) must read legibly
                                // as "sell everything", not an opaque "Sprzedaj" —
                                // the good's own name replaces the redundant
                                // kind label rather than prefixing it.
                                `sprzedaj całość · ${GOODS[good].name}`
                              : `${ORDER_KIND_LABEL[order.kind]}${
                                  order.qty === undefined ? "" : ` · ${order.qty} szt.`
                                }`}
                          </span>
                          {/* #419 AC4: ⇄ stays a binary buy↔sell shortcut,
                              omitted for the market-free three — changing
                              their kind goes through the drawer only. */}
                          {(order.kind === "buy" || order.kind === "sell") && (
                            <button
                              type="button"
                              className="menu-btn"
                              aria-label={`${GOODS[good].name}: zmień na ${order.kind === "buy" ? "sprzedaż" : "kupno"}`}
                              onClick={() => flipOrderKind(stopIndex!, good, order.kind as "buy" | "sell")}
                            >
                              ⇄
                            </button>
                          )}
                          <button
                            type="button"
                            className="menu-btn"
                            aria-label={`${GOODS[good].name}: więcej opcji`}
                            onClick={() => toggleExpanded(cellKey, good)}
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
                              {/* #419 AC1: the drawer is the complete kind
                                  picker — every kind legal in this cell,
                                  buy/sell included. */}
                              <span className="price-board__order-kind-picker">
                                {legalKinds.map((kind) => (
                                  <button
                                    key={kind}
                                    type="button"
                                    aria-pressed={order.kind === kind}
                                    aria-label={`${GOODS[good].name}: ustaw zlecenie na ${ORDER_KIND_LABEL[kind]}`}
                                    className={
                                      order.kind === kind ? "menu-btn menu-btn--active" : "menu-btn"
                                    }
                                    onClick={() => pickOrderKind(stopIndex!, good, kind)}
                                  >
                                    {ORDER_KIND_LABEL[kind]}
                                  </button>
                                ))}
                              </span>
                              {/* #419 AC4/AC6: deliver/store/withdraw take
                                  neither qty nor minMargin (route.ts) — the
                                  drawer holds the kind picker above and
                                  nothing else for them. */}
                              {(order.kind === "buy" || order.kind === "sell") && (
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
                              )}
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
                  onRemoveStop: removeStopFromDraft,
                  onMoveStop: (index, direction) => setDraft(moveStop(draft, index, direction)),
                }}
              />
            </div>
          )}
          {/* #405 nit 2: RouteRibbon's editable dock only renders at >=2
              Stops (its loop-closure graphic needs at least two nodes), so a
              1-stop draft had no way to remove a mis-clicked first Stop
              short of "Anuluj" (discarding the whole draft). This standalone
              affordance covers exactly that gap — same remove semantics and
              label convention as the ribbon's own edit row. */}
          {authoring && draft && draft.stops.length === 1 && (
            <div className="price-board__single-stop-dock">
              <span className="price-board__single-stop-name">
                #1 {ports.find((p) => p.id === draft.stops[0].portId)?.name}
              </span>
              <button
                type="button"
                className="menu-btn"
                aria-label={`Usuń przystanek 1: ${ports.find((p) => p.id === draft.stops[0].portId)?.name}`}
                onClick={() => removeStopFromDraft(0)}
              >
                Usuń
              </button>
            </div>
          )}
        </>
      )}
    </OverlayShell>
  );
}
