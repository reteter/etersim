import { useState } from "react";
import {
  GOOD_IDS,
  resolveReferencePort,
  type CompanyBuilding,
  type GoodId,
  type Port,
  type PortId,
  type Route,
  type RouteId,
  type ShipId,
  type Stop,
  type StopOrder,
  type World,
} from "../sim";
import { useGameStore } from "../store/gameStore";
import { GOOD_NAME_PL } from "../store/goodDisplay";
import { computeLoopMetrics } from "../store/routeMetrics";
import {
  legalOrderKinds,
  nextRouteId,
  parseMinMarginInput,
  parseQtyInput,
  storehouseAt,
} from "./routeAuthoring";

/** Column headers for the per-good order table (Polish, 2026-07-14 UI grill:
 *  new visible labels ship Polish). The chip buttons underneath used to keep
 *  their English aria-label/accessible-name (only the *visible* button text
 *  moved to a checkmark) — #184's 2026-07-16 AC comment names this table's
 *  aria-labels specifically, so they are Polish now too (e2e updated in the
 *  same PR). */
const ORDER_KINDS = ["buy", "sell", "deliver"] as const;
const ORDER_KIND_LABEL: Record<(typeof ORDER_KINDS)[number], string> = {
  buy: "Kup",
  sell: "Sprzedaj",
  deliver: "Dostarcz",
};

/** Storehouse order kinds (E13, #101): store/withdraw chips, appended only
 *  for a Stop whose port hosts a Company `CompanyBuilding` (spec §UX
 *  skeleton — "shown only for ports with a Company storehouse"). Net-new
 *  Polish player-facing strings (2026-07-14 UI grill). */
const STORE_ORDER_KINDS = ["store", "withdraw"] as const;
const STORE_ORDER_KIND_LABEL: Record<(typeof STORE_ORDER_KINDS)[number], string> = {
  store: "Złóż",
  withdraw: "Pobierz",
};

/** One Stop row: a port dropdown + a goods × order-kind table — one row per
 *  good, one column per order kind (#220: was a repeated chip strip per
 *  good, hard to scan). Each cell is a toggle, and selecting a different
 *  cell in the same row replaces (never adds to) that good's order,
 *  enforcing "a good in at most one order per Stop" in the editor itself.
 *  store/withdraw columns (E13, #101) only appear for a Stop whose port
 *  hosts a Company storehouse, and only render a chip for goods in that
 *  Building's own `storehouseFilter` — never a chip that would silently
 *  no-op against the Building's goods filter. */
function StopRow({
  stop,
  index,
  route,
  ports,
  buildings,
  onChange,
  onRemove,
}: {
  stop: Stop;
  index: number;
  /** The whole draft Route (not just this Stop) — `resolveReferencePort`
   *  needs the full Stop list to scan for the next sell-stop, wrapping the
   *  loop from `index`. */
  route: Route;
  ports: readonly Port[];
  /** The Company's activated Storehouses (E13, #101) — looked up per Stop
   *  by `portId` so the store/withdraw columns react live as the port
   *  dropdown changes. */
  buildings: readonly CompanyBuilding[];
  onChange: (next: Stop) => void;
  onRemove: () => void;
}) {
  // Legality shared with the board (#419, spec §The market-free kinds point
  // 7 — one copy, `routeAuthoring.ts`, so this editor and the board cannot
  // drift while both authoring surfaces coexist ahead of #393).
  const building = storehouseAt(buildings, stop.portId);
  const kinds = building ? [...ORDER_KINDS, ...STORE_ORDER_KINDS] : [...ORDER_KINDS];
  const kindLabel = (kind: (typeof kinds)[number]): string =>
    (ORDER_KIND_LABEL as Record<string, string>)[kind] ??
    (STORE_ORDER_KIND_LABEL as Record<string, string>)[kind];
  const kindOf = (good: GoodId): StopOrder["kind"] | null =>
    stop.orders.find((o) => o.good === good)?.kind ?? null;
  const orderOf = (good: GoodId): StopOrder | undefined =>
    stop.orders.find((o) => o.good === good);
  const setOrder = (good: GoodId, kind: StopOrder["kind"]) => {
    const withoutGood = stop.orders.filter((o) => o.good !== good);
    const next = kindOf(good) === kind ? withoutGood : [...withoutGood, { kind, good }];
    onChange({ ...stop, orders: next });
  };
  /** Patches the good's existing order (qty and/or minMargin) in place —
   *  never changes `kind`/`good`, so it's only ever called for an already-
   *  active cell (the qty/minMargin inputs only render then). */
  const patchOrder = (good: GoodId, patch: Partial<Pick<StopOrder, "qty" | "minMargin">>) => {
    const next = stop.orders.map((o) => (o.good === good ? { ...o, ...patch } : o));
    onChange({ ...stop, orders: next });
  };
  /** "up to N": blank ⇒ greedy (`qty` absent); anything short of a positive
   *  integer is ignored (matches `isValidRoute`'s own qty check,
   *  commands.ts) rather than let the editor build a route the sim would
   *  reject outright. Parse rule relocated to `routeAuthoring.ts` (#394 pin
   *  #2) — shared with the board editor, applied here the same way. */
  const setQty = (good: GoodId, raw: string) => {
    const result = parseQtyInput(raw);
    if (result.kind === "ignore") return;
    patchOrder(good, { qty: result.kind === "set" ? result.qty : undefined });
  };
  /** Margin Gate threshold: blank ⇒ no gate (`minMargin` absent);
   *  `isValidRoute` places no sign/integer constraint on `minMargin` itself
   *  (only that it's buy-only), so any finite number is accepted. Parse rule
   *  relocated to `routeAuthoring.ts` (#394 pin #2). */
  const setMinMargin = (good: GoodId, raw: string) => {
    const result = parseMinMarginInput(raw);
    if (result.kind === "ignore") return;
    patchOrder(good, { minMargin: result.kind === "set" ? result.minMargin : undefined });
  };
  /** Inactive-gate warning (E9.1 AC): a buy's `minMargin` is set but there's
   *  no sell-stop for the good anywhere on the (draft) route — the same
   *  `resolveReferencePort` the sim's gate uses, so the editor never
   *  diverges from the real evaluation. */
  const isGateInactive = (good: GoodId): boolean => {
    const order = orderOf(good);
    if (!order || order.kind !== "buy" || order.minMargin === undefined) return false;
    return resolveReferencePort(route, index, good) === null;
  };

  return (
    <div className="stop-row">
      <span className="stop-row__index">#{index + 1}</span>
      <select
        className="stop-row__port"
        aria-label={`Przystanek ${index + 1} — port`}
        value={stop.portId}
        onChange={(e) => onChange({ ...stop, portId: e.target.value as PortId })}
      >
        {ports.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <table className="stop-row__goods">
        <thead>
          <tr>
            <th className="stop-row__goods-header" />
            {kinds.map((kind) => (
              <th key={kind} className="stop-row__goods-header">
                {kindLabel(kind)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {GOOD_IDS.map((good) => (
            <tr key={good}>
              <th scope="row" className="stop-row__good-name">
                {GOOD_NAME_PL[good]}
              </th>
              {kinds.map((kind) => {
                // A store/withdraw column only offers a chip for goods in
                // the Building's own goods filter — a good outside it (e.g.
                // textiles at a Granary) would only ever no-op against the
                // Building's StorePolicy, so no chip renders for it at all
                // rather than a dead control. `legalOrderKinds` is the
                // shared source of truth (#419).
                const isStoreKind = kind === "store" || kind === "withdraw";
                if (isStoreKind && !legalOrderKinds(buildings, stop.portId, good).includes(kind)) {
                  return <td key={kind} className="stop-row__good-cell" />;
                }
                const active = kindOf(good) === kind;
                const order = active ? orderOf(good) : undefined;
                // E9.1: qty on an active buy/sell cell (never deliver, store,
                // or withdraw — store/withdraw never take qty, route.ts).
                const showQty = active && (kind === "buy" || kind === "sell");
                const showMinMargin = active && kind === "buy";
                return (
                  <td key={kind} className="stop-row__good-cell">
                    <button
                      type="button"
                      aria-pressed={active}
                      aria-label={`${GOOD_NAME_PL[good]} ${kindLabel(kind)} — przystanek ${index + 1}`}
                      className={active ? "chip chip--active" : "chip"}
                      onClick={() => setOrder(good, kind)}
                    >
                      {active ? "✓" : ""}
                    </button>
                    {showQty && (
                      <input
                        className="stop-row__qty"
                        type="number"
                        min={1}
                        step={1}
                        placeholder="ile"
                        title="Ile jednostek (puste = maksymalnie)"
                        aria-label={`${GOOD_NAME_PL[good]} ilość — przystanek ${index + 1}`}
                        value={order?.qty ?? ""}
                        onChange={(e) => setQty(good, e.target.value)}
                      />
                    )}
                    {showMinMargin && (
                      <>
                        <input
                          className="stop-row__min-margin"
                          type="number"
                          step={1}
                          placeholder="próg"
                          title="Próg marży: czekaj, aż dowóz się opłaci (puste = bez progu)"
                          aria-label={`${GOOD_NAME_PL[good]} próg marży — przystanek ${index + 1}`}
                          value={order?.minMargin ?? ""}
                          onChange={(e) => setMinMargin(good, e.target.value)}
                        />
                        {isGateInactive(good) && (
                          <p className="stop-row__gate-warning">
                            Brak przystanku sprzedaży tego towaru na trasie — próg marży nie
                            zadziała.
                          </p>
                        )}
                      </>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" className="stop-row__remove" onClick={onRemove}>
        Usuń przystanek
      </button>
    </div>
  );
}

/** Route editor: builds a draft Route locally (Stop-by-Stop) before it's a
 *  valid Command payload — createRoute/updateRoute reject anything short of
 *  ≥2 Stops across ≥2 distinct ports (src/sim/commands.ts isValidRoute), so
 *  Save stays disabled until the draft already clears that bar. */
function RouteEditor({
  world,
  draft,
  onChange,
  onSave,
  onCancel,
}: {
  world: World;
  draft: Route;
  onChange: (next: Route) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const ports = world.region.ports;
  const isValid = draft.stops.length >= 2 && new Set(draft.stops.map((s) => s.portId)).size >= 2;

  return (
    <div className="route-editor">
      <input
        className="route-editor__name"
        aria-label="Nazwa trasy"
        value={draft.name}
        onChange={(e) => onChange({ ...draft, name: e.target.value })}
      />
      {draft.stops.map((stop, i) => (
        <StopRow
          key={i}
          stop={stop}
          index={i}
          route={draft}
          ports={ports}
          buildings={world.company.buildings}
          onChange={(next) =>
            onChange({ ...draft, stops: draft.stops.map((s, j) => (j === i ? next : s)) })
          }
          onRemove={() => onChange({ ...draft, stops: draft.stops.filter((_, j) => j !== i) })}
        />
      ))}
      <button
        type="button"
        className="menu-btn"
        onClick={() =>
          onChange({ ...draft, stops: [...draft.stops, { portId: ports[0].id, orders: [] }] })
        }
      >
        Dodaj przystanek
      </button>
      {!isValid && (
        <p className="side-panel__hint">Trasa wymaga co najmniej 2 przystanków w 2 różnych portach.</p>
      )}
      <div className="route-editor__actions">
        <button type="button" className="menu-btn" disabled={!isValid} onClick={onSave}>
          Zapisz trasę
        </button>
        <button type="button" className="menu-btn" onClick={onCancel}>
          Anuluj
        </button>
      </div>
    </div>
  );
}

/** One Route's row in the Trasy list: loop metrics, assign/unassign, suspend
 *  state, resume — everything docs/specs/E9's Loop metrics + assignment ACs
 *  ask for, per Route. */
function RouteRow({
  world,
  route,
  selected,
  onSelect,
  onEdit,
  onDelete,
}: {
  world: World;
  route: Route;
  selected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const dispatch = useGameStore((s) => s.dispatch);
  const metrics = computeLoopMetrics(world, route);
  const assignedShips = world.company.ships.filter((s) => s.assignment?.routeId === route.id);
  const unassignedShips = world.company.ships.filter((s) => s.assignment?.routeId !== route.id);
  const [assignShipId, setAssignShipId] = useState<ShipId | "">("");

  return (
    <div className={selected ? "route-row route-row--selected" : "route-row"}>
      <button type="button" className="route-row__name" onClick={onSelect}>
        {route.name}
      </button>
      <div className="route-row__metrics">
        <span>Kurs: {metrics.totalCourseTicks}t/pętla</span>
        <span>Opłaty dokowe/pętla: {metrics.lastLoopDockingFees ?? "—"}</span>
        <span className="route-row__result">
          Ostatnia pętla:{" "}
          {metrics.lastLoopNet === null
            ? "brak jeszcze pętli"
            : `${metrics.lastLoopNet >= 0 ? "+" : "−"}₸${Math.abs(metrics.lastLoopNet)}`}
        </span>
      </div>
      <div className="route-row__ships">
        {assignedShips.map((ship) => (
          <div key={ship.id} className="route-row__ship">
            <span>{ship.name}</span>
            {ship.assignment!.suspended && (
              <>
                <span className="route-row__suspended">wstrzymana</span>
                <button
                  type="button"
                  className="menu-btn"
                  onClick={() => dispatch({ kind: "resumeRoute", shipId: ship.id })}
                >
                  Wznów
                </button>
              </>
            )}
            <button
              type="button"
              className="menu-btn"
              onClick={() => dispatch({ kind: "unassignRoute", shipId: ship.id })}
            >
              Odepnij
            </button>
          </div>
        ))}
        {unassignedShips.length > 0 && (
          <div className="route-row__assign">
            <select
              aria-label={`Przypisz statek do trasy ${route.name}`}
              value={assignShipId}
              onChange={(e) => setAssignShipId(e.target.value as ShipId | "")}
            >
              <option value="">Przypisz statek…</option>
              {unassignedShips.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="menu-btn"
              disabled={!assignShipId}
              onClick={() => {
                if (!assignShipId) return;
                dispatch({ kind: "assignRoute", shipId: assignShipId, routeId: route.id });
                setAssignShipId("");
              }}
            >
              Przypisz
            </button>
          </div>
        )}
      </div>
      <div className="route-row__actions">
        <button type="button" className="menu-btn" onClick={onEdit}>
          Edytuj
        </button>
        <button type="button" className="menu-btn" onClick={onDelete}>
          Usuń
        </button>
      </div>
    </div>
  );
}

/** The "Trasy" tab (docs/specs/E9 — UX skeleton): the Company's Route
 *  templates — create/edit via a list-based Stop editor, assign/unassign
 *  ships, and each Route's loop metrics (route-rot legible at a glance). */
export function RoutesTab({ world }: { world: World }) {
  const dispatch = useGameStore((s) => s.dispatch);
  const selectedRouteId = useGameStore((s) => s.selectedRouteId);
  const selectRoute = useGameStore((s) => s.selectRoute);
  const [draft, setDraft] = useState<Route | null>(null);

  const routes = world.company.routes;
  const editingExisting = draft ? routes.some((r) => r.id === draft.id) : false;

  const startNew = () => {
    setDraft({ id: nextRouteId(world), name: `Trasa ${routes.length + 1}`, stops: [] });
  };
  const startEdit = (route: Route) => {
    setDraft(route);
    selectRoute(route.id);
  };
  const save = () => {
    if (!draft) return;
    dispatch({ kind: editingExisting ? "updateRoute" : "createRoute", route: draft });
    selectRoute(draft.id);
    setDraft(null);
  };
  const cancel = () => setDraft(null);
  const remove = (routeId: RouteId) => {
    dispatch({ kind: "deleteRoute", routeId });
    if (selectedRouteId === routeId) selectRoute(null);
  };

  return (
    <div className="headquarters-routes">
      <div className="route-list">
        {routes.length === 0 && <p className="side-panel__hint">Brak jeszcze tras.</p>}
        {routes.map((route) => (
          <RouteRow
            key={route.id}
            world={world}
            route={route}
            selected={route.id === selectedRouteId}
            onSelect={() => selectRoute(route.id === selectedRouteId ? null : route.id)}
            onEdit={() => startEdit(route)}
            onDelete={() => remove(route.id)}
          />
        ))}
      </div>
      {draft ? (
        <RouteEditor world={world} draft={draft} onChange={setDraft} onSave={save} onCancel={cancel} />
      ) : (
        <button type="button" className="menu-btn" onClick={startNew}>
          Nowa trasa
        </button>
      )}
    </div>
  );
}
