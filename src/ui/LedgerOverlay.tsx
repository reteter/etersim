import { useState } from "react";
import { GOODS, type LedgerEvent, type PortId, type Ship, type ShipId, type World } from "../sim";
import { useGameStore } from "../store/gameStore";
import { OverlayShell } from "./OverlayShell";
import { Tabs } from "./Tabs";
import { formatWorldDate } from "./worldDate";

type Tab = "transactions" | "value";

/** Sentinel for the ship filter's "show every ship" option — never a real
 *  ShipId (those come from `ship.ts`'s generator, e.g. "s0", "s1", ...). */
const ALL_SHIPS = "all" as const;
type ShipFilter = ShipId | typeof ALL_SHIPS;

/** The one Ledger event kind that isn't a transaction — a daily net-worth
 *  snapshot, consumed by the Wartość firmy chart instead. */
type TransactionEvent = Exclude<LedgerEvent, { kind: "netWorth" }>;

function isTransaction(event: LedgerEvent): event is TransactionEvent {
  return event.kind !== "netWorth";
}

/** The ship a transaction is attributable to, or null for company-wide
 *  events (auto-draw, rush, labor fee, founding) that belong to no single
 *  ship. `dockingFee` carries `shipId` but no `routeId` (Tech union,
 *  docs/specs/E9-fleet-and-routes.md) — per-ship filtering here needs
 *  nothing more; per-Route attribution is the Route panel's job (#84/#85),
 *  not this overlay's (spec — "one fact, one home"). */
function transactionShipId(event: TransactionEvent): ShipId | null {
  switch (event.kind) {
    case "trade":
    case "dockingFee":
    case "delivery":
    case "launch":
    case "upkeep":
    // refitStart/refitComplete (E14, #275): minimal, mechanical exhaustiveness
    // fix (same precedent as every prior LedgerEvent-union extension in this
    // file) — both carry a shipId, no dedicated Shipyard UI treatment here
    // (out of #275's sim-only scope wall; flagged in the completion report).
    case "refitStart":
    case "refitComplete":
    // store/withdraw (E13, #100): both carry a shipId, no dedicated
    // Storehouse UI treatment here (issue #101, out of this scope wall;
    // minimal exhaustiveness fix, same precedent as refitStart/refitComplete
    // above).
    case "store":
    case "withdraw":
      return event.shipId;
    // shipyardBuilt/contractFee/settlement/completed: company-wide events,
    // no single ship — same precedent as enrollmentFee below (minimal
    // exhaustiveness fix, no dedicated Kontrakty-tab/Shipyard/Storehouse UI
    // treatment; out of this sim-only issue's scope wall, flagged in the
    // completion report).
    default:
      return null;
  }
}

/** Thaler delta for the transaction row's color (income/expense), or null
 *  for goods-only movements (delivery) and events with no purse effect
 *  (launch). All stored `thalers` fields are non-negative magnitudes
 *  (commands.ts, building.ts) — sign is derived from the event's meaning. */
function transactionDelta(event: TransactionEvent): number | null {
  switch (event.kind) {
    case "trade":
      return event.side === "sell" ? event.thalers : -event.thalers;
    case "dockingFee":
    case "autoDraw":
    case "rush":
    case "laborFee":
    case "founding":
    case "upkeep":
      return -event.thalers;
    case "contractFee":
      return event.thalers;
    // refitStart (E14, #275): a flat cost paid up front — the Shipyard
    // analog of laborFee above. Minimal exhaustiveness fix, no dedicated
    // Shipyard UI treatment (out of #275's sim-only scope wall; flagged in
    // the completion report).
    case "refitStart":
      return -event.thalers;
    case "delivery":
    case "launch":
    // enrollmentFee (E3, #92): the event carries no thalers field per the
    // acceptance criteria — a fuller UI treatment (delta, description) is
    // out of this issue's scope wall (no UI/store changes); flagged in the
    // completion report.
    case "enrollmentFee":
    // settlement (E3, #94): the audit record has no thalers field (points,
    // not purse movement) — same minimal-exhaustiveness precedent.
    case "settlement":
    // refitComplete (E14, #275): moves no thalers (materials already logged
    // by their own autoDraw/delivery/rush events) — same precedent.
    // shipyardBuilt (E14, #286 fix): now fires at activation, not
    // commission — the labor fee is logged separately by `laborFee` at
    // `commissionShipyard`, so this event moves no thalers either (same
    // precedent as refitComplete/launch).
    case "refitComplete":
    case "shipyardBuilt":
    // store/withdraw/completed (E13, #100): goods-only movements / a
    // building activation — no thalers field, same precedent as
    // delivery/launch above (minimal exhaustiveness fix; issue #101's UI
    // treatment is out of this scope wall).
    case "store":
    case "withdraw":
    case "completed":
      return null;
  }
}

function portName(world: World, portId: PortId): string {
  return world.region.ports.find((p) => p.id === portId)?.name ?? portId;
}

function shipName(world: World, shipId: ShipId): string {
  return world.company.ships.find((s) => s.id === shipId)?.name ?? shipId;
}

/** Human-readable, English description of one Ledger event (matches the
 *  rest of the shipped UI's language — see PriceBoardOverlay, PortPanel). */
function describeTransaction(event: TransactionEvent, world: World): string {
  switch (event.kind) {
    case "trade":
      return `${event.side === "buy" ? "Bought" : "Sold"} ${event.qty} ${GOODS[event.good].name} at ${portName(world, event.portId)} (${shipName(world, event.shipId)})`;
    case "dockingFee":
      return `Docking fee at ${portName(world, event.portId)} (${shipName(world, event.shipId)})`;
    case "autoDraw":
      return `Auto-draw: ${event.qty} ${GOODS[event.good].name} at ${portName(world, event.portId)}`;
    case "rush":
      return `Rush buy: ${event.qty} ${GOODS[event.good].name} at ${portName(world, event.portId)}`;
    case "delivery":
      return `Delivered ${event.qty} ${GOODS[event.good].name} to the build site at ${portName(world, event.portId)} (${shipName(world, event.shipId)})`;
    case "laborFee":
      return "Labor fee (build order placed)";
    case "founding":
      return `Founded Headquarters at ${portName(world, event.portId)}`;
    case "launch":
      return `Launched ${shipName(world, event.shipId)} at ${portName(world, event.portId)}`;
    // enrollmentFee (E3, #92): minimal, mechanical exhaustiveness fix so this
    // shared UI file keeps typechecking after the LedgerEvent union extension
    // in src/sim/ledger.ts — no dedicated guild UI treatment, out of this
    // issue's scope wall; flagged in the completion report.
    case "enrollmentFee":
      return `Enrolled in a guild (guildId: ${event.guildId})`;
    // upkeep (E3, #95): same minimal-exhaustiveness precedent as enrollmentFee
    // above — no dedicated Kontrakty-tab-adjacent UI polish, out of this
    // issue's scope wall (sim-only task); flagged in the completion report.
    case "upkeep":
      return `Upkeep fee (${shipName(world, event.shipId)})`;
    // contractFee/settlement (E3, #94/#94-fix): same minimal-exhaustiveness
    // precedent as enrollmentFee/upkeep above — no dedicated Kontrakty-tab UI
    // treatment; out of this sim-only issue's scope wall, flagged in the
    // completion report. `settlement.outcome` now widens to "met" | "missed" |
    // "breached" | "resigned" (owner decision — termination is part of the
    // audit stream) — this generic interpolation covers all four unchanged.
    case "contractFee":
      return `Contract fee (contract ${event.contractId})`;
    case "settlement":
      return `Contract ${event.contractId} settlement: ${event.outcome} (${event.pointsDelta >= 0 ? "+" : ""}${event.pointsDelta} pts)`;
    // shipyardBuilt/refitStart/refitComplete (E14, #275): minimal, mechanical
    // exhaustiveness fix (same precedent as every prior LedgerEvent-union
    // extension in this file) — no dedicated Shipyard UI treatment here
    // (out of #275's sim-only scope wall; flagged in the completion report).
    case "shipyardBuilt":
      // #286 fix: this event now fires when the Shipyard's own construction
      // site completes (activation), not at commission time.
      return `Shipyard built at ${portName(world, event.portId)}`;
    case "refitStart":
      return `Refit started for ${shipName(world, event.shipId)} at ${portName(world, event.portId)}`;
    case "refitComplete":
      return `Refit completed for ${shipName(world, event.shipId)}: Hold -> ${event.hold}`;
    // store/withdraw/completed (E13, #100): minimal, mechanical exhaustiveness
    // fix (same precedent as every prior LedgerEvent-union extension in this
    // file) — no dedicated Storehouse UI treatment here (issue #101, out of
    // this sim-only scope wall; flagged in the completion report).
    case "store":
      return `Stored ${event.qty} ${GOODS[event.good].name} at ${portName(world, event.portId)} (${shipName(world, event.shipId)})`;
    case "withdraw":
      return `Withdrew ${event.qty} ${GOODS[event.good].name} at ${portName(world, event.portId)} (${shipName(world, event.shipId)})`;
    case "completed":
      return `Building completed at ${portName(world, event.portId)}`;
  }
}

/** Transaction list: every Ledger event except netWorth snapshots, newest
 *  first, optionally filtered to one ship's events (company-wide events
 *  disappear under a specific-ship filter — they belong to no ship). */
function TransactionsTab({ world }: { world: World }) {
  const [filter, setFilter] = useState<ShipFilter>(ALL_SHIPS);

  const events = world.ledger
    .filter(isTransaction)
    .filter((e) => filter === ALL_SHIPS || transactionShipId(e) === filter)
    .reverse();

  return (
    <div>
      <div className="ledger__filter-row">
        <label htmlFor="ledger-ship-filter">Ship</label>
        <select
          id="ledger-ship-filter"
          value={filter}
          onChange={(e) => setFilter(e.target.value as ShipFilter)}
        >
          <option value={ALL_SHIPS}>All ships</option>
          {world.company.ships.map((ship: Ship) => (
            <option key={ship.id} value={ship.id}>
              {ship.name}
            </option>
          ))}
        </select>
      </div>
      <div className="ledger-list" role="table" aria-label="Transactions">
        {events.length === 0 ? (
          <p className="overlay__text">No transactions yet.</p>
        ) : (
          events.map((event, i) => {
            const delta = transactionDelta(event);
            return (
              <div key={`${event.kind}-${event.tick}-${i}`} className="ledger-list__row" role="row">
                <span className="ledger-list__date" role="cell">
                  {formatWorldDate(event.tick)}
                </span>
                <span className="ledger-list__desc" role="cell">
                  {describeTransaction(event, world)}
                </span>
                <span
                  role="cell"
                  className={
                    delta === null
                      ? "ledger-list__delta"
                      : delta >= 0
                        ? "ledger-list__delta ledger-list__delta--income"
                        : "ledger-list__delta ledger-list__delta--expense"
                  }
                >
                  {delta === null ? "—" : `${delta >= 0 ? "+" : "−"}₸${Math.abs(Math.round(delta))}`}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

/** Company-value chart (Wartość firmy): an SVG polyline over daily netWorth
 *  snapshots (docs/specs/E9-fleet-and-routes.md — Ledger and the performance
 *  board). No chart library (ADR-0004, bundle stays lean). Ships and
 *  buildings carry no book value in `computeNetWorth`, so a Headquarters
 *  founding (thalers spent, nothing added) and a ship launch (siteStore
 *  drained into a ship worth 0 on this chart) both read as a dip, then
 *  steeper growth once the new ship earns — the "honest investment story"
 *  the spec calls for, with no extra chart-side logic needed. */
function ValueTab({ world }: { world: World }) {
  const points = world.ledger.filter(
    (e): e is Extract<LedgerEvent, { kind: "netWorth" }> => e.kind === "netWorth",
  );

  if (points.length === 0) {
    return <p className="overlay__text">No net-worth snapshots yet — check back after Day 1.</p>;
  }

  const width = 640;
  const height = 220;
  const padX = 44;
  const padY = 20;
  const totals = points.map((p) => p.total);
  const minV = Math.min(...totals);
  const maxV = Math.max(...totals);
  const span = maxV - minV || 1;

  const xFor = (i: number) =>
    points.length === 1 ? width / 2 : padX + (i / (points.length - 1)) * (width - padX * 2);
  const yFor = (v: number) => padY + (1 - (v - minV) / span) * (height - padY * 2);

  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${xFor(i)},${yFor(p.total)}`).join(" ");
  const latest = points[points.length - 1];

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Company value chart"
        className="ledger-chart"
      >
        <line
          x1={padX}
          y1={height - padY}
          x2={width - padX}
          y2={height - padY}
          className="ledger-chart__axis"
        />
        <path d={path} className="ledger-chart__line" fill="none" />
        {points.map((p, i) => (
          <circle
            key={p.tick}
            cx={xFor(i)}
            cy={yFor(p.total)}
            r={3}
            className="ledger-chart__point"
          >
            <title>{`${formatWorldDate(p.tick)}: ₸${Math.round(p.total)}`}</title>
          </circle>
        ))}
      </svg>
      <p className="overlay__text">Company value: ₸{Math.round(latest.total)}</p>
    </div>
  );
}

/**
 * Performance board overlay (#86, PriceBoardOverlay pattern): the Ledger
 * made visible. Two tabs — Transakcje (transaction list, ship filter) and
 * Wartość firmy (company-value chart). Opened from a persistent TopBar
 * button. Per-Route last-loop results live in the Route panel instead (one
 * fact, one home — docs/specs/E9-fleet-and-routes.md — UX skeleton).
 */
export function LedgerOverlay({ onClose }: { onClose: () => void }) {
  const world = useGameStore((s) => s.world);
  const [tab, setTab] = useState<Tab>("transactions");

  if (!world) return null;

  return (
    <OverlayShell
      ariaLabel="Ledger"
      title="Ledger"
      onClose={onClose}
      wide
      tabs={
        <Tabs
          ariaLabel="Ledger tabs"
          active={tab}
          onChange={setTab}
          tabs={[
            { id: "transactions", label: "Transakcje" },
            { id: "value", label: "Wartość firmy" },
          ]}
        />
      }
    >
      {tab === "transactions" ? <TransactionsTab world={world} /> : <ValueTab world={world} />}
    </OverlayShell>
  );
}
