// W5 saturation census (#234 comment, 2026-07-28; #115 replacement).
// Read-only analysis script, not a permanent harness module — deliberately
// does not touch harness/batch.ts (a sibling coder package landed
// invariant/anomaly wiring there; this stays out of its way).
//
// Question: over a null-policy (doNothing) Run, does any (port, good) pair
// with real production or consumption spend a player-relevant share of the
// game saturated — resting near its price headroom's edge — rather than at
// a healthy interior fixed point?
//
// v2 (this file) reformulates the original terminal-state census per the
// 2026-07-29 owner grill on #234/#115:
//   1. Metric is TIME-IN-SATURATION (% of the window's days spent near the
//      boundary) and RECOVERY (does the pair ever leave saturation again),
//      not a single terminal-day classification — a port glutted for 3 days
//      then recovering is a different finding from one dead from day 60 on.
//   2. The window is tied to a player-relevant reference, not an arbitrary
//      day count. The grill's first choice — median world-days-to-`launch`
//      from the harness's own milestone metric (#446) — turned out to be
//      unmeasurable: `gradientLoop` (the only non-trivial reference policy)
//      never issues `foundHeadquarters` or any build/launch command, so
//      `launch` and `founding` are 0/20 reached in a real Batch (verified:
//      `npx tsx harness/cli.ts run --policy gradientLoop --seeds 1000-1019
//      --days 60` — every milestone unreached). A "builder/contractor"
//      reference policy that could reach `launch` does not exist yet
//      (`harness/batch.ts`'s own doc comment names this gap, #449, out of
//      scope here). Per the grill's resolution: WINDOW_DAYS below is a
//      **stated approximation** ("roughly twice any reasonable single
//      trading cycle"), not a measured player-relevant figure — closing
//      that gap for real is a follow-up sibling to #449, not this file's job.
//
// Usage: npx tsx scripts/experiments/w5-saturation-census.ts

import {
  advanceDays,
  ARCHETYPE_PROFILES,
  createWorld,
  STOCK_CAP_MULTIPLIER,
  GOOD_IDS,
  type GoodId,
  type Region,
  type World,
} from "../../src/sim/index.ts";

const SEEDS = Array.from({ length: 20 }, (_, i) => 1000 + i);
/** Stated approximation, not a measured player-relevant figure — see file
 *  header. Was: median world-days-to-`launch`; unmeasurable today. */
const WINDOW_DAYS = 120;
const SATURATION_EPS = 0.03; // "within ε of 0 or 1"

interface PairSample {
  readonly day: number;
  readonly s: number; // stock / (STOCK_CAP_MULTIPLIER * equilibrium)
}

interface PairSeries {
  readonly portId: string;
  readonly archetype: string;
  readonly good: GoodId;
  readonly degree: number; // count of lanes touching this port
  readonly avgVoyageTicks: number; // mean voyageTicks of lanes touching this port
  readonly production: number;
  readonly consumption: number;
  readonly samples: PairSample[];
}

function portDegree(region: Region, portId: string): { degree: number; avgVoyageTicks: number } {
  const touching = region.lanes.filter((l) => l.a === portId || l.b === portId);
  const avg = touching.length === 0 ? 0 : touching.reduce((sum, l) => sum + l.voyageTicks, 0) / touching.length;
  return { degree: touching.length, avgVoyageTicks: avg };
}

function isSaturated(s: number): boolean {
  return s <= SATURATION_EPS || s >= 1 - SATURATION_EPS;
}

interface TimeSaturationResult {
  readonly daysSaturated: number;
  readonly fractionSaturated: number;
  readonly everSaturated: boolean;
  readonly terminalSaturated: boolean; // saturated at window's last day
  readonly recovered: boolean; // entered saturation, then left it before window end
  readonly firstSaturationDay: number | null;
}

function measureTimeSaturation(series: PairSeries): TimeSaturationResult {
  let daysSaturated = 0;
  let firstSaturationDay: number | null = null;
  for (const sample of series.samples) {
    if (isSaturated(sample.s)) {
      daysSaturated++;
      if (firstSaturationDay === null) firstSaturationDay = sample.day;
    }
  }
  const terminal = series.samples[series.samples.length - 1].s;
  const terminalSaturated = isSaturated(terminal);
  const everSaturated = daysSaturated > 0;
  return {
    daysSaturated,
    fractionSaturated: daysSaturated / series.samples.length,
    everSaturated,
    terminalSaturated,
    recovered: everSaturated && !terminalSaturated,
    firstSaturationDay,
  };
}

type Regime = "R1-inert" | "R2-saturated" | "R3-living";

/** R1/R2/R3 kept for the inert sanity-check only (see v1's conclusion —
 *  marketTick is a no-op when production=consumption=0, still true, still
 *  worth a cheap re-confirmation). R2 here is defined as "saturated at
 *  window end", used only to cross-check against the time-based metric
 *  below, not as the reported finding. */
function classifyTerminal(series: PairSeries): Regime {
  if (series.production === 0 && series.consumption === 0) return "R1-inert";
  const terminal = series.samples[series.samples.length - 1].s;
  return isSaturated(terminal) ? "R2-saturated" : "R3-living";
}

function runOneSeed(seed: number): PairSeries[] {
  let world: World = createWorld(seed);
  const region0 = world.region;
  const seriesByKey = new Map<string, PairSeries>();

  for (const port of region0.ports) {
    const profile = ARCHETYPE_PROFILES[port.archetype];
    const { degree, avgVoyageTicks } = portDegree(region0, port.id);
    for (const good of GOOD_IDS) {
      const production = profile.productionPerDay[good] ?? 0;
      const consumption = profile.consumptionPerDay[good] ?? 0;
      seriesByKey.set(`${port.id}:${good}`, {
        portId: port.id,
        archetype: port.archetype,
        good,
        degree,
        avgVoyageTicks,
        production,
        consumption,
        samples: [],
      });
    }
  }

  const sampleDay = (day: number) => {
    for (const port of world.region.ports) {
      for (const good of GOOD_IDS) {
        const entry = port.market[good];
        const s = entry.stock / (STOCK_CAP_MULTIPLIER * entry.equilibrium);
        seriesByKey.get(`${port.id}:${good}`)!.samples.push({ day, s });
      }
    }
  };

  sampleDay(0);
  for (let day = 1; day <= WINDOW_DAYS; day++) {
    world = advanceDays(world, 1, () => []); // doNothing: zero commands every tick
    sampleDay(day);
  }

  return [...seriesByKey.values()];
}

interface AggregateRow {
  archetype: string;
  good: GoodId;
  production: number;
  consumption: number;
  n: number;
  regimeCounts: Record<Regime, number>;
  everSaturatedCount: number;
  recoveredCount: number;
  terminalSaturatedCount: number;
  medianFractionSaturated: number; // over pairs that were ever saturated; 0 if none
  medianFirstSaturationDay: number | null; // over pairs that were ever saturated
}

function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function main() {
  const allSeries: PairSeries[] = [];
  for (const seed of SEEDS) {
    allSeries.push(...runOneSeed(seed));
  }

  const byKey = new Map<string, PairSeries[]>();
  for (const s of allSeries) {
    const key = `${s.archetype}:${s.good}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key)!.push(s);
  }

  const rows: AggregateRow[] = [];
  for (const [key, group] of byKey) {
    const [archetype, good] = key.split(":") as [string, GoodId];
    const regimeCounts: Record<Regime, number> = { "R1-inert": 0, "R2-saturated": 0, "R3-living": 0 };
    let everSaturatedCount = 0;
    let recoveredCount = 0;
    let terminalSaturatedCount = 0;
    const fractionsWhenEverSaturated: number[] = [];
    const firstDaysWhenEverSaturated: number[] = [];

    for (const series of group) {
      regimeCounts[classifyTerminal(series)]++;
      const result = measureTimeSaturation(series);
      if (result.everSaturated) {
        everSaturatedCount++;
        fractionsWhenEverSaturated.push(result.fractionSaturated);
        firstDaysWhenEverSaturated.push(result.firstSaturationDay!);
      }
      if (result.recovered) recoveredCount++;
      if (result.terminalSaturated) terminalSaturatedCount++;
    }

    rows.push({
      archetype,
      good,
      production: group[0].production,
      consumption: group[0].consumption,
      n: group.length,
      regimeCounts,
      everSaturatedCount,
      recoveredCount,
      terminalSaturatedCount,
      medianFractionSaturated: median(fractionsWhenEverSaturated),
      medianFirstSaturationDay: firstDaysWhenEverSaturated.length > 0 ? median(firstDaysWhenEverSaturated) : null,
    });
  }

  rows.sort((a, b) => (a.archetype + a.good).localeCompare(b.archetype + b.good));

  console.log(
    `# W5 saturation census v2 — ${SEEDS.length} seeds x ${WINDOW_DAYS} days (stated approximation, see file header), doNothing policy\n`,
  );
  console.log(
    "archetype | good | prod/day | cons/day | n | R1 | ever-saturated | recovered | still-saturated@end | median % window saturated (of ever-sat.) | median first-saturation day",
  );
  console.log("--- | --- | --- | --- | --- | --- | --- | --- | --- | --- | ---");
  for (const r of rows) {
    console.log(
      `${r.archetype} | ${r.good} | ${r.production} | ${r.consumption} | ${r.n} | ${r.regimeCounts["R1-inert"]} | ` +
        `${r.everSaturatedCount} | ${r.recoveredCount} | ${r.terminalSaturatedCount} | ` +
        `${(r.medianFractionSaturated * 100).toFixed(1)}% | ${r.medianFirstSaturationDay ?? "—"}`,
    );
  }
}

main();
