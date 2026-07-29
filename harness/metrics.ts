import {
  ECONOMIC_ARCHETYPES,
  GOOD_IDS,
  rankOf,
  TICKS_PER_DAY,
  type Company,
  type EconomicArchetype,
  type GoodId,
  type LedgerEvent,
  type NetWorthBreakdown,
  type ShipId,
} from "../src/sim/index.ts";
import { COST_KINDS, MILESTONE_KINDS, REVENUE_KINDS, THALER_MOVEMENT_KINDS, type LedgerKind, type MilestoneKind } from "./ledgerKinds.ts";

/**
 * Per-Run metrics, derived purely from a Run's Ledger and a set of daily
 * fleet snapshots (docs/specs/E11-proving-grounds.md §Evaluation model, the
 * 2026-07-15 re-review). Every function here is a pure fold over data the
 * caller already has — no `World` reads, so these are testable against small
 * synthetic fixtures without spinning up a Run (advisor consult, this wave).
 *
 * "Report writers derive; the emitter stays the sim's" (spec §Ledger
 * schema): nothing here mutates or reinterprets a `LedgerEvent`'s fields —
 * only groups, sums and signs them.
 *
 * **A field named `thalers` is a positive magnitude, not a signed delta** —
 * `src/sim`'s own emitters (`commands.ts`, `tick.ts`, `building.ts`,
 * `contract.ts`) always write `Math.abs(...)` or a positive constant. The
 * *direction* is implied by `kind` (and, for `trade`, by `side`): every
 * thaler-carrying kind is a debit against the Company's purse **except**
 * `trade` on the `sell` side and `contractFee` (paid to the Company on a met
 * settlement, `contract.ts`'s `settleOne`) — `signedThalers` below is the
 * one place that encodes this, so every metric that needs a signed total
 * reads it from here rather than re-deriving it.
 */

/** One day boundary's fleet state — a Run's own sampling of `World`, taken by
 *  the harness's day-chunked runner (`harness/batch.ts`) since hold
 *  utilization and active-contract load are not part of the Ledger stream.
 *  Sampled once per day boundary, so this is a sample, not a continuous
 *  average — stated wherever it is reported. */
export interface DaySnapshot {
  readonly day: number;
  readonly tick: number;
  readonly ships: readonly { readonly shipId: ShipId; readonly hold: number; readonly used: number }[];
  readonly activeContracts: number;
}

export interface CostLine {
  readonly kind: LedgerKind;
  /** Signed total across the Run — negative for money spent. Every kind in
   *  `COST_KINDS` is a debit (`signedThalers` below), so this is always
   *  <= 0 by construction, not by assumption. */
  readonly thalers: number;
  readonly count: number;
}

export interface GoodPnL {
  readonly good: GoodId;
  readonly boughtQty: number;
  readonly soldQty: number;
  /** Net trade thalers for this good: sell revenue minus buy cost — the
   *  good's own contribution to profit/day, not including fleet-wide costs
   *  (docking, upkeep, etc). */
  readonly netThalers: number;
}

export interface ShipHoldUtilization {
  readonly shipId: ShipId;
  /** Mean of `used / hold` across every daily sample this ship appeared in,
   *  0 when it never appeared (never launched within the Run). */
  readonly meanUtilization: number;
  readonly samples: number;
}

export interface NetWorthPoint {
  readonly day: number;
  readonly tick: number;
  readonly thalers: number;
  readonly cargoValue: number;
  readonly siteStoreValue: number;
  readonly buildingStoreValue: number;
  readonly total: number;
}

export interface GuildStanding {
  readonly guildId: EconomicArchetype;
  readonly finalPoints: number;
  readonly finalRank: number;
  readonly trajectory: readonly { readonly tick: number; readonly points: number }[];
}

export interface SettlementCounts {
  readonly met: number;
  readonly missed: number;
  readonly breached: number;
  readonly resigned: number;
}

export interface ChurnStats {
  /** Count of consecutive-buy good changes, across the fleet, in tick order
   *  (a "switch" — spec §Evaluation model: "count of carried-good
   *  switches"). A ship's first buy of the Run is not a switch (nothing
   *  preceded it). */
  readonly switches: number;
  /** Run-length of consecutive same-good buys, fleet-wide, in tick order
   *  (spec: "distribution of consecutive same-good hauls" — a pendulum
   *  policy produces many short runs, an opportunist a few long ones). */
  readonly runLengths: readonly number[];
}

/**
 * One milestone kind's world-days timing (#446, `docs/specs/E11-proving-grounds.md`
 * §Evaluation model): "world-days" means *simulated* days inside the Run
 * (`event.tick / TICKS_PER_DAY`) — **never wall-clock hours**. The PRD's
 * playtime anchor (`docs/PRD.md` §Where 1.0 ends, ~8–12 hours) is wall-clock;
 * converting between the two needs a player-time model this metric does not
 * build (#448). A milestone the Run never reached is its own row
 * (`reached: false`), not an omission — an unreached milestone is a result.
 */
export interface MilestoneTiming {
  readonly kind: MilestoneKind;
  readonly reached: boolean;
  /** `event.tick` of the *first* Ledger event of this kind, or `null` if
   *  unreached within the Run's day horizon. A milestone kind that can repeat
   *  (e.g. `completed`, once per Storehouse) is timed at its first
   *  occurrence — "world-days to milestone" reads as "world-days until this
   *  kind of progress first happened", not every occurrence. */
  readonly tick: number | null;
  readonly worldDays: number | null;
}

/** Per-Run milestone timing, one row per `MILESTONE_KINDS` entry in that
 *  array's canonical order (determinism, §Laws 1 — never `Object.keys`
 *  order). A pure fold over the Ledger; the Run's day horizon is implicit in
 *  which milestones the Ledger does or does not contain. */
export function computeMilestoneTimings(ledger: readonly LedgerEvent[]): readonly MilestoneTiming[] {
  return MILESTONE_KINDS.map((kind) => {
    const event = ledger.find((e) => e.kind === kind);
    if (!event) return { kind, reached: false, tick: null, worldDays: null };
    return { kind, reached: true, tick: event.tick, worldDays: event.tick / TICKS_PER_DAY };
  });
}

export interface ThalerReconciliation {
  /** Sum of `signedThalers` over every movement-carrying kind
   *  (`THALER_MOVEMENT_KINDS` — every thaler-carrying kind except the
   *  `netWorth` snapshot, which records a total rather than a movement). */
  readonly ledgerSum: number;
  readonly startThalers: number;
  readonly endThalers: number;
  /** `endThalers - startThalers - ledgerSum` — zero iff every thaler
   *  movement the Company's purse underwent is accounted for by a booked
   *  Ledger event (the Value law, CONTEXT.md — Ledger). A non-zero drift is
   *  a finding to report (§Laws 7/8: not a sim constant to retune), never
   *  silently rounded away. */
  readonly drift: number;
}

/** The signed thaler delta a Ledger event applies to the Company's purse, or
 *  `null` for a kind that carries no `thalers` field, or for `netWorth`
 *  (a snapshot total, not a movement). See the module header for the
 *  direction table this encodes. */
export function signedThalers(event: LedgerEvent): number | null {
  if (event.kind === "netWorth") return null;
  if (!("thalers" in event)) return null;
  if (event.kind === "trade") return event.side === "sell" ? event.thalers : -event.thalers;
  if (event.kind === "contractFee") return event.thalers;
  return -event.thalers;
}

/** Per-kind sums over every thaler-carrying kind in `COST_KINDS`
 *  (docs/specs/E11-proving-grounds.md — "named cost lines: docking fees,
 *  upkeep, labor/enrollment fees, rush premiums"). A kind with zero events
 *  in this Run is still reported, at 0, so a Batch's Markdown always shows
 *  the same columns. */
function sumSignedByKind(ledger: readonly LedgerEvent[], kinds: readonly LedgerKind[]): readonly CostLine[] {
  return kinds.map((kind) => {
    let thalers = 0;
    let count = 0;
    for (const event of ledger) {
      if (event.kind !== kind) continue;
      count++;
      const signed = signedThalers(event);
      if (signed !== null) thalers += signed;
    }
    return { kind, thalers, count };
  });
}

export function computeCostLines(ledger: readonly LedgerEvent[]): readonly CostLine[] {
  return sumSignedByKind(ledger, COST_KINDS);
}

/** Per-kind sums over `REVENUE_KINDS` (today just `contractFee` — a met
 *  contract's fee, paid *to* the Company, `contract.ts`'s `settleOne`). Kept
 *  structurally separate from `computeCostLines` so `CostLine.thalers <= 0`
 *  stays true by construction rather than by convention — a `contractFee`
 *  entry mixed into the cost lines would have quietly violated that. */
export function computeRevenueLines(ledger: readonly LedgerEvent[]): readonly CostLine[] {
  return sumSignedByKind(ledger, REVENUE_KINDS);
}

/** Per-good trade P&L (buy/sell quantities and net thalers), in `GOOD_IDS`
 *  canonical order. */
export function computeGoodsPnL(ledger: readonly LedgerEvent[]): readonly GoodPnL[] {
  return GOOD_IDS.map((good) => {
    let boughtQty = 0;
    let soldQty = 0;
    let netThalers = 0;
    for (const event of ledger) {
      if (event.kind !== "trade" || event.good !== good) continue;
      if (event.side === "buy") boughtQty += event.qty;
      else soldQty += event.qty;
      netThalers += signedThalers(event) ?? 0;
    }
    return { good, boughtQty, soldQty, netThalers };
  });
}

/** Voyages: dockingFee events, i.e. underway→docked arrivals that were
 *  actually charged (`chargeDockingFee`, `src/sim/tick.ts`). A ship that
 *  docks while the Company's purse is already at 0 thalers is charged
 *  nothing and books no event — this undercounts that ship's arrivals; a
 *  documented reading of "voyage", not a hidden one. */
export function computeVoyages(ledger: readonly LedgerEvent[]): {
  readonly total: number;
  readonly byShip: Readonly<Record<ShipId, number>>;
} {
  const byShip: Record<ShipId, number> = {};
  let total = 0;
  for (const event of ledger) {
    if (event.kind !== "dockingFee") continue;
    total++;
    byShip[event.shipId] = (byShip[event.shipId] ?? 0) + 1;
  }
  return { total, byShip };
}

/** Hold utilization per ship (mean of `used/hold` across daily samples) plus
 *  the fleet mean (mean of the per-ship means — every ship weighs equally,
 *  a one-ship Run and the fleet mean coincide by construction). */
export function computeHoldUtilization(daily: readonly DaySnapshot[]): {
  readonly byShip: readonly ShipHoldUtilization[];
  readonly fleetMean: number;
} {
  const sums: Record<ShipId, { sum: number; samples: number }> = {};
  const order: ShipId[] = [];
  for (const snapshot of daily) {
    for (const s of snapshot.ships) {
      if (!(s.shipId in sums)) {
        sums[s.shipId] = { sum: 0, samples: 0 };
        order.push(s.shipId);
      }
      const entry = sums[s.shipId];
      entry.sum += s.hold > 0 ? s.used / s.hold : 0;
      entry.samples++;
    }
  }
  const byShip = order.map((shipId) => ({
    shipId,
    meanUtilization: sums[shipId].samples > 0 ? sums[shipId].sum / sums[shipId].samples : 0,
    samples: sums[shipId].samples,
  }));
  const fleetMean = byShip.length > 0 ? byShip.reduce((acc, s) => acc + s.meanUtilization, 0) / byShip.length : 0;
  return { byShip, fleetMean };
}

/** Active-contract load over time, one point per daily sample. */
export function computeActiveContractLoad(
  daily: readonly DaySnapshot[],
): readonly { readonly day: number; readonly tick: number; readonly count: number }[] {
  return daily.map((snapshot) => ({ day: snapshot.day, tick: snapshot.tick, count: snapshot.activeContracts }));
}

/** The net-worth curve, read straight off the Ledger's own daily `netWorth`
 *  snapshots (`src/sim/tick.ts`'s day-boundary phase) — one point per day
 *  the Run advanced, `days` points total, tagged with a 1-based day index in
 *  emission order. */
export function computeNetWorthCurve(ledger: readonly LedgerEvent[]): readonly NetWorthPoint[] {
  const points: NetWorthPoint[] = [];
  let day = 0;
  for (const event of ledger) {
    if (event.kind !== "netWorth") continue;
    day++;
    points.push({
      day,
      tick: event.tick,
      thalers: event.thalers,
      cargoValue: event.cargoValue,
      siteStoreValue: event.siteStoreValue,
      buildingStoreValue: event.buildingStoreValue,
      total: event.total,
    });
  }
  return points;
}

/** Guild rank/points trajectory (cumulative `pointsDelta` over `settlement`
 *  events, per guild) plus final points/rank, in `ECONOMIC_ARCHETYPES`
 *  canonical order — only guilds with at least one `settlement` event or a
 *  final enrollment are included (a guild never engaged has nothing to
 *  chart). */
export function computeGuildStandings(
  ledger: readonly LedgerEvent[],
  finalGuilds: Company["guilds"],
): readonly GuildStanding[] {
  const standings: GuildStanding[] = [];
  for (const guildId of ECONOMIC_ARCHETYPES) {
    const events = ledger.filter(
      (e): e is Extract<LedgerEvent, { kind: "settlement" }> => e.kind === "settlement" && e.guildId === guildId,
    );
    const enrolled = finalGuilds[guildId] !== undefined;
    if (events.length === 0 && !enrolled) continue;
    let running = 0;
    const trajectory = events.map((e) => {
      running += e.pointsDelta;
      return { tick: e.tick, points: running };
    });
    const finalPoints = finalGuilds[guildId]?.points ?? running;
    standings.push({ guildId, finalPoints, finalRank: rankOf(finalPoints), trajectory });
  }
  return standings;
}

/** Settlement outcome counts, fleet/guild-wide (spec: "settlement outcome
 *  counts (met/missed/breached/resigned)"). */
export function computeSettlementCounts(ledger: readonly LedgerEvent[]): SettlementCounts {
  const counts = { met: 0, missed: 0, breached: 0, resigned: 0 };
  for (const event of ledger) {
    if (event.kind !== "settlement") continue;
    counts[event.outcome]++;
  }
  return counts;
}

/** Strategy churn (spec §Evaluation model): consecutive-buy good switches
 *  and their run-length distribution, across the whole fleet in tick order
 *  (a multi-ship Run's buys interleave by tick, same as the Ledger itself is
 *  ordered). */
export function computeChurn(ledger: readonly LedgerEvent[]): ChurnStats {
  const buys = ledger.filter(
    (e): e is Extract<LedgerEvent, { kind: "trade" }> => e.kind === "trade" && e.side === "buy",
  );
  let switches = 0;
  const runLengths: number[] = [];
  let current: GoodId | null = null;
  let runLength = 0;
  for (const event of buys) {
    if (event.good === current) {
      runLength++;
    } else {
      if (current !== null) {
        runLengths.push(runLength);
        switches++;
      }
      current = event.good;
      runLength = 1;
    }
  }
  if (current !== null) runLengths.push(runLength);
  return { switches, runLengths };
}

/** Reconciles the Ledger's own thaler movements against the Company's
 *  observed purse delta (the Value law, CONTEXT.md — Ledger). Verified as a
 *  test, not assumed true; a non-zero `drift` is a finding, not a bug in
 *  this function (§Laws 7/8).
 *
 *  **Coverage split (#449, doc comment restated in `harness/batch.ts` where
 *  the real-Run guard lives):** a real Run over the reference policies
 *  exercises only 3 of the 10 `THALER_MOVEMENT_KINDS` (`trade`, `dockingFee`,
 *  `upkeep`); the other 7 are guarded only by the synthetic fixture in
 *  `metrics.test.ts`. */
export function reconcileThalers(
  ledger: readonly LedgerEvent[],
  startThalers: number,
  endThalers: number,
): ThalerReconciliation {
  let ledgerSum = 0;
  for (const event of ledger) {
    if (!(THALER_MOVEMENT_KINDS as readonly string[]).includes(event.kind)) continue;
    const signed = signedThalers(event);
    if (signed !== null) ledgerSum += signed;
  }
  return { ledgerSum, startThalers, endThalers, drift: endThalers - startThalers - ledgerSum };
}

/** The full per-Run metrics bundle a Batch's report writer needs
 *  (docs/specs/E11-proving-grounds.md §Evaluation model). `netWorthStart`/
 *  `netWorthEnd` are the caller's own `computeNetWorth(world)` reads (sim's
 *  `src/sim/ledger.ts`) at the Run's boundaries — profit/day is their
 *  `total` delta over `days`, never a second, drifting derivation from cost
 *  lines (those stay presentation only, per the advisor consult this wave). */
export interface RunMetrics {
  readonly days: number;
  readonly netWorthStart: NetWorthBreakdown;
  readonly netWorthEnd: NetWorthBreakdown;
  readonly profitPerDay: number;
  readonly netWorthCurve: readonly NetWorthPoint[];
  readonly costLines: readonly CostLine[];
  readonly revenueLines: readonly CostLine[];
  readonly voyages: { readonly total: number; readonly byShip: Readonly<Record<ShipId, number>> };
  readonly holdUtilization: {
    readonly byShip: readonly ShipHoldUtilization[];
    readonly fleetMean: number;
  };
  readonly goodsPnL: readonly GoodPnL[];
  readonly churn: ChurnStats;
  readonly guildStandings: readonly GuildStanding[];
  readonly settlementCounts: SettlementCounts;
  readonly activeContractLoad: readonly { readonly day: number; readonly tick: number; readonly count: number }[];
  readonly reconciliation: ThalerReconciliation;
  readonly milestoneTimings: readonly MilestoneTiming[];
}

export interface ComputeRunMetricsArgs {
  readonly ledger: readonly LedgerEvent[];
  readonly daily: readonly DaySnapshot[];
  readonly days: number;
  readonly netWorthStart: NetWorthBreakdown;
  readonly netWorthEnd: NetWorthBreakdown;
  readonly finalGuilds: Company["guilds"];
}

export function computeRunMetrics(args: ComputeRunMetricsArgs): RunMetrics {
  const { ledger, daily, days, netWorthStart, netWorthEnd, finalGuilds } = args;
  return {
    days,
    netWorthStart,
    netWorthEnd,
    profitPerDay: days > 0 ? (netWorthEnd.total - netWorthStart.total) / days : 0,
    netWorthCurve: computeNetWorthCurve(ledger),
    costLines: computeCostLines(ledger),
    revenueLines: computeRevenueLines(ledger),
    voyages: computeVoyages(ledger),
    holdUtilization: computeHoldUtilization(daily),
    goodsPnL: computeGoodsPnL(ledger),
    churn: computeChurn(ledger),
    guildStandings: computeGuildStandings(ledger, finalGuilds),
    settlementCounts: computeSettlementCounts(ledger),
    activeContractLoad: computeActiveContractLoad(daily),
    reconciliation: reconcileThalers(ledger, netWorthStart.thalers, netWorthEnd.thalers),
    milestoneTimings: computeMilestoneTimings(ledger),
  };
}
