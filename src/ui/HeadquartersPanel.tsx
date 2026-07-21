import { useState } from "react";
import {
  AUTO_DRAW_PER_DAY,
  computeBuildEstimate,
  computeGuildBuildRushQuote,
  computeRushQuote,
  CONSTRUCTION_RESERVE,
  ECONOMIC_ARCHETYPES,
  GOOD_IDS,
  GOODS,
  hasStorehousePermit,
  isLegalStorehousePlacement,
  LABOR_FEE,
  resolveReferencePort,
  storehouseFilter,
  STOREHOUSE_LABOR_FEE,
  STOREHOUSE_PERMIT_RANK,
  STOREHOUSE_RECIPE,
  type CompanyBuilding,
  type GoodId,
  type GuildId,
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
import { deriveSiteStallReason, deriveStallReason } from "../store/headquartersStall";
import { computeLoopMetrics } from "../store/routeMetrics";
import { BuildProgress } from "./BuildProgress";
import { GUILD_NAME_PL } from "./guildDisplay";
import { OverlayShell } from "./OverlayShell";
import { Tabs } from "./Tabs";

type Tab = "construction" | "routes";

const STALL_LABEL: Record<"reserve" | "goods", string> = {
  reserve: "wstrzymane: rezerwa skarbca",
  goods: "wstrzymane: brak towaru",
};

/** Ship commission — the E9 flow: an upfront estimate and a confirmation
 *  step (#122, spec §The Reserve), per-good progress, auto-draw rate, stall
 *  reason, and a rush at a live quote. Pre-#101 behavior preserved byte-for-
 *  byte: the "Zleć budowę" button stays mounted (disabled, with a reason)
 *  for the whole time a build runs, with its progress rendered alongside —
 *  never replaced by the progress view (#293's own tests pin this). The
 *  one-active-order law's OTHER two holders (a guild Building, the
 *  Shipyard's own site) block this button the same way the button's own
 *  `buildOrder` does. */
function ShipCommission({ world }: { world: World }) {
  const dispatch = useGameStore((s) => s.dispatch);
  const [confirming, setConfirming] = useState(false);
  const headquarters = world.company.headquarters!;
  const buildOrder = headquarters.buildOrder;
  const thalers = world.company.thalers;
  const shipyardUnderConstruction = Boolean(world.company.shipyard?.site);
  const guildBuildActive = Boolean(world.company.guildBuild);
  const blockedReason = buildOrder
    ? "budowa już trwa"
    : guildBuildActive
      ? "budowa budynku już trwa"
      : shipyardUnderConstruction
        ? "Trwa budowa stoczni"
        : null;
  const canPlace = !blockedReason && thalers >= LABOR_FEE + CONSTRUCTION_RESERVE;
  const stallReason = buildOrder ? deriveStallReason(world, headquarters) : null;
  const quote = buildOrder ? computeRushQuote(world) : null;
  const estimate = buildOrder ? null : computeBuildEstimate(world);

  return (
    <div className="headquarters-construction">
      {estimate && (
        <div className="build-estimate">
          <ul className="build-estimate__lines">
            {estimate.lines.map((line) => (
              <li key={line.good}>
                {GOODS[line.good].name} × {line.qty} — ₸{line.thalers}
              </li>
            ))}
            <li>Robocizna — ₸{estimate.laborFee}</li>
          </ul>
          <p className="side-panel__hint">
            Szacunkowy koszt: ₸{estimate.total} (przy dzisiejszych cenach)
          </p>
        </div>
      )}

      {confirming && estimate && !buildOrder ? (
        <div className="build-confirm">
          <p>Zlecić budowę? Szacunkowy koszt: ₸{estimate.total} (przy dzisiejszych cenach).</p>
          {estimate.total > thalers - CONSTRUCTION_RESERVE && (
            <p className="headquarters-stall">
              Masz ₸{thalers} — budowa stanie na rezerwie ₸{CONSTRUCTION_RESERVE}, dopóki nie
              dowieziesz materiałów albo nie zarobisz więcej.
            </p>
          )}
          <div className="build-confirm__actions">
            <button
              type="button"
              className="menu-btn"
              onClick={() => {
                dispatch({ kind: "placeBuildOrder" });
                setConfirming(false);
              }}
            >
              Potwierdź — ₸{LABOR_FEE}
            </button>
            <button type="button" className="menu-btn" onClick={() => setConfirming(false)}>
              Anuluj
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="menu-btn"
          disabled={!canPlace}
          title={
            blockedReason ??
            (canPlace
              ? undefined
              : `wymaga ₸${LABOR_FEE + CONSTRUCTION_RESERVE} — robocizna ₸${LABOR_FEE} + rezerwa ₸${CONSTRUCTION_RESERVE}`)
          }
          onClick={() => setConfirming(true)}
        >
          Zleć budowę — ₸{LABOR_FEE}
        </button>
      )}

      {buildOrder && (
        <>
          <BuildProgress siteStore={buildOrder.siteStore} />
          <p className="side-panel__hint">
            Auto-draw: up to {AUTO_DRAW_PER_DAY} units/good/day from the Headquarters market.
          </p>
          {stallReason && <p className="headquarters-stall">{STALL_LABEL[stallReason]}</p>}
          <button
            type="button"
            className="menu-btn"
            disabled={!quote || quote.total <= 0}
            onClick={() => dispatch({ kind: "rushBuild" })}
          >
            Dokup resztę — ₸{quote?.total ?? 0}
          </button>
        </>
      )}
    </div>
  );
}

/** Building commission (E13, #101): the Budynek half of the Budowa tab's
 *  commission choice (spec §UX skeleton — "ship (as in E9) or a permitted
 *  building + target port"; "the same progress/stall/rush UI serves both").
 *  Mirrors `ShipCommission`'s own shape exactly: the commission form (variant
 *  + port pickers, confirm step) stays mounted — disabled with a reason —
 *  for the whole time a guild Building is under construction, with its
 *  progress rendered alongside. Variant choice is gated on
 *  `hasStorehousePermit` per variant (E13 ships only the Granary/agrarian,
 *  but the permit is generic over `GuildId` — no dead branches for the other
 *  four); the port dropdown is limited to `isLegalStorehousePlacement` for
 *  the chosen variant. The stall reason reads the plain site (no
 *  `precedingSites` fold-in): a guildBuild is mutually exclusive with the
 *  HQ/Shipyard builds by the one-active-order law, so its only possible
 *  preceding draw is a concurrently active Refit — an edge case out of this
 *  task's scope (flagged in the completion report). */
function BuildingCommission({ world }: { world: World }) {
  const dispatch = useGameStore((s) => s.dispatch);
  const [confirming, setConfirming] = useState(false);
  const thalers = world.company.thalers;
  const guildBuild = world.company.guildBuild;
  const headquarters = world.company.headquarters!;
  const shipyardUnderConstruction = Boolean(world.company.shipyard?.site);

  const permittedVariants = ECONOMIC_ARCHETYPES.filter((v) => hasStorehousePermit(world, v));
  const [variant, setVariant] = useState<GuildId | "">(permittedVariants[0] ?? "");
  const activeVariant = permittedVariants.includes(variant as GuildId) ? (variant as GuildId) : "";

  const legalPorts = activeVariant
    ? world.region.ports.filter((p) => isLegalStorehousePlacement(world, activeVariant, p.id))
    : [];
  const [portId, setPortId] = useState<PortId | "">("");
  const activePortId = legalPorts.some((p) => p.id === portId) ? portId : "";

  const noPermitReason =
    permittedVariants.length === 0
      ? `wymaga rangi ${STOREHOUSE_PERMIT_RANK} w co najmniej jednej gildii`
      : null;
  const blockedReason = guildBuild
    ? "budowa już trwa"
    : headquarters.buildOrder
      ? "budowa statku już trwa"
      : shipyardUnderConstruction
        ? "Trwa budowa stoczni"
        : null;
  const canAfford = thalers >= STOREHOUSE_LABOR_FEE + CONSTRUCTION_RESERVE;
  const reason =
    blockedReason ??
    noPermitReason ??
    (!activeVariant
      ? "wybierz gildię"
      : !activePortId
        ? "wybierz port"
        : !canAfford
          ? `wymaga ₸${STOREHOUSE_LABOR_FEE + CONSTRUCTION_RESERVE} — robocizna ₸${STOREHOUSE_LABOR_FEE} + rezerwa ₸${CONSTRUCTION_RESERVE}`
          : null);
  const canPlace = reason === null;

  const site = guildBuild
    ? { recipe: STOREHOUSE_RECIPE, siteStore: guildBuild.siteStore, portId: guildBuild.portId }
    : null;
  const stallReason = site ? deriveSiteStallReason(world, site) : null;
  const quote = guildBuild ? computeGuildBuildRushQuote(world) : null;
  const guildBuildPort = guildBuild ? world.region.ports.find((p) => p.id === guildBuild.portId) : null;

  if (permittedVariants.length === 0 && !guildBuild) {
    return (
      <div className="headquarters-construction">
        <p className="side-panel__hint">
          Brak uprawnień do budowy — osiągnij rangę 2 w gildii, by odblokować Skład.
        </p>
      </div>
    );
  }

  return (
    <div className="headquarters-construction">
      {!guildBuild && (
        <>
          <label className="building-commission__field">
            Gildia
            <select
              aria-label="Gildia budynku"
              value={activeVariant}
              onChange={(e) => {
                setVariant(e.target.value as GuildId);
                setPortId("");
              }}
            >
              {permittedVariants.map((v) => (
                <option key={v} value={v}>
                  {GUILD_NAME_PL[v]}
                </option>
              ))}
            </select>
          </label>
          <label className="building-commission__field">
            Port
            <select
              aria-label="Port budynku"
              value={activePortId}
              onChange={(e) => setPortId(e.target.value as PortId)}
              disabled={!activeVariant}
            >
              <option value="">Wybierz port…</option>
              {legalPorts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        </>
      )}

      {confirming && activeVariant && activePortId && !guildBuild ? (
        <div className="build-confirm">
          <p>
            Zlecić budowę Składu ({GUILD_NAME_PL[activeVariant]})? Koszt robocizny: ₸
            {STOREHOUSE_LABOR_FEE}.
          </p>
          <div className="build-confirm__actions">
            <button
              type="button"
              className="menu-btn"
              onClick={() => {
                dispatch({
                  kind: "commissionGuildBuilding",
                  type: "storehouse",
                  variant: activeVariant,
                  portId: activePortId,
                });
                setConfirming(false);
              }}
            >
              Potwierdź — ₸{STOREHOUSE_LABOR_FEE}
            </button>
            <button type="button" className="menu-btn" onClick={() => setConfirming(false)}>
              Anuluj
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="menu-btn"
          disabled={!canPlace}
          title={reason ?? undefined}
          onClick={() => setConfirming(true)}
        >
          Zleć budowę — ₸{STOREHOUSE_LABOR_FEE}
        </button>
      )}

      {guildBuild && (
        <>
          <p className="side-panel__hint">
            Budowa: Skład ({GUILD_NAME_PL[guildBuild.variant]}) w {guildBuildPort?.name ?? guildBuild.portId}
          </p>
          <BuildProgress siteStore={guildBuild.siteStore} recipe={STOREHOUSE_RECIPE} />
          <p className="side-panel__hint">
            Auto-draw: up to {AUTO_DRAW_PER_DAY} units/good/day from the building's own port.
          </p>
          {stallReason && <p className="headquarters-stall">{STALL_LABEL[stallReason]}</p>}
          <button
            type="button"
            className="menu-btn"
            disabled={!quote || quote.total <= 0}
            onClick={() => dispatch({ kind: "rushGuildBuild" })}
          >
            Dokup resztę — ₸{quote?.total ?? 0}
          </button>
        </>
      )}
    </div>
  );
}

type CommissionTarget = "ship" | "building";

/** The "Budowa" tab (docs/specs/E13 — UX skeleton): a commission choice —
 *  ship (E9's own HQ hull construction) or a permitted guild Building —
 *  where each side owns its full lifecycle (commission form -> progress),
 *  the one-active-order law blocking whichever side ISN'T running (spec:
 *  "one Build Order model, one UI"). The toggle stays visible throughout —
 *  switching tabs never loses either side's own in-progress state, since
 *  each holds its own World-derived data, not local-only state. */
function ConstructionTab({ world }: { world: World }) {
  const [target, setTarget] = useState<CommissionTarget>("ship");

  return (
    <div className="headquarters-construction-tab">
      <div className="commission-choice" aria-label="Wybór celu budowy">
        <button
          type="button"
          className={target === "ship" ? "menu-btn menu-btn--active" : "menu-btn"}
          aria-pressed={target === "ship"}
          onClick={() => setTarget("ship")}
        >
          Statek
        </button>
        <button
          type="button"
          className={target === "building" ? "menu-btn menu-btn--active" : "menu-btn"}
          aria-pressed={target === "building"}
          onClick={() => setTarget("building")}
        >
          Budynek
        </button>
      </div>
      {target === "ship" ? <ShipCommission world={world} /> : <BuildingCommission world={world} />}
    </div>
  );
}

/** Column headers for the per-good order table (Polish, 2026-07-14 UI grill:
 *  new visible labels ship Polish). The chip buttons underneath keep their
 *  existing English aria-label/accessible-name — only the *visible* button
 *  text moves to a checkmark now that the column header already names the
 *  action, so e2e's aria-label-based selectors stay untouched (#184 is the
 *  broader English→Polish sweep, out of scope here). */
const ORDER_KINDS = ["buy", "sell", "deliver"] as const;
const ORDER_KIND_LABEL: Record<(typeof ORDER_KINDS)[number], string> = {
  buy: "Kup",
  sell: "Sprzedaj",
  deliver: "Dostarcz",
};

/** Storehouse order kinds (E13, #101): store/withdraw chips, appended only
 *  for a Stop whose port hosts a Company `CompanyBuilding` (spec §UX
 *  skeleton — "shown only for ports with a Company storehouse"). Net-new
 *  Polish player-facing strings (2026-07-14 UI grill) — no English precedent
 *  to match, unlike buy/sell/deliver's #184-tracked legacy labels. */
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
  const building = buildings.find((b) => b.portId === stop.portId);
  const storehouseGoods = building ? new Set(storehouseFilter(building.variant)) : null;
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
   *  reject outright. */
  const setQty = (good: GoodId, raw: string) => {
    const trimmed = raw.trim();
    if (trimmed === "") {
      patchOrder(good, { qty: undefined });
      return;
    }
    const n = Number(trimmed);
    if (!Number.isInteger(n) || n <= 0) return;
    patchOrder(good, { qty: n });
  };
  /** Margin Gate threshold: blank ⇒ no gate (`minMargin` absent);
   *  `isValidRoute` places no sign/integer constraint on `minMargin` itself
   *  (only that it's buy-only), so any finite number is accepted. */
  const setMinMargin = (good: GoodId, raw: string) => {
    const trimmed = raw.trim();
    if (trimmed === "") {
      patchOrder(good, { minMargin: undefined });
      return;
    }
    const n = Number(trimmed);
    if (!Number.isFinite(n)) return;
    patchOrder(good, { minMargin: n });
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
        aria-label={`Stop ${index + 1} port`}
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
                {GOODS[good].name}
              </th>
              {kinds.map((kind) => {
                // A store/withdraw column only offers a chip for goods in
                // the Building's own goods filter (`storehouseGoods`) — a
                // good outside it (e.g. textiles at a Granary) would only
                // ever no-op against the Building's StorePolicy, so no chip
                // renders for it at all rather than a dead control.
                const isStoreKind = kind === "store" || kind === "withdraw";
                if (isStoreKind && storehouseGoods && !storehouseGoods.has(good)) {
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
                      aria-label={`${GOODS[good].name} ${kind} at Stop ${index + 1}`}
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
                        aria-label={`${GOODS[good].name} qty at Stop ${index + 1}`}
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
                          aria-label={`${GOODS[good].name} min margin at Stop ${index + 1}`}
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
        Remove stop
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
        aria-label="Route name"
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
        Add stop
      </button>
      {!isValid && (
        <p className="side-panel__hint">A Route needs at least 2 Stops across 2 distinct ports.</p>
      )}
      <div className="route-editor__actions">
        <button type="button" className="menu-btn" disabled={!isValid} onClick={onSave}>
          Save route
        </button>
        <button type="button" className="menu-btn" onClick={onCancel}>
          Cancel
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
        <span>Course: {metrics.totalCourseTicks}t/loop</span>
        <span>Docking fees/loop: {metrics.lastLoopDockingFees ?? "—"}</span>
        <span className="route-row__result">
          Last loop:{" "}
          {metrics.lastLoopNet === null
            ? "no loop yet"
            : `${metrics.lastLoopNet >= 0 ? "+" : "−"}₸${Math.abs(metrics.lastLoopNet)}`}
        </span>
      </div>
      <div className="route-row__ships">
        {assignedShips.map((ship) => (
          <div key={ship.id} className="route-row__ship">
            <span>{ship.name}</span>
            {ship.assignment!.suspended && (
              <>
                <span className="route-row__suspended">suspended</span>
                <button
                  type="button"
                  className="menu-btn"
                  onClick={() => dispatch({ kind: "resumeRoute", shipId: ship.id })}
                >
                  Resume
                </button>
              </>
            )}
            <button
              type="button"
              className="menu-btn"
              onClick={() => dispatch({ kind: "unassignRoute", shipId: ship.id })}
            >
              Unassign
            </button>
          </div>
        ))}
        {unassignedShips.length > 0 && (
          <div className="route-row__assign">
            <select
              aria-label={`Assign a ship to ${route.name}`}
              value={assignShipId}
              onChange={(e) => setAssignShipId(e.target.value as ShipId | "")}
            >
              <option value="">Assign ship…</option>
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
              Assign
            </button>
          </div>
        )}
      </div>
      <div className="route-row__actions">
        <button type="button" className="menu-btn" onClick={onEdit}>
          Edit
        </button>
        <button type="button" className="menu-btn" onClick={onDelete}>
          Delete
        </button>
      </div>
    </div>
  );
}

/** Next Route id: "r" + one past the highest numeric id used so far — by a
 *  live Route or by any routeId-tagged trade in the Ledger, so a deleted
 *  Route's id is never recycled into a new Route (its old Ledger tags would
 *  pollute the new Route's loop metrics). Deterministic, derived from World
 *  state only — the ship-name precedent (keyed by count, no wall clock, no
 *  RNG draw) applied to ids. */
function nextRouteId(world: World): RouteId {
  let max = 0;
  const consider = (id: string) => {
    const m = /^r(\d+)$/.exec(id);
    if (m) max = Math.max(max, Number(m[1]));
  };
  for (const route of world.company.routes) consider(route.id);
  for (const event of world.ledger) {
    if (event.kind === "trade" && event.routeId !== undefined) consider(event.routeId);
  }
  return `r${max + 1}`;
}

/** The "Trasy" tab (docs/specs/E9 — UX skeleton): the Company's Route
 *  templates — create/edit via a list-based Stop editor, assign/unassign
 *  ships, and each Route's loop metrics (route-rot legible at a glance). */
function RoutesTab({ world }: { world: World }) {
  const dispatch = useGameStore((s) => s.dispatch);
  const selectedRouteId = useGameStore((s) => s.selectedRouteId);
  const selectRoute = useGameStore((s) => s.selectRoute);
  const [draft, setDraft] = useState<Route | null>(null);

  const routes = world.company.routes;
  const editingExisting = draft ? routes.some((r) => r.id === draft.id) : false;

  const startNew = () => {
    setDraft({ id: nextRouteId(world), name: `Route ${routes.length + 1}`, stops: [] });
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
        {routes.length === 0 && <p className="side-panel__hint">No routes yet.</p>}
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
          New route
        </button>
      )}
    </div>
  );
}

/**
 * Headquarters view (docs/specs/E9 — UX skeleton): one panel, two tabs
 * (Budowa/Trasy). Reached from the TopBar shortcut (once founded) or the
 * HQ port's PortPanel section.
 */
export function HeadquartersPanel({ onClose }: { onClose: () => void }) {
  const world = useGameStore((s) => s.world);
  const [tab, setTab] = useState<Tab>("construction");

  if (!world || !world.company.headquarters) return null;

  return (
    <OverlayShell
      ariaLabel="Headquarters"
      title="Headquarters"
      onClose={onClose}
      wide
      tabs={
        <Tabs
          active={tab}
          onChange={setTab}
          tabs={[
            { id: "construction", label: "Budowa" },
            { id: "routes", label: "Trasy" },
          ]}
        />
      }
    >
      {tab === "construction" ? <ConstructionTab world={world} /> : <RoutesTab world={world} />}
    </OverlayShell>
  );
}
