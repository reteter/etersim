// W5 saturation census (#234 comment, 2026-07-28; #115 replacement).
// Read-only analysis script, not a permanent harness module — deliberately
// does not touch harness/batch.ts (Package B is landing invariant/anomaly
// wiring there in parallel; this stays out of its way).
//
// Question: over a long null-policy (doNothing) Run, does any (port, good)
// pair with real production or consumption trend to saturation (spends
// nearly all its price headroom) rather than resting at an interior fixed
// point? Per the issue comment, this step measures — no bounds, no
// assertion. A guardrail (if any) is a follow-up that reads its bounds off
// this census.
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
const DAYS = 240;
const VARIANCE_WINDOW = 20; // last K days used for the end-window variance
const SATURATION_EPS = 0.03; // "within ε of 0 or 1"
const SATURATION_VARIANCE_MAX = 0.0005; // end-window variance treated as "≈ 0"

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

function variance(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
}

type Regime = "R1-inert" | "R2-saturated" | "R3-living";

function classify(series: PairSeries): Regime {
  if (series.production === 0 && series.consumption === 0) return "R1-inert";
  const window = series.samples.slice(-VARIANCE_WINDOW).map((s) => s.s);
  const terminal = series.samples[series.samples.length - 1].s;
  const nearCap = terminal >= 1 - SATURATION_EPS;
  const nearFloor = terminal <= SATURATION_EPS;
  const flatEnd = variance(window) <= SATURATION_VARIANCE_MAX;
  if ((nearCap || nearFloor) && flatEnd) return "R2-saturated";
  return "R3-living";
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
  for (let day = 1; day <= DAYS; day++) {
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
  regimeCounts: Record<Regime, number>;
  terminalSMedian: number;
  degreeRange: [number, number];
  voyageTicksRange: [number, number];
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
    const terminals: number[] = [];
    const degrees: number[] = [];
    const voyageTicks: number[] = [];
    for (const series of group) {
      const regime = classify(series);
      regimeCounts[regime]++;
      terminals.push(series.samples[series.samples.length - 1].s);
      degrees.push(series.degree);
      voyageTicks.push(series.avgVoyageTicks);
    }
    terminals.sort((a, b) => a - b);
    const median = terminals[Math.floor(terminals.length / 2)];
    rows.push({
      archetype,
      good,
      production: group[0].production,
      consumption: group[0].consumption,
      regimeCounts,
      terminalSMedian: median,
      degreeRange: [Math.min(...degrees), Math.max(...degrees)],
      voyageTicksRange: [Math.min(...voyageTicks), Math.max(...voyageTicks)],
    });
  }

  rows.sort((a, b) => (a.archetype + a.good).localeCompare(b.archetype + b.good));

  console.log(`# W5 saturation census — ${SEEDS.length} seeds x ${DAYS} days, doNothing policy\n`);
  console.log(
    "archetype | good | prod/day | cons/day | R1 | R2-sat | R3-living | median terminal s | degree range | voyageTicks range",
  );
  console.log("--- | --- | --- | --- | --- | --- | --- | --- | --- | ---");
  for (const r of rows) {
    console.log(
      `${r.archetype} | ${r.good} | ${r.production} | ${r.consumption} | ${r.regimeCounts["R1-inert"]} | ` +
        `${r.regimeCounts["R2-saturated"]} | ${r.regimeCounts["R3-living"]} | ${r.terminalSMedian.toFixed(3)} | ` +
        `${r.degreeRange[0]}-${r.degreeRange[1]} | ${r.voyageTicksRange[0]}-${r.voyageTicksRange[1]}`,
    );
  }
}

main();
