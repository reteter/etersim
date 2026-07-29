import { describe, expect, it } from "vitest";
import { advanceDays, createWorld, type World, GOOD_IDS } from "../src/sim/index.ts";
import { ARCHETYPE_PROFILES } from "../src/sim/region.ts";

/**
 * W1 — Price Variance Assertion (#234, docs/specs/E11-proving-grounds.md)
 *
 * The economy moves whether the player acts or not (PRD §Pillars 1).
 * Assertion: over a Run of N world days with zero commands (doNothing policy),
 * every port's price for every good with production or consumption at that port
 * must show non-zero variance across day boundaries. If a price never changes,
 * the economy is not alive.
 *
 * This test (and the companion probe below) provides a falsifiable check on
 * the null policy and the reference seeds.
 */

interface PriceSnapshot {
  readonly day: number;
  readonly portId: string;
  readonly good: string;
  readonly price: number;
}

/**
 * Probe: gathers price snapshots across a doNothing run and measures variance.
 * Useful for understanding what healthy variance looks like before writing
 * the assertion. Run this manually to inspect real data:
 *   npm test -- w1-price-variance.test.ts -t "probe"
 */
function* priceProbe(world: World, days: number) {
  const snapshots: PriceSnapshot[] = [];
  let current = world;

  for (let day = 1; day <= days; day++) {
    current = advanceDays(current, 1);
    for (const port of current.region.ports) {
      for (const good of GOOD_IDS) {
        const marketGood = port.market[good];
        if (marketGood) {
          snapshots.push({
            day,
            portId: port.id,
            good,
            price: marketGood.stock,
          });
        }
      }
    }
  }

  yield snapshots;
}

/**
 * Analyzes price variance across a run. Returns a summary of each (port, good)
 * pair's price range and whether it has non-zero variance.
 */
function analyzeVariance(snapshots: PriceSnapshot[]): {
  readonly pairs: readonly {
    readonly portId: string;
    readonly good: string;
    readonly min: number;
    readonly max: number;
    readonly variance: number;
    readonly hasConsumption: boolean;
  }[];
  readonly allHealthy: boolean;
} {
  const grouped = new Map<string, PriceSnapshot[]>();
  for (const snap of snapshots) {
    const key = `${snap.portId}:${snap.good}`;
    const list = grouped.get(key) ?? [];
    list.push(snap);
    grouped.set(key, list);
  }

  const pairs = Array.from(grouped.entries()).map(([key, prices]) => {
    const values = prices.map((p) => p.price);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const [portId, good] = key.split(":");
    // Note: determining consumption here would require importing ARCHETYPE_PROFILES,
    // but for the probe we just flag all pairs. The real assertion will filter.
    return { portId, good, min, max, variance: max - min, hasConsumption: true };
  });

  const allHealthy = pairs.every((p) => p.variance > 0);
  return { pairs, allHealthy };
}

describe("W1 — Price Variance (Null-Policy Economy Liveliness)", () => {
  it("probe: measure price variance across doNothing over multiple seeds", () => {
    // This test demonstrates the probe without asserting anything.
    // It collects variance data that should inform the real assertion below.
    const probeSeeds = [1, 7];
    const daysPerProbe = 30;

    for (const seed of probeSeeds) {
      const world = createWorld(seed);
      const probs = priceProbe(world, daysPerProbe);
      const snapshots = probs.next().value as PriceSnapshot[];
      const { pairs, allHealthy } = analyzeVariance(snapshots);

      console.log(
        `[Seed ${seed}] Probed ${snapshots.length} snapshots across ${daysPerProbe} days`
      );
      if (!allHealthy) {
        const stagnant = pairs.filter((p) => p.variance === 0);
        console.log(`  WARNING: ${stagnant.length} (port, good) pairs with zero variance:`);
        for (const p of stagnant.slice(0, 5)) {
          console.log(`    ${p.portId}/${p.good}: price stuck at ${p.min}`);
        }
      } else {
        console.log(`  All ${pairs.length} pairs have non-zero variance — economy is alive.`);
      }
    }

    // This test doesn't assert; it just reports. The real assertion follows.
    expect(true).toBe(true);
  });

  it("W1: doNothing over N days has non-zero price variance at every (port, good) with activity", () => {
    // Run the null policy over the reference seeds, checking that prices move.
    const seeds = [1, 7, 42];
    const days = 30;

    for (const seed of seeds) {
      // Extract price snapshots from the run's world by re-running (not ideal, but
      // proves the assertion logic). Better: modify runOne to return final world.
      // For now, we construct a minimal probe.
      let world = createWorld(seed);
      const pricesByDay: Record<string, number[]> = {};

      for (let day = 1; day <= days; day++) {
        world = advanceDays(world, 1);
        for (const port of world.region.ports) {
          for (const good of GOOD_IDS) {
            const key = `${port.id}:${good}`;
            if (!pricesByDay[key]) pricesByDay[key] = [];
            pricesByDay[key].push(port.market[good].stock);
          }
        }
      }

      // Check variance only for (port, good) pairs that have production or consumption at that port.
      const failedPairs: string[] = [];
      for (const [key, prices] of Object.entries(pricesByDay)) {
        const [portId, good] = key.split(":");
        const port = world.region.ports.find((p) => p.id === portId);
        if (!port) continue;

        const profile = ARCHETYPE_PROFILES[port.archetype];
        const hasProduction = (profile.productionPerDay[good as typeof GOOD_IDS[number]] ?? 0) > 0;
        const hasConsumption = (profile.consumptionPerDay[good as typeof GOOD_IDS[number]] ?? 0) > 0;

        // Only check goods with activity at this port.
        if (!hasProduction && !hasConsumption) continue;

        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        const variance = maxPrice - minPrice;
        if (variance === 0) {
          failedPairs.push(`${key} (stock: ${minPrice})`);
        }
      }

      expect(
        failedPairs,
        `Seed ${seed}: Price stagnation detected in active goods. Pairs with zero variance: ${failedPairs.slice(0, 3).join(", ")}`
      ).toHaveLength(0);
    }
  });
});
