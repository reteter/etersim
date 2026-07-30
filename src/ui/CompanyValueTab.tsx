import { useState } from "react";
import { type LedgerEvent, type PortId, type Ship, type ShipId, type World } from "../sim";
import { GOOD_NAME_PL } from "../store/goodDisplay";
import { dailyNet } from "./ledgerDaily";
import { formatWorldDate } from "./worldDate";

/** Polish labels for `SettlementEvent.outcome` (src/sim/ledger.ts) — the sim
 *  keeps its own English enum, this is the one UI-side display mapping
 *  (same precedent as `GOOD_NAME_PL`/`GUILD_NAME_PL`). */
const OUTCOME_LABEL_PL: Record<"met" | "missed" | "breached" | "resigned", string> = {
  met: "zaliczony",
  missed: "chybiony",
  breached: "zerwany",
  resigned: "rozwiązany",
};

/** Which lens the Wartość firmy tab shows (owner directive 2026-07-30, points
 *  5.2/6): the chart and the transaction log are two readings of the same
 *  Ledger, so they share a tab and a toggle instead of two tabs. */
type Lens = "chart" | "transactions";

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

/** Human-readable, Polish description of one Ledger event (#184 UI language
 *  sweep — matches the rest of the shipped UI's language, see
 *  PriceBoardOverlay, PortPanel). */
function describeTransaction(event: TransactionEvent, world: World): string {
  switch (event.kind) {
    // #184 grammar fix (2026-07-28 owner decision): a good name is never
    // preceded by a bare number or followed by an inflected agreement —
    // `GOOD_NAME_PL` holds nominative, capitalized forms only, so the
    // sentence is restructured around `<Nazwa> ×<qty>` instead.
    case "trade":
      return `${event.side === "buy" ? "Kupiono" : "Sprzedano"}: ${GOOD_NAME_PL[event.good]} ×${event.qty} w porcie ${portName(world, event.portId)} (${shipName(world, event.shipId)})`;
    case "dockingFee":
      return `Opłata dokowa w porcie ${portName(world, event.portId)} (${shipName(world, event.shipId)})`;
    case "autoDraw":
      return `Auto-zakup: ${GOOD_NAME_PL[event.good]} ×${event.qty} w porcie ${portName(world, event.portId)}`;
    case "rush":
      return `Zakup ekspresowy: ${GOOD_NAME_PL[event.good]} ×${event.qty} w porcie ${portName(world, event.portId)}`;
    case "delivery":
      return `Dostarczono: ${GOOD_NAME_PL[event.good]} ×${event.qty} na plac budowy w porcie ${portName(world, event.portId)} (${shipName(world, event.shipId)})`;
    case "laborFee":
      return "Robocizna (złożono zlecenie budowy)";
    case "founding":
      return `Założono Siedzibę w porcie ${portName(world, event.portId)}`;
    case "launch":
      return `Zwodowano ${shipName(world, event.shipId)} w porcie ${portName(world, event.portId)}`;
    // enrollmentFee (E3, #92): minimal, mechanical exhaustiveness fix so this
    // shared UI file keeps typechecking after the LedgerEvent union extension
    // in src/sim/ledger.ts — no dedicated guild UI treatment, out of this
    // issue's scope wall; flagged in the completion report.
    case "enrollmentFee":
      return `Wstąpiono do gildii (guildId: ${event.guildId})`;
    // upkeep (E3, #95): same minimal-exhaustiveness precedent as enrollmentFee
    // above — no dedicated Kontrakty-tab-adjacent UI polish, out of this
    // issue's scope wall (sim-only task); flagged in the completion report.
    case "upkeep":
      return `Utrzymanie (${shipName(world, event.shipId)})`;
    // contractFee/settlement (E3, #94/#94-fix): same minimal-exhaustiveness
    // precedent as enrollmentFee/upkeep above — no dedicated Kontrakty-tab UI
    // treatment; out of this sim-only issue's scope wall, flagged in the
    // completion report. `settlement.outcome` now widens to "met" | "missed" |
    // "breached" | "resigned" (owner decision — termination is part of the
    // audit stream) — this generic interpolation covers all four unchanged,
    // mapped through `OUTCOME_LABEL_PL` (#184 — the sim keeps its own English
    // enum, this file's display-only translation).
    case "contractFee":
      return `Opłata kontraktowa (kontrakt ${event.contractId})`;
    case "settlement":
      return `Rozliczenie kontraktu ${event.contractId}: ${OUTCOME_LABEL_PL[event.outcome]} (${event.pointsDelta >= 0 ? "+" : ""}${event.pointsDelta} pkt)`;
    // shipyardBuilt/refitStart/refitComplete (E14, #275): minimal, mechanical
    // exhaustiveness fix (same precedent as every prior LedgerEvent-union
    // extension in this file) — no dedicated Shipyard UI treatment here
    // (out of #275's sim-only scope wall; flagged in the completion report).
    case "shipyardBuilt":
      // #286 fix: this event now fires when the Shipyard's own construction
      // site completes (activation), not at commission time.
      return `Zbudowano stocznię w porcie ${portName(world, event.portId)}`;
    case "refitStart":
      return `Rozpoczęto przebudowę ${shipName(world, event.shipId)} w porcie ${portName(world, event.portId)}`;
    case "refitComplete":
      return `Zakończono przebudowę ${shipName(world, event.shipId)}: ładownia -> ${event.hold}`;
    // store/withdraw/completed (E13, #100): minimal, mechanical exhaustiveness
    // fix (same precedent as every prior LedgerEvent-union extension in this
    // file) — no dedicated Storehouse UI treatment here (issue #101, out of
    // this sim-only scope wall; flagged in the completion report).
    case "store":
      return `Złożono: ${GOOD_NAME_PL[event.good]} ×${event.qty} w porcie ${portName(world, event.portId)} (${shipName(world, event.shipId)})`;
    case "withdraw":
      return `Pobrano: ${GOOD_NAME_PL[event.good]} ×${event.qty} w porcie ${portName(world, event.portId)} (${shipName(world, event.shipId)})`;
    case "completed":
      return `Ukończono budowę w porcie ${portName(world, event.portId)}`;
  }
}

/** Delta cell: one class rule shared by the per-event rows and the daily
 *  roll-up, so income/expense reads identically in both. */
function DeltaCell({ delta }: { delta: number | null }) {
  return (
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
  );
}

/**
 * Transaction list: every Ledger event except netWorth snapshots, newest first.
 *
 * Two shapes, one per filter state (owner directive 2026-07-30, point 7):
 * **Wszystkie statki** rolls the whole Company's day into a single balance line
 * — at 100x a day's raw event stream is unreadable, and the question the
 * all-ships view answers is "how did we do today". Picking a **ship** keeps
 * row-per-event detail unchanged, because that view's question is "what did
 * *this* ship do", and its answer is the sequence itself.
 */
function TransactionsTab({ world }: { world: World }) {
  const [filter, setFilter] = useState<ShipFilter>(ALL_SHIPS);

  const transactions = world.ledger.filter(isTransaction);
  const events = transactions.filter((e) => transactionShipId(e) === filter).reverse();
  const days = dailyNet(transactions.map((e) => ({ tick: e.tick, delta: transactionDelta(e) })));

  return (
    <div>
      <div className="ledger__filter-row">
        <label htmlFor="ledger-ship-filter">Statek</label>
        <select
          id="ledger-ship-filter"
          value={filter}
          onChange={(e) => setFilter(e.target.value as ShipFilter)}
        >
          <option value={ALL_SHIPS}>Wszystkie statki</option>
          {world.company.ships.map((ship: Ship) => (
            <option key={ship.id} value={ship.id}>
              {ship.name}
            </option>
          ))}
        </select>
      </div>
      <div className="ledger-list" role="table" aria-label="Transakcje">
        {filter === ALL_SHIPS ? (
          days.length === 0 ? (
            <p className="overlay__text">Brak transakcji.</p>
          ) : (
            days.map((entry) => (
              <div key={entry.day} className="ledger-list__row" role="row">
                <span className="ledger-list__date" role="cell">
                  Dzień {entry.day}
                </span>
                <span className="ledger-list__desc" role="cell">
                  saldo dnia
                </span>
                <DeltaCell delta={entry.net} />
              </div>
            ))
          )
        ) : events.length === 0 ? (
          <p className="overlay__text">Brak transakcji.</p>
        ) : (
          events.map((event, i) => (
            <div key={`${event.kind}-${event.tick}-${i}`} className="ledger-list__row" role="row">
              <span className="ledger-list__date" role="cell">
                {formatWorldDate(event.tick)}
              </span>
              <span className="ledger-list__desc" role="cell">
                {describeTransaction(event, world)}
              </span>
              <DeltaCell delta={transactionDelta(event)} />
            </div>
          ))
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
type NetWorthPoint = Extract<LedgerEvent, { kind: "netWorth" }>;

function netWorthPoints(world: World): readonly NetWorthPoint[] {
  return world.ledger.filter((e): e is NetWorthPoint => e.kind === "netWorth");
}

function ValueChart({ points }: { points: readonly NetWorthPoint[] }) {
  if (points.length === 0) {
    return <p className="overlay__text">Brak jeszcze migawek wartości — sprawdź po Dniu 1.</p>;
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

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Wykres wartości firmy"
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
    </div>
  );
}

/**
 * The Ledger made visible (#86), now the Headquarters' default tab rather than
 * its own overlay (owner directive 2026-07-30, points 3–6): the retired Księga
 * overlay's two tabs collapse into one surface, because the chart and the
 * transaction log are two lenses on the same fact and the tab bar was spending
 * a slot on the distinction.
 *
 * Layout, per points 5.1/5.2: the company value reads **above** the chart,
 * left-aligned, sharing its row with the lens toggle — the number is the
 * headline and the chart is its evidence, which the old
 * caption-under-the-chart order had backwards. The toggle reuses the
 * segmented-button idiom `ConstructionTab` already uses for Statek/Budynek
 * (HeadquartersPanel.tsx), so a second switch idiom never enters the UI.
 */
export function CompanyValueTab({ world }: { world: World }) {
  const [lens, setLens] = useState<Lens>("chart");
  const points = netWorthPoints(world);
  const latest = points.length > 0 ? points[points.length - 1] : null;

  return (
    <div className="company-value">
      <div className="company-value__head">
        <p className="company-value__total">
          Wartość firmy: {latest === null ? "—" : `₸${Math.round(latest.total)}`}
        </p>
        <div className="company-value__lens" role="group" aria-label="Widok wartości firmy">
          <button
            type="button"
            className={lens === "chart" ? "menu-btn menu-btn--active" : "menu-btn"}
            aria-pressed={lens === "chart"}
            onClick={() => setLens("chart")}
          >
            Wykres
          </button>
          <button
            type="button"
            className={lens === "transactions" ? "menu-btn menu-btn--active" : "menu-btn"}
            aria-pressed={lens === "transactions"}
            onClick={() => setLens("transactions")}
          >
            Transakcje
          </button>
        </div>
      </div>
      {lens === "chart" ? <ValueChart points={points} /> : <TransactionsTab world={world} />}
    </div>
  );
}
