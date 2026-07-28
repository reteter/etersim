import {
  ARCHETYPE_PROFILES,
  GOOD_IDS,
  type ActiveContract,
  type GoodId,
  type Port,
  type PortId,
} from "../sim";
import { type MarketSignal } from "./marketSignal";

/**
 * Offer labels (#397, docs/specs/E16-workbench.md — Market-quality signal,
 * rendering 3; CONTEXT.md — Market-quality signal): the *word* rendering of
 * the one signal the board's cell emphasis (#392/#396) and PortPanel's
 * action shading (#396) already read. Composes over `computeMarketSignal`
 * (never re-derives a tier) plus two more region facts the signal itself
 * doesn't carry — producer scarcity and active-contract demand — so this
 * module, not `marketSignal.ts`, is where those get computed. Informational
 * only: never trades or wires anything (same contract as the signal).
 *
 * Naming note: "Pilne" already exists in `KontraktyTab.tsx` as a distinct
 * desperation-clause label (issue #226, `requiredRank === 1`) on a Contract
 * *offer card*. This module's `urgent` label is a different concept (an
 * *accepted* Contract's outstanding quota, read on the price board's sell
 * cell) — CONTEXT.md's Market-quality signal entry names both "pilne" as the
 * approved display string, so the collision is a display-string coincidence,
 * not a shared identifier (own CSS class, own module, own trigger).
 */

export type OfferLabel = "bargain" | "scarce" | "urgent";

/** Approved Polish display strings (CONTEXT.md — Market-quality signal,
 *  "offer labels (okazja / rzadkie / pilne)"). Read from here, never
 *  hardcoded per call site. */
export const OFFER_LABEL_TEXT: Record<OfferLabel, string> = {
  bargain: "okazja",
  scarce: "rzadkie",
  urgent: "pilne",
};

/** "Tradable at few ports" (issue #397 AC): a good produced by at most this
 *  many ports region-wide reads as scarce at its producer port(s). Tuning,
 *  not semantic law — sampled worldgen output (7 seeds, portCountRange
 *  [7, 9]) shows most goods land at exactly 1 producer port and none below
 *  that, so `1` is "the single regional source", the strongest scarcity
 *  reading available without a relative/ranked rule. Safe to retune. */
export const RARE_PRODUCER_PORT_MAX = 1;

/** One port×good cell's buy-side and sell-side offer labels, in the fixed
 *  display order [bargain, scarce] / [urgent] — never re-ordered per call
 *  site, so two labels that co-fire on the same cell (a producer port's
 *  cheapest ask is often also its region-exclusive good) always read in the
 *  same order. */
export interface OfferLabelEntry {
  readonly buy: readonly OfferLabel[];
  readonly sell: readonly OfferLabel[];
}

export interface OfferLabels {
  readonly entries: Record<PortId, Record<GoodId, OfferLabelEntry>>;
}

/** Number of ports in `ports` whose archetype produces `good` at all
 *  (`ARCHETYPE_PROFILES[archetype].productionPerDay[good] > 0`) — the
 *  region fact "rzadkie" reads (issue #397: "check src/sim market/world
 *  module for what's already computed... rather than adding new sim
 *  state" — this reads `Port.archetype` plus the existing archetype table,
 *  no new sim state). */
function producerPortCounts(ports: readonly Port[]): Record<GoodId, number> {
  const counts = {} as Record<GoodId, number>;
  for (const good of GOOD_IDS) counts[good] = 0;
  for (const port of ports) {
    const profile = ARCHETYPE_PROFILES[port.archetype];
    for (const good of GOOD_IDS) {
      if ((profile.productionPerDay[good] ?? 0) > 0) counts[good]++;
    }
  }
  return counts;
}

/**
 * Computes offer labels for every (port, good) in the region.
 *
 * - **bargain** (okazja): `signal.entries[port][good].buyTier === "strong"`
 *   — the bright end of the buy gradient, verbatim per the issue AC.
 * - **scarce** (rzadkie): this port produces `good` and region-wide at most
 *   `RARE_PRODUCER_PORT_MAX` ports do — "good tradable at few ports" read as
 *   producer scarcity (the only region fact already on `Port`/
 *   `ARCHETYPE_PROFILES` that fits the phrase; every port's `market` already
 *   carries every good at some price, so "tradable at all" can't be the
 *   read — flagged in the completion report as a scope call).
 * - **urgent** (pilne): an `ActiveContract` for this exact (port, good) still
 *   has quota outstanding this period (`deliveredThisPeriod <
 *   quotaPerPeriod`) — reads Contract demand, which is genuinely "beyond
 *   pure spread" and time-boxed by the contract's settlement period, without
 *   needing the unexported `periodEndTick` (`contract.ts`) or any new
 *   `src/sim` export (flagged in the completion report as a scope call: the
 *   issue's "time/contract-driven" phrasing could also mean "close to its
 *   period's end tick", which isn't reachable without a new sim export and
 *   was deliberately not chased under the "no src/sim changes" boundary).
 *   Selling `good` at this port is exactly what credits `deliveredThisPeriod`
 *   (`commands.ts` `applyTrade` — `stockDelta > 0`), so this reads on the
 *   **sell** side, not the buy side.
 */
export function computeOfferLabels(
  ports: readonly Port[],
  signal: MarketSignal,
  activeContracts: readonly ActiveContract[],
): OfferLabels {
  const counts = producerPortCounts(ports);
  const urgentKeys = new Set(
    activeContracts
      .filter((c) => c.deliveredThisPeriod < c.quotaPerPeriod)
      .map((c) => `${c.portId}:${c.good}`),
  );

  const entries = {} as Record<PortId, Record<GoodId, OfferLabelEntry>>;
  for (const port of ports) {
    const profile = ARCHETYPE_PROFILES[port.archetype];
    const byGood = {} as Record<GoodId, OfferLabelEntry>;
    for (const good of GOOD_IDS) {
      const buy: OfferLabel[] = [];
      if (signal.entries[port.id][good].buyTier === "strong") buy.push("bargain");
      const isProducer = (profile.productionPerDay[good] ?? 0) > 0;
      if (isProducer && counts[good] <= RARE_PRODUCER_PORT_MAX) buy.push("scarce");

      const sell: OfferLabel[] = [];
      if (urgentKeys.has(`${port.id}:${good}`)) sell.push("urgent");

      byGood[good] = { buy, sell };
    }
    entries[port.id] = byGood;
  }

  return { entries };
}
