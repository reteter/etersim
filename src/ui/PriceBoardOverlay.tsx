import { useState, type CSSProperties } from "react";
import {
  ARCHETYPE_PROFILES,
  GOOD_IDS,
  type GoodId,
  type Port,
  type PortId,
  type Route,
  type StopOrder,
} from "../sim";
import { useGameStore } from "../store/gameStore";
import { GOOD_NAME_PL } from "../store/goodDisplay";
import { computeMarketSignal, quotePortGood } from "../store/marketSignal";
import { computeOfferLabels, OFFER_LABEL_TEXT } from "../store/offerLabels";
import { GOOD_ICONS } from "./icons";
import { KontraktyTab } from "./KontraktyTab";
import { OverlayShell } from "./OverlayShell";
/* #468: the board renders **bare numbers**, like the mockup — a `₸` on every
 * one of the grid's ~70 quotes is noise at this density, and the unit is
 * stated once in the Port header instead. `quoteFormat.quoteLabel` stays the
 * shared formatter for every other surface (PortPanel), where a lone quote
 * does need its unit. The `—` for an untradable quote is preserved. */
function boardQuote(value: number | null): string {
  return value === null ? "—" : String(value);
}
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
import { RouteRibbon, type RouteRibbonNode, type RouteRibbonOrderChip } from "./RouteRibbon";
import { Tabs } from "./Tabs";

/** #96 (docs/specs/E3-contracts-and-guilds.md — UX skeleton): the overlay's
 *  two tabs. "ceny" behaves exactly as before this issue; "kontrakty" is new
 *  (KontraktyTab.tsx). */
type Tab = "ceny" | "kontrakty";

/** One port×good cell's two-sided quote.
 *
 *  #468 D2: the mid-price **trend is gone from the UI entirely** — the cell's
 *  triangles now carry the bid/ask direction, and one glyph cannot mean two
 *  things (§Laws 9, ADR-0006, incident 0002). `src/ui/priceTrend.ts` and the
 *  sim's `priceSnapshots` stay in place; only their UI consumers go, which is
 *  why this interface lost its `trend` field and `portCells` its snapshot
 *  parameter. */
interface Cell {
  readonly bid: number | null;
  readonly ask: number | null;
}

/** All cells for one port, keyed by good. `quotePortGood` (store/marketSignal)
 *  is the single quote source this board and the market-quality signal both
 *  read — sharing it is load-bearing (E16 spec — Trap 2): reimplementing the
 *  quote here would let the board's numbers silently drift from the signal's. */
function portCells(port: Port): Record<GoodId, Cell> {
  const cells = {} as Record<GoodId, Cell>;
  for (const good of GOOD_IDS) {
    cells[good] = quotePortGood(port, good);
  }
  return cells;
}

/** The goods a port's archetype **produces or consumes** (#468 D3). A fact
 *  about the world, like the archetype itself — deliberately not the
 *  market-quality signal, which would make the highlight a suggestion and
 *  cross the spec's *data ≠ suggestion* line. Every port trades every good
 *  (`worldgen.ts:182`), so an "availability" filter would light up the whole
 *  grid; role does not.
 *
 *  Producing and consuming share one treatment here — D3's own sub-choice
 *  ("whether producing and consuming get two distinguishable highlight
 *  treatments") is recorded as still open and is not decided in this
 *  prototype. */
function portRoleGoods(port: Port): Set<GoodId> {
  const profile = ARCHETYPE_PROFILES[port.archetype];
  const roles = new Set<GoodId>();
  for (const good of GOOD_IDS) {
    if ((profile.productionPerDay[good] ?? 0) > 0) roles.add(good);
    if ((profile.consumptionPerDay[good] ?? 0) > 0) roles.add(good);
  }
  return roles;
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

/** Lowercase verb forms for the ribbon's order chips (#468, mockup's
 *  `.ochip`: `kup · Grain`). The capitalized `ORDER_KIND_LABEL` above stays
 *  the drawer's kind-picker labels — same concept, two grammatical slots: a
 *  standalone button label vs. a verb inside a running chip phrase. */
const ORDER_VERB_PL: Record<StopOrder["kind"], string> = {
  buy: "kup",
  sell: "sprzedaj",
  deliver: "dostarcz",
  store: "złóż",
  withdraw: "pobierz",
};

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
  // Ribbon Stop selection (#468 D3): a *reading* gesture — it drives the
  // port-role highlight and nothing else. Deliberately not coupled to where
  // an order attaches: `handleCellClick` keeps resolving the Stop from the
  // clicked *row's* port (`lastStopIndexForPort`), so "selected Stop at port
  // Y, click a cell in row X" has no ambiguity to resolve.
  const [selectedStop, setSelectedStop] = useState<number | null>(null);

  if (!world) return null;

  const { ports } = world.region;
  const controlledShip = world.company.ships.find((s) => s.id === controlledShipId);
  const dockedPortId =
    controlledShip?.location.kind === "docked" ? controlledShip.location.portId : null;

  const cellsByPort = {} as Record<PortId, Record<GoodId, Cell>>;
  for (const port of ports) {
    cellsByPort[port.id] = portCells(port);
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
    setSelectedStop(null);
  };
  const cancelDraft = () => {
    setDraft(null);
    setExpanded(new Set());
    setFocusedGood(null);
    setSelectedStop(null);
  };
  const saveDraft = () => {
    if (!draft || !isValidRouteDraft(draft)) return;
    dispatch({ kind: "createRoute", route: draft });
    selectRoute(draft.id);
    setDraft(null);
    setExpanded(new Set());
    setFocusedGood(null);
    setSelectedStop(null);
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

  // #468 D7 (prototype consequence, flagged): the cell chip's ⇄ buy↔sell
  // shortcut (#419 AC4) has no home once chips move to the ribbon's action
  // row, and the mockup's `.ochip` carries no such control. Flip capability
  // is **not** lost — the drawer's kind picker is "the complete truth about
  // kind" (#419 AC1) and still lists buy and sell. `flipOrderKind` therefore
  // goes; if the owner wants the one-click flip back it belongs in D7's
  // context menu, not on the pill.

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

  // Port-role highlight (#468 D3): driven by the ribbon's selected Stop, so
  // it only exists while authoring. Null ⇒ no role dimming at all.
  const selectedRolePort =
    authoring && draft && selectedStop !== null && selectedStop < draft.stops.length
      ? (ports.find((p) => p.id === draft.stops[selectedStop].portId) ?? null)
      : null;
  const roleGoods = selectedRolePort ? portRoleGoods(selectedRolePort) : null;

  // Ribbon nodes, orders included (#468 D6/D7): the order chips live on the
  // ribbon's action row under their port, not in the grid cell they used to
  // occupy. The "więcej" drawer is *not* removed — it rides along with its
  // chip, unchanged, so the market-free kind picker (#419) keeps working
  // while the real context-menu home (D7) waits for a popover component.
  const ribbonNodes: RouteRibbonNode[] = (draft?.stops ?? []).map((stop, stopIndex) => {
    const port = ports.find((p) => p.id === stop.portId)!;
    const orders: RouteRibbonOrderChip[] = stop.orders.map((order) => {
      const good = order.good;
      const cellKey = `${port.id}:${good}`;
      const qtyPart = order.qty === undefined ? "" : ` · ${order.qty} szt.`;
      // Runtime execution legibility (spec §Runtime execution legibility,
      // #398): a greedy sell reads as "sell everything", never an opaque
      // "sprzedaj". `·` keeps the Good name out of a verb's object slot
      // (store/goodDisplay.ts — Good name grammar).
      const label =
        order.kind === "sell" && order.qty === undefined
          ? `sprzedaj całość · ${GOOD_NAME_PL[good]}`
          : `${ORDER_VERB_PL[order.kind]}${qtyPart} · ${GOOD_NAME_PL[good]}`;
      const legalKinds = legalOrderKinds(world.company.buildings, port.id, good);
      return {
        key: cellKey,
        label,
        side: order.kind === "buy" ? "buy" : order.kind === "sell" ? "sell" : "plain",
        ariaLabel: `${GOOD_NAME_PL[good]}: więcej opcji`,
        onClick: () => toggleExpanded(cellKey, good),
        onRemove: () => removeOrder(stopIndex, good),
        removeAriaLabel: `${GOOD_NAME_PL[good]}: usuń zlecenie`,
        drawer: expanded.has(cellKey) ? (
          <span className="price-board__order-more">
            {/* #419 AC1: the drawer is the complete kind picker — every
                kind legal in this cell, buy/sell included. */}
            <span className="price-board__order-kind-picker">
              {legalKinds.map((kind) => (
                <button
                  key={kind}
                  type="button"
                  aria-pressed={order.kind === kind}
                  aria-label={`${GOOD_NAME_PL[good]}: ustaw zlecenie na ${ORDER_KIND_LABEL[kind]}`}
                  className={order.kind === kind ? "menu-btn menu-btn--active" : "menu-btn"}
                  onClick={() => pickOrderKind(stopIndex, good, kind)}
                >
                  {ORDER_KIND_LABEL[kind]}
                </button>
              ))}
            </span>
            {/* #419 AC4/AC6: deliver/store/withdraw take neither qty nor
                minMargin (route.ts) — the drawer holds the kind picker
                above and nothing else for them. */}
            {(order.kind === "buy" || order.kind === "sell") && (
              <input
                type="number"
                min={1}
                step={1}
                placeholder="ile"
                title="Ile jednostek (puste = maksymalnie)"
                aria-label={`${GOOD_NAME_PL[good]} ile sztuk`}
                value={order.qty ?? ""}
                onChange={(e) => {
                  const result = parseQtyInput(e.target.value);
                  if (result.kind === "ignore" || !draft) return;
                  setDraft(
                    patchStopOrder(draft, stopIndex, good, {
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
                aria-label={`${GOOD_NAME_PL[good]} próg marży`}
                value={order.minMargin ?? ""}
                onChange={(e) => {
                  const result = parseMinMarginInput(e.target.value);
                  if (result.kind === "ignore" || !draft) return;
                  setDraft(
                    patchStopOrder(draft, stopIndex, good, {
                      minMargin: result.kind === "set" ? result.minMargin : undefined,
                    }),
                  );
                }}
              />
            )}
          </span>
        ) : undefined,
      };
    });
    return { portId: port.id, name: port.name, archetype: port.archetype, orders };
  });

  return (
    <OverlayShell
      ariaLabel="Tablica cen"
      title="Tablica cen"
      onClose={onClose}
      wide
      tabs={
        <Tabs
          ariaLabel="Zakładki tablicy cen"
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
          {/* #468 D2: the trend legend above the grid is gone with the trend
              itself — #127 (which made it always-visible) is knowingly
              reversed, because the thing it explained no longer renders. */}
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
          {/* #468: the ribbon docks **above the grid header**, not below the
              grid. It is not always visible — the dock animates open with
              authoring mode and the board's own height follows, smoothly
              (`grid-template-rows: 0fr → 1fr` in index.css; a `height: auto`
              transition would silently no-op). Rendered unconditionally in
              the closed state so the transition has a start frame. */}
          <div
            className={
              authoring && ribbonNodes.length >= 2
                ? "price-board__ribbon-dock price-board__ribbon-dock--open"
                : "price-board__ribbon-dock"
            }
          >
            <div className="price-board__ribbon-dock-inner">
              {ribbonNodes.length >= 2 && draft && (
                <RouteRibbon
                  routeName={draft.name}
                  nodes={ribbonNodes}
                  selectedIndex={selectedStop}
                  onSelectStop={(index) =>
                    setSelectedStop((prev) => (prev === index ? null : index))
                  }
                  edit={{
                    onRemoveStop: removeStopFromDraft,
                    onMoveStop: (index, direction) => setDraft(moveStop(draft, index, direction)),
                  }}
                />
              )}
            </div>
          </div>
          <div
            className="price-board"
            role="table"
            aria-label="Regionalna tablica cen"
            style={{ "--good-count": visibleGoodIds.length } as CSSProperties}
          >
          <div className="price-board__row price-board__row--header" role="row">
            <span className="price-board__port-header">
              Port
              {/* The unit, stated once — see `boardQuote` above. */}
              <span className="price-board__unit-hint"> · ₸</span>
            </span>
            {visibleGoodIds.map((good) => {
              const focused = effectiveFocus === good;
              // Two independent dimmings share one channel here: contextual
              // focus (#395) and the port-role highlight (#468 D3). Role
              // highlight only exists while a ribbon Stop is selected.
              const offRole = roleGoods !== null && !roleGoods.has(good);
              const dim = (effectiveFocus !== null && !focused) || offRole;
              const GoodIcon = GOOD_ICONS[good];
              return (
                <span key={good} className="price-board__good-col" role="columnheader">
                  <button
                    type="button"
                    className={
                      dim ? "price-board__good-header price-board__good-header--dim" : "price-board__good-header"
                    }
                    title={GOOD_NAME_PL[good]}
                    aria-pressed={focused}
                    aria-label={`Skup uwagę na: ${GOOD_NAME_PL[good]}`}
                    onClick={() => toggleManualFocus(good)}
                  >
                    {/* #468: goods render as icons like ports (ADR-0006, the
                        same vendored set). The caption stays in the DOM but
                        cannot widen its column — `.price-board__good-name`
                        is an ellipsizing `minmax(0, 1fr)` child in
                        index.css, so caption length never influences the
                        grid's uniform column width. */}
                    <GoodIcon className="price-board__good-icon" aria-hidden="true" />
                    <span className="price-board__good-name">{GOOD_NAME_PL[good]}</span>
                  </button>
                  <button
                    type="button"
                    className="menu-btn price-board__good-hide-btn"
                    aria-label={`Ukryj kolumnę: ${GOOD_NAME_PL[good]}`}
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
                {/* The archetype caption is a **sibling** of
                    `.price-board__port-name`, never a child: `market.spec.ts`
                    matches that element's textContent against an exact-anchored
                    `^Name$`, so folding the caption inside would silently break
                    an unrelated spec. */}
                <span className="price-board__port-cell">
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
                  {/* Archetype caption, as in the mockup (`.port-th .parch`).
                      Same English wording the PortPanel subtitle uses —
                      translating the six archetype names is a grill-sized
                      call (#184 flag), not a prototype one. */}
                  <span className="price-board__port-arch">
                    {port.archetype === "freeport" ? "free port" : port.archetype}
                  </span>
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
                  const dim =
                    (effectiveFocus !== null && effectiveFocus !== good) ||
                    (roleGoods !== null && !roleGoods.has(good));
                  // Offer labels (#397, spec §Market-quality signal rendering
                  // 3): the word rendering of the same signal driving
                  // isBestAsk/isBestBid above — buy-side labels ride the ask,
                  // sell-side the bid, matching which quote each label
                  // actually reasons about.
                  const cellLabels = offerLabels.entries[port.id][good];
                  const buyLabelText = cellLabels.buy.map((l) => OFFER_LABEL_TEXT[l]).join(" · ");
                  const sellLabelText = cellLabels.sell.map((l) => OFFER_LABEL_TEXT[l]).join(" · ");
                  // #468 D4: bid **left** with ▲, ask **right** with ▼, in the
                  // dedicated trade pair (rust / green, index.css
                  // `--trade-sell` / `--trade-buy`). The colours track the
                  // *player's action*, which deliberately inverts the owner's
                  // dictated cash-direction mapping — flagged at the table and
                  // accepted; do not "fix" it back. The pair is new on purpose:
                  // #5fbf7f/#d9705f already mean progress and warning.
                  const cellContent = (
                    <>
                      <span
                        className={
                          isBestBid ? "price-board__bid price-board__bid--best" : "price-board__bid"
                        }
                        title={`Sprzedajesz tu (bid)${sellLabelText !== "" ? ` — ${sellLabelText}` : ""}`}
                      >
                        <span className="price-board__tri" aria-hidden="true">
                          ▲
                        </span>
                        {boardQuote(cell.bid)}
                      </span>
                      <span
                        className={
                          isBestAsk ? "price-board__ask price-board__ask--best" : "price-board__ask"
                        }
                        title={`Kupujesz tu (ask)${buyLabelText !== "" ? ` — ${buyLabelText}` : ""}`}
                      >
                        <span className="price-board__tri" aria-hidden="true">
                          ▼
                        </span>
                        {boardQuote(cell.ask)}
                      </span>
                      {/* Offer labels (#397) survive the reformat as a second
                          line under the quote pair, so they never widen a
                          column (uniform width, #468). */}
                      {(sellLabelText !== "" || buyLabelText !== "") && (
                        <span
                          className="price-board__offer-label"
                          title="Sygnał jakości rynku"
                        >
                          {[sellLabelText, buyLabelText].filter((t) => t !== "").join(" · ")}
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
                    ? `${GOOD_NAME_PL[good]} w ${port.name}: zlecenie ${ORDER_KIND_LABEL[order!.kind]} — zmień przez „więcej” na wstążce`
                    : `${GOOD_NAME_PL[good]} w ${port.name}: dodaj zlecenie`;
                  // #468 D7: the cell no longer *holds* the order — the chip
                  // (and its "więcej" drawer, unchanged) lives on the ribbon's
                  // action row under the port. The cell keeps a hue-free
                  // "an order rides this cell" mark so the grid still tells
                  // you which good you already wired at this port.
                  const attached = order !== undefined;
                  const cellClasses = ["price-board__cell"];
                  if (dim) cellClasses.push("price-board__cell--dim");
                  if (attached) cellClasses.push("price-board__cell--attached");
                  return (
                    <span key={good} className={cellClasses.join(" ")} role="cell">
                      {authoring && inDraft ? (
                        <button
                          type="button"
                          className="price-board__cell-btn"
                          aria-label={cellAriaLabel}
                          data-cell-key={cellKey}
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
                    </span>
                  );
                })}
              </div>
            );
          })}
          </div>
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
