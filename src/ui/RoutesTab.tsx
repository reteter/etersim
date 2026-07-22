import { useState } from "react";
import {
  GOOD_IDS, GOODS, resolveReferencePort, storehouseFilter,
  type CompanyBuilding, type GoodId, type Port, type PortId, type Route, type RouteId,
  type ShipId, type Stop, type StopOrder, type World,
} from "../sim";
import { useGameStore } from "../store/gameStore";
import { computeLoopMetrics } from "../store/routeMetrics";

const ORDER_KINDS = ["buy", "sell", "deliver"] as const;
const ORDER_KIND_LABEL: Record<(typeof ORDER_KINDS)[number], string> = { buy: "Kup", sell: "Sprzedaj", deliver: "Dostarcz" };
const STORE_ORDER_KINDS = ["store", "withdraw"] as const;
const STORE_ORDER_KIND_LABEL: Record<(typeof STORE_ORDER_KINDS)[number], string> = { store: "Złóż", withdraw: "Pobierz" };

function StopRow({ stop, index, route, ports, buildings, onChange, onRemove }: {
  stop: Stop; index: number; route: Route; ports: readonly Port[]; buildings: readonly CompanyBuilding[];
  onChange: (next: Stop) => void; onRemove: () => void;
}) {
  const building = buildings.find((building) => building.portId === stop.portId);
  const storehouseGoods = building ? new Set(storehouseFilter(building.variant)) : null;
  const kinds = building ? [...ORDER_KINDS, ...STORE_ORDER_KINDS] : [...ORDER_KINDS];
  const kindLabel = (kind: (typeof kinds)[number]) => (ORDER_KIND_LABEL as Record<string, string>)[kind] ?? (STORE_ORDER_KIND_LABEL as Record<string, string>)[kind];
  const orderOf = (good: GoodId) => stop.orders.find((order) => order.good === good);
  const kindOf = (good: GoodId): StopOrder["kind"] | null => orderOf(good)?.kind ?? null;
  const setOrder = (good: GoodId, kind: StopOrder["kind"]) => {
    const withoutGood = stop.orders.filter((order) => order.good !== good);
    onChange({ ...stop, orders: kindOf(good) === kind ? withoutGood : [...withoutGood, { kind, good }] });
  };
  const patchOrder = (good: GoodId, patch: Partial<Pick<StopOrder, "qty" | "minMargin">>) =>
    onChange({ ...stop, orders: stop.orders.map((order) => order.good === good ? { ...order, ...patch } : order) });
  const setQty = (good: GoodId, raw: string) => {
    if (raw.trim() === "") return patchOrder(good, { qty: undefined });
    const qty = Number(raw); if (Number.isInteger(qty) && qty > 0) patchOrder(good, { qty });
  };
  const setMinMargin = (good: GoodId, raw: string) => {
    if (raw.trim() === "") return patchOrder(good, { minMargin: undefined });
    const minMargin = Number(raw); if (Number.isFinite(minMargin)) patchOrder(good, { minMargin });
  };
  const isGateInactive = (good: GoodId) => {
    const order = orderOf(good);
    return Boolean(order?.kind === "buy" && order.minMargin !== undefined && resolveReferencePort(route, index, good) === null);
  };
  return <div className="stop-row">
    <span className="stop-row__index">#{index + 1}</span>
    <select className="stop-row__port" aria-label={`Stop ${index + 1} port`} value={stop.portId} onChange={(e) => onChange({ ...stop, portId: e.target.value as PortId })}>
      {ports.map((port) => <option key={port.id} value={port.id}>{port.name}</option>)}
    </select>
    <table className="stop-row__goods"><thead><tr><th className="stop-row__goods-header" />{kinds.map((kind) => <th key={kind} className="stop-row__goods-header">{kindLabel(kind)}</th>)}</tr></thead>
      <tbody>{GOOD_IDS.map((good) => <tr key={good}><th scope="row" className="stop-row__good-name">{GOODS[good].name}</th>{kinds.map((kind) => {
        if ((kind === "store" || kind === "withdraw") && storehouseGoods && !storehouseGoods.has(good)) return <td key={kind} className="stop-row__good-cell" />;
        const active = kindOf(good) === kind; const order = active ? orderOf(good) : undefined;
        const showQty = active && (kind === "buy" || kind === "sell"); const showMinMargin = active && kind === "buy";
        return <td key={kind} className="stop-row__good-cell"><button type="button" aria-pressed={active} aria-label={`${GOODS[good].name} ${kind} at Stop ${index + 1}`} className={active ? "chip chip--active" : "chip"} onClick={() => setOrder(good, kind)}>{active ? "✓" : ""}</button>
          {showQty && <input className="stop-row__qty" type="number" min={1} step={1} placeholder="ile" title="Ile jednostek (puste = maksymalnie)" aria-label={`${GOODS[good].name} qty at Stop ${index + 1}`} value={order?.qty ?? ""} onChange={(e) => setQty(good, e.target.value)} />}
          {showMinMargin && <><input className="stop-row__min-margin" type="number" step={1} placeholder="próg" title="Próg marży: czekaj, aż dowóz się opłaci (puste = bez progu)" aria-label={`${GOODS[good].name} min margin at Stop ${index + 1}`} value={order?.minMargin ?? ""} onChange={(e) => setMinMargin(good, e.target.value)} />{isGateInactive(good) && <p className="stop-row__gate-warning">Brak przystanku sprzedaży tego towaru na trasie — próg marży nie zadziała.</p>}</>}
        </td>;
      })}</tr>)}</tbody></table>
    <button type="button" className="stop-row__remove" onClick={onRemove}>Remove stop</button>
  </div>;
}

function RouteEditor({ world, draft, onChange, onSave, onCancel }: { world: World; draft: Route; onChange: (next: Route) => void; onSave: () => void; onCancel: () => void }) {
  const ports = world.region.ports; const isValid = draft.stops.length >= 2 && new Set(draft.stops.map((stop) => stop.portId)).size >= 2;
  return <div className="route-editor"><input className="route-editor__name" aria-label="Route name" value={draft.name} onChange={(e) => onChange({ ...draft, name: e.target.value })} />
    {draft.stops.map((stop, index) => <StopRow key={index} stop={stop} index={index} route={draft} ports={ports} buildings={world.company.buildings} onChange={(next) => onChange({ ...draft, stops: draft.stops.map((current, i) => i === index ? next : current) })} onRemove={() => onChange({ ...draft, stops: draft.stops.filter((_, i) => i !== index) })} />)}
    <button type="button" className="menu-btn" onClick={() => onChange({ ...draft, stops: [...draft.stops, { portId: ports[0].id, orders: [] }] })}>Add stop</button>
    {!isValid && <p className="side-panel__hint">A Route needs at least 2 Stops across 2 distinct ports.</p>}
    <div className="route-editor__actions"><button type="button" className="menu-btn" disabled={!isValid} onClick={onSave}>Save route</button><button type="button" className="menu-btn" onClick={onCancel}>Cancel</button></div>
  </div>;
}

function RouteRow({ world, route, selected, onSelect, onEdit, onDelete }: { world: World; route: Route; selected: boolean; onSelect: () => void; onEdit: () => void; onDelete: () => void }) {
  const dispatch = useGameStore((state) => state.dispatch); const metrics = computeLoopMetrics(world, route);
  const assignedShips = world.company.ships.filter((ship) => ship.assignment?.routeId === route.id); const unassignedShips = world.company.ships.filter((ship) => ship.assignment?.routeId !== route.id);
  const [assignShipId, setAssignShipId] = useState<ShipId | "">("");
  return <div className={selected ? "route-row route-row--selected" : "route-row"}><button type="button" className="route-row__name" onClick={onSelect}>{route.name}</button><div className="route-row__metrics"><span>Course: {metrics.totalCourseTicks}t/loop</span><span>Docking fees/loop: {metrics.lastLoopDockingFees ?? "—"}</span><span className="route-row__result">Last loop:{" "}{metrics.lastLoopNet === null ? "no loop yet" : `${metrics.lastLoopNet >= 0 ? "+" : "−"}₸${Math.abs(metrics.lastLoopNet)}`}</span></div>
    <div className="route-row__ships">{assignedShips.map((ship) => <div key={ship.id} className="route-row__ship"><span>{ship.name}</span>{ship.assignment!.suspended && <><span className="route-row__suspended">suspended</span><button type="button" className="menu-btn" onClick={() => dispatch({ kind: "resumeRoute", shipId: ship.id })}>Resume</button></>}<button type="button" className="menu-btn" onClick={() => dispatch({ kind: "unassignRoute", shipId: ship.id })}>Unassign</button></div>)}
      {unassignedShips.length > 0 && <div className="route-row__assign"><select aria-label={`Assign a ship to ${route.name}`} value={assignShipId} onChange={(e) => setAssignShipId(e.target.value as ShipId | "")}><option value="">Assign ship…</option>{unassignedShips.map((ship) => <option key={ship.id} value={ship.id}>{ship.name}</option>)}</select><button type="button" className="menu-btn" disabled={!assignShipId} onClick={() => { if (!assignShipId) return; dispatch({ kind: "assignRoute", shipId: assignShipId, routeId: route.id }); setAssignShipId(""); }}>Assign</button></div>}</div>
    <div className="route-row__actions"><button type="button" className="menu-btn" onClick={onEdit}>Edit</button><button type="button" className="menu-btn" onClick={onDelete}>Delete</button></div></div>;
}

function nextRouteId(world: World): RouteId { let max = 0; const consider = (id: string) => { const match = /^r(\d+)$/.exec(id); if (match) max = Math.max(max, Number(match[1])); }; for (const route of world.company.routes) consider(route.id); for (const event of world.ledger) if (event.kind === "trade" && event.routeId !== undefined) consider(event.routeId); return `r${max + 1}`; }

export function RoutesTab({ world }: { world: World }) {
  const dispatch = useGameStore((state) => state.dispatch); const selectedRouteId = useGameStore((state) => state.selectedRouteId); const selectRoute = useGameStore((state) => state.selectRoute); const [draft, setDraft] = useState<Route | null>(null); const routes = world.company.routes; const editingExisting = draft ? routes.some((route) => route.id === draft.id) : false;
  const save = () => { if (!draft) return; dispatch({ kind: editingExisting ? "updateRoute" : "createRoute", route: draft }); selectRoute(draft.id); setDraft(null); };
  return <div className="headquarters-routes"><div className="route-list">{routes.length === 0 && <p className="side-panel__hint">No routes yet.</p>}{routes.map((route) => <RouteRow key={route.id} world={world} route={route} selected={route.id === selectedRouteId} onSelect={() => selectRoute(route.id === selectedRouteId ? null : route.id)} onEdit={() => { setDraft(route); selectRoute(route.id); }} onDelete={() => { dispatch({ kind: "deleteRoute", routeId: route.id }); if (selectedRouteId === route.id) selectRoute(null); }} />)}</div>{draft ? <RouteEditor world={world} draft={draft} onChange={setDraft} onSave={save} onCancel={() => setDraft(null)} /> : <button type="button" className="menu-btn" onClick={() => setDraft({ id: nextRouteId(world), name: `Route ${routes.length + 1}`, stops: [] })}>New route</button>}</div>;
}
