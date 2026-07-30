import { useEffect, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from "react";
import {
  ARCHETYPE_PROFILES,
  GOOD_IDS,
  GOODS,
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
import { ARCHETYPE_ICONS, GOOD_ICONS } from "./icons";
import { KontraktyTab } from "./KontraktyTab";
import { OverlayShell } from "./OverlayShell";
import { RouteOpsStrip } from "./RouteOpsStrip";
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
 * Gated on **whether a draft is active** (`draft !== null`, started via the
 * "Nowa trasa" button): no draft ⇒ unchanged row-click-opens-port
 * navigation; a draft active ⇒ the row stops navigating and its good cells
 * become the authoring surface instead (owner directive, superseding #394's
 * original row-click-appends-Stop gesture — see `openRadialMenu` below: a
 * cell click places the Stop, if needed, and opens the radial action menu
 * in one gesture). `B` still just opens the board (no new keybind).
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
  // Ribbon Stop selection (#468 D3): a *reading* gesture — it drives the
  // port-role highlight and nothing else. Deliberately not coupled to where
  // an order attaches: `openRadialMenu` keeps resolving the Stop from the
  // clicked *cell's* port (`lastStopIndexForPort`), so "selected Stop at port
  // Y, click a cell in row X" has no ambiguity to resolve.
  const [selectedStop, setSelectedStop] = useState<number | null>(null);
  // Cell-click radial menu (owner directive, superseding #394's row-click):
  // the port/good the last cell click targeted, plus the click's viewport
  // coordinates the menu opens at. `null` ⇒ closed. Viewport coordinates
  // (not port/good-relative) because the menu is `position: fixed`, matching
  // the click point regardless of the board's own scroll position.
  const [radialMenu, setRadialMenu] = useState<{
    portId: PortId;
    good: GoodId;
    x: number;
    y: number;
  } | null>(null);

  // Escape closes the radial menu without closing the whole overlay
  // (OverlayShell's own Escape handler would otherwise fire on the same
  // keystroke and dismiss both at once).
  useEffect(() => {
    if (!radialMenu) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setRadialMenu(null);
      }
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [radialMenu]);

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
  // Loads an existing Route straight into the board's own authoring surface
  // (owner directive — the board grows the "Edytuj →" seam #394 deliberately
  // left to #393). Mirrors RoutesTab's `startEdit`: the draft *is* the
  // existing Route, unmodified, so `editingExisting` below can tell "editing"
  // from "brand new" by identity alone — no separate mode flag to drift out
  // of sync with the draft itself.
  const startEditRoute = (route: Route) => {
    setDraft(route);
    setExpanded(new Set());
    setFocusedGood(null);
    setSelectedStop(null);
    selectRoute(route.id);
  };
  const cancelDraft = () => {
    setDraft(null);
    setExpanded(new Set());
    setFocusedGood(null);
    setSelectedStop(null);
  };
  // Same identity check as RoutesTab's `editingExisting`: a draft whose id
  // matches a live Route is an edit-in-place; any other id (freshly minted
  // by `nextRouteId` in `startDraft`) is a brand-new Route.
  const editingExisting = draft !== null && world.company.routes.some((r) => r.id === draft.id);
  const saveDraft = () => {
    if (!draft || !isValidRouteDraft(draft)) return;
    dispatch({ kind: editingExisting ? "updateRoute" : "createRoute", route: draft });
    selectRoute(draft.id);
    setDraft(null);
    setExpanded(new Set());
    setFocusedGood(null);
    setSelectedStop(null);
  };

  // Route deletion, moved off the retired Trasy tab with the rest of the
  // operational controls (owner directive 2026-07-30, point 8). Only reachable
  // while an existing Route is loaded, so the deleted Route is always the one
  // on screen — the draft is dropped with it, and the selection cleared, since
  // both would otherwise point at a Route that no longer exists.
  const deleteLoadedRoute = () => {
    if (!draft) return;
    dispatch({ kind: "deleteRoute", routeId: draft.id });
    selectRoute(null);
    cancelDraft();
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

  // Good-cell click: the port-centric spine now runs entirely through the
  // grid's cells (owner directive, superseding #394's row-click-appends-Stop
  // gesture) — clicking any cell opens a radial action menu at the click
  // point, offering the three market-legal kinds a cell can quick-attach
  // (kup/sprzedaj/dostarcz; store/withdraw stay drawer-only, unchanged).
  // Picking one both places the Stop (if the port isn't in the draft yet)
  // and attaches the order — one gesture instead of two.
  //
  // #419 AC3 — market-free cells stay click-inert: a cell whose good already
  // carries `deliver`/`store`/`withdraw` returns early, before the menu
  // opens. Removal is the ribbon chip's `×` only; changing kind goes through
  // the radial menu again (buy/sell) or the drawer (store/withdraw).
  const openRadialMenu = (e: ReactMouseEvent, portId: PortId, good: GoodId) => {
    if (!draft) return;
    const stopIndex = lastStopIndexForPort(draft, portId);
    const existingKind =
      stopIndex !== null ? draft.stops[stopIndex].orders.find((o) => o.good === good)?.kind : undefined;
    if (existingKind !== undefined && MARKET_FREE_KINDS.has(existingKind)) return;
    setRadialMenu({ portId, good, x: e.clientX, y: e.clientY });
  };

  const closeRadialMenu = () => setRadialMenu(null);

  // Revisit gesture (owner directive): cell clicks always resolve to the
  // port's *last* Stop (`lastStopIndexForPort`) so a player can attach
  // several goods to the same Stop without spawning a duplicate — but that
  // means cell clicks alone can never grow a Route past one Stop per port.
  // This appends a fresh, order-less Stop for `portId` unconditionally (even
  // if the port is already in the draft), so a Route can revisit a port —
  // Duskferry → Coppervale → Duskferry → Emberdock — same shape as the old
  // row-click gesture, just scoped to an explicit control instead of the
  // whole row.
  const addRepeatStop = (portId: PortId) => {
    if (!draft) return;
    const nextDraft = appendStop(draft, portId);
    setDraft(nextDraft);
    setSelectedStop(nextDraft.stops.length - 1);
  };

  const chooseRadialAction = (kind: "buy" | "sell" | "deliver") => {
    if (!draft || !radialMenu) return;
    const { portId, good } = radialMenu;
    let workingDraft = draft;
    let stopIndex = lastStopIndexForPort(workingDraft, portId);
    if (stopIndex === null) {
      workingDraft = appendStop(workingDraft, portId);
      stopIndex = workingDraft.stops.length - 1;
    }
    setDraft(setStopOrderKind(workingDraft, stopIndex, good, kind));
    setFocusedGood(good); // contextual focus (#395): attaching follows the task
    setRadialMenu(null);
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

  const isValid = draft ? isValidRouteDraft(draft) : false;
  const effectiveFocus: GoodId | null = focusedGood;

  // Port-role highlight (#468 D3): driven by the ribbon's selected Stop, so
  // it only exists while authoring. Null ⇒ no role dimming at all.
  const selectedRolePort =
    authoring && draft && selectedStop !== null && selectedStop < draft.stops.length
      ? (ports.find((p) => p.id === draft.stops[selectedStop].portId) ?? null)
      : null;
  const roleGoods = selectedRolePort ? portRoleGoods(selectedRolePort) : null;

  // The 1-Stop draft's own port, for the ribbon's mini-rail (see the
  // ribbon-dock JSX below) — the sole remaining case where a Stop's
  // info/controls need rendering outside `RouteRibbon` itself (which draws
  // nothing below 2 nodes, route.ts's own floor for a Route to exist).
  const singleStopPort =
    authoring && draft && draft.stops.length === 1
      ? (ports.find((p) => p.id === draft.stops[0].portId) ?? null)
      : null;

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
      // Dense-Route short form: keep the **good name**, drop the verb word,
      // and let the same triangle the grid's cells use carry the direction
      // (▲ = you sell / bid, ▼ = you buy / ask, #468 D4). Truncating the full
      // phrase instead would eat the good name first and leave "sprzedaj c…".
      const shortLabel =
        order.kind === "buy"
          ? `▼ ${GOOD_NAME_PL[good]}`
          : order.kind === "sell"
            ? `▲ ${GOOD_NAME_PL[good]}`
            : `${ORDER_VERB_PL[order.kind]} · ${GOOD_NAME_PL[good]}`;
      return {
        key: cellKey,
        label,
        shortLabel,
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
          <div className="price-board__authoring-bar">
            {/* Route tabs (owner directive): "Nowa trasa" plus one tab per
                existing Route, always in this row regardless of authoring
                state — picking a Route tab loads it straight into the
                board's own authoring surface (`startEditRoute`), the "Edytuj
                →" seam #394 originally left to #393, built here instead. */}
            <div className="price-board__route-tabs" role="tablist" aria-label="Trasy">
              <button
                type="button"
                role="tab"
                aria-selected={authoring && !editingExisting}
                className={
                  authoring && !editingExisting
                    ? "menu-btn price-board__route-tab price-board__route-tab--active"
                    : "menu-btn price-board__route-tab"
                }
                onClick={startDraft}
              >
                Nowa trasa
              </button>
              {world.company.routes.map((route) => (
                <button
                  key={route.id}
                  type="button"
                  role="tab"
                  aria-selected={draft?.id === route.id}
                  className={
                    draft?.id === route.id
                      ? "menu-btn price-board__route-tab price-board__route-tab--active"
                      : "menu-btn price-board__route-tab"
                  }
                  onClick={() => startEditRoute(route)}
                >
                  {route.name}
                </button>
              ))}
            </div>
            {authoring && (
              <>
                <span className="price-board__authoring-hint">
                  {draft!.stops.length === 0
                    ? "Kliknij komórkę towaru, aby dodać pierwszy przystanek."
                    : draft!.stops.length === 1
                      ? "Kliknij komórkę towaru w kolejnym porcie, aby dodać drugi przystanek."
                      : "Kliknij komórkę towaru, aby dodać przystanek lub zlecenie."}
                </span>
                <button
                  type="button"
                  className="menu-btn"
                  disabled={!isValid}
                  onClick={saveDraft}
                >
                  {editingExisting ? "Zapisz zmiany" : "Zapisz trasę"}
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
              authoring
                ? "price-board__ribbon-dock price-board__ribbon-dock--open"
                : "price-board__ribbon-dock"
            }
          >
            <div className="price-board__ribbon-dock-inner">
              {/* The dock opens with **authoring mode**, not with the second
                  Stop — the package's "it appears with authoring mode" and
                  the mockup's `.ribbon.empty::before` (a dashed frame
                  carrying "Kliknij port w siatce → ląduje tu jako Stop")
                  agree, and the mockup wins on appearance. `RouteRibbon`
                  itself still returns null below 2 nodes (route.ts: a Route
                  needs >=2 Stops), so the empty frame is the board's, not
                  the component's. */}
              {ribbonNodes.length < 2 && (
                <div className="route-ribbon route-ribbon--empty">
                  {singleStopPort ? (
                    // The single-Stop draft's own mini-rail (replaces the old
                    // bottom-of-board dock): the ribbon is now the *only*
                    // place a Stop's info/controls live, even below the
                    // 2-Stop floor RouteRibbon itself draws at.
                    <div className="route-ribbon__rail route-ribbon__rail--single">
                      <div className="route-ribbon__slot">
                        <div
                          className="route-ribbon__node"
                          style={{ "--port-color": `var(--archetype-${singleStopPort.archetype})` } as CSSProperties}
                        >
                          <div className="route-ribbon__status" aria-hidden="true" />
                          <span className="route-ribbon__disc">
                            {(() => {
                              const Icon = ARCHETYPE_ICONS[singleStopPort.archetype];
                              return <Icon className="route-ribbon__node-icon" aria-hidden="true" />;
                            })()}
                          </span>
                          <span className="route-ribbon__node-label">{singleStopPort.name}</span>
                          <div
                            className="route-ribbon__edit"
                            role="group"
                            aria-label={`Przystanek 1: ${singleStopPort.name} — edycja`}
                          >
                            <button
                              type="button"
                              className="menu-btn"
                              aria-label={`Usuń przystanek 1: ${singleStopPort.name}`}
                              onClick={() => removeStopFromDraft(0)}
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="route-ribbon__empty-hint">
                      Kliknij komórkę towaru w siatce → dodaje port jako przystanek i otwiera menu akcji.
                    </p>
                  )}
                </div>
              )}
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
              {/* The Route's operational half (owner directive 2026-07-30,
                  point 8) — docked under the rail it belongs to, so geometry
                  and operation read as one Route rather than two panels. Fed
                  the **saved** Route, not the draft: loop metrics and ship
                  assignment are facts about what has been running, and would
                  otherwise flicker against unsaved edits. */}
              {editingExisting &&
                draft &&
                (() => {
                  const saved = world.company.routes.find((r) => r.id === draft.id);
                  return saved ? (
                    <RouteOpsStrip world={world} route={saved} onDelete={deleteLoadedRoute} />
                  ) : null;
                })()}
            </div>
          </div>
          <div
            className="price-board"
            role="table"
            aria-label="Regionalna tablica cen"
            style={{ "--good-count": GOOD_IDS.length } as CSSProperties}
          >
          <div className="price-board__row price-board__row--header" role="row">
            <span className="price-board__port-header">
              Port
              {/* The unit, stated once — see `boardQuote` above. */}
              <span className="price-board__unit-hint"> · ₸</span>
            </span>
            {GOOD_IDS.map((good) => {
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
                    {/* The mockup's per-column `bazowa 10` sub-caption: the
                        good's reference price, so a column of three-digit
                        numbers has a scale to be read against. Also
                        width-neutral — it is the shortest line in the
                        header. */}
                    <span className="price-board__good-base">
                      bazowa {GOODS[good].basePrice}
                    </span>
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
                // Port-adding now runs entirely through the grid's cells
                // (see `openRadialMenu` below) — the row itself only jumps
                // to the port's own panel, and only outside authoring.
                onClick={() => {
                  if (!authoring) openPort(port.id);
                }}
                onKeyDown={(e) => {
                  // Enter/Space activate the row, matching native button
                  // behavior (Harbor.tsx uses real <button>s for its rows;
                  // here role="row" must stay valid grid semantics, so
                  // keyboard activation is wired explicitly instead).
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    if (!authoring) openPort(port.id);
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
                    {/* Revisit gesture: always available while authoring,
                        including for a port already in the draft — the
                        only way left to place a Route that visits the same
                        port twice (owner directive). */}
                    {authoring && (
                      <button
                        type="button"
                        className="menu-btn price-board__port-add-btn"
                        aria-label={
                          inDraft
                            ? `Dodaj ${port.name} jako kolejny (powtórzony) przystanek`
                            : `Dodaj ${port.name} jako przystanek`
                        }
                        onClick={(e) => {
                          e.stopPropagation();
                          addRepeatStop(port.id);
                        }}
                      >
                        +
                      </button>
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
                {GOOD_IDS.map((good) => {
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
                    : inDraft
                      ? `${GOOD_NAME_PL[good]} w ${port.name}: wybierz akcję`
                      : `${GOOD_NAME_PL[good]} w ${port.name}: dodaj przystanek i wybierz akcję`;
                  // #468 D7: the cell no longer *holds* the order — the chip
                  // (and its "więcej" drawer, unchanged) lives on the ribbon's
                  // action row under the port. The cell keeps a hue-free
                  // "an order rides this cell" mark so the grid still tells
                  // you which good you already wired at this port.
                  const attached = order !== undefined;
                  const cellClasses = ["price-board__cell"];
                  if (dim) cellClasses.push("price-board__cell--dim");
                  if (attached) cellClasses.push("price-board__cell--attached");
                  if (authoring && !isMarketFree) cellClasses.push("price-board__cell--interactive");
                  return (
                    <span key={good} className={cellClasses.join(" ")} role="cell">
                      {authoring && !isMarketFree ? (
                        <button
                          type="button"
                          className="price-board__cell-btn"
                          aria-label={cellAriaLabel}
                          data-cell-key={cellKey}
                          onClick={(e) => {
                            e.stopPropagation();
                            openRadialMenu(e, port.id, good);
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
          {/* Cell-click radial menu (owner directive): a `position: fixed`
              backdrop + fan of action buttons anchored to the click point.
              Only the three market-legal kinds a cell quick-attaches
              (kup/sprzedaj/dostarcz) — store/withdraw stay reachable through
              the ribbon chip's "więcej" drawer, unchanged. */}
          {radialMenu &&
            (() => {
              const good = radialMenu.good;
              const actions = legalOrderKinds(world.company.buildings, radialMenu.portId, good).filter(
                (k): k is "buy" | "sell" | "deliver" => k === "buy" || k === "sell" || k === "deliver",
              );
              return (
                <div
                  className="radial-menu-backdrop"
                  onClick={closeRadialMenu}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    closeRadialMenu();
                  }}
                >
                  <div
                    className="radial-menu"
                    style={{ left: radialMenu.x, top: radialMenu.y } as CSSProperties}
                    role="menu"
                    aria-label={`${GOOD_NAME_PL[good]}: wybierz akcję`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="radial-menu__label" aria-hidden="true">
                      {GOOD_NAME_PL[good]}
                    </span>
                    {actions.map((kind, i) => (
                      <button
                        key={kind}
                        type="button"
                        role="menuitem"
                        className={`radial-menu__item radial-menu__item--${kind}`}
                        style={{ "--angle": `${(i * 360) / actions.length - 90}deg` } as CSSProperties}
                        onClick={() => chooseRadialAction(kind)}
                      >
                        {ORDER_KIND_LABEL[kind]}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })()}
          {/* Key for the cell's visual language, under the grid — the
              mockup's own `.legend` strip, which explains exactly the three
              channels this reformat introduced. NOT the #127 trend legend
              D2 removed (that explained a rendering that no longer exists);
              this explains the one that replaced it. Flagged in the
              completion report as a mockup-sourced addition beyond the
              literal task list — strike it if the owner wants the board
              silent about its own palette. */}
          <p className="price-board__key">
            <span className="price-board__key-item">
              <span className="price-board__bid price-board__bid--best" aria-hidden="true">
                <span className="price-board__tri">▲</span>
              </span>
              bid — sprzedajesz tu
            </span>
            <span className="price-board__key-item">
              <span className="price-board__ask price-board__ask--best" aria-hidden="true">
                <span className="price-board__tri">▼</span>
              </span>
              ask — kupujesz tu
            </span>
            <span className="price-board__key-item">
              <strong>jaśniej</strong> = najlepszy rynek w regionie
            </span>
          </p>
        </>
      )}
    </OverlayShell>
  );
}
