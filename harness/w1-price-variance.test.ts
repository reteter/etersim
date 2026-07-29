import { describe, expect, it } from "vitest";
import { createWorld, effectiveBase, GOOD_IDS, price, type World } from "../src/sim/index.ts";
import { ARCHETYPE_PROFILES } from "../src/sim/region.ts";
import { runBatchRun, runOne } from "./batch.ts";
import { doNothing } from "./policies/doNothing.ts";

/**
 * W1 — Price Variance Assertion (#234, docs/specs/E11-proving-grounds.md)
 *
 * The economy moves whether the player acts or not (PRD §Pillars 1).
 * Assertion: over a Run of N world days with zero commands (doNothing
 * policy), every port's **price** (not raw stock — see below) for every good
 * with production or consumption at that port must show non-zero variance
 * across day boundaries. If a price never changes, the economy is not alive.
 *
 * **Price, not stock.** An earlier draft of this test sampled
 * `port.market[good].stock` under a field literally named `price` — a
 * different quantity. The real, player-visible price is `price(entry, base)`
 * (`src/sim/market.ts`), clamped to `[PRICE_FLOOR, PRICE_CEIL] × effectiveBase`.
 * A port resting at that clamp can have **zero price variance while its
 * stock still moves** — exactly the saturation the W5 census
 * (`docs/experiments/2026-07-29-w5-saturation-census.md`) found is real for
 * ~11.5% of grain instances. This test measures the real price.
 *
 * **Routed through the real Run machinery.** `runOne`/`runBatchRun`
 * (`harness/batch.ts`) are the actual doNothing-policy pipeline — not a raw
 * `advanceDays` loop reimplementing it. `RunRecord` itself carries no
 * per-day World snapshot, so per-day price sampling chunks the same Run one
 * day at a time through `runBatchRun`; `batch.test.ts`'s day-chunking
 * equivalence property is what makes N one-day calls tick-for-tick identical
 * to one N-day call, so this does not change what the Run does.
 */

const SEEDS = [1, 7, 42];
const DAYS = 30;

describe("W1 — Price Variance (Null-Policy Economy Liveliness)", () => {
  for (const seed of SEEDS) {
    it(`seed ${seed}: doNothing over ${DAYS} days has non-zero *price* variance at every (port, good) with activity`, () => {
      // Real invariant/anomaly checking over the actual runOne path (#234):
      // a healthy doNothing Run should raise zero anomalies.
      const record = runOne("doNothing", {}, seed, DAYS, { enableAssertions: true });
      expect(record.anomalies).toEqual([]);

      // Real per-day price sampling.
      let world: World = createWorld(seed);
      const pricesByKey = new Map<string, number[]>();
      for (let day = 1; day <= DAYS; day++) {
        const step = runBatchRun(world, doNothing, 1);
        world = step.world;
        for (const port of world.region.ports) {
          for (const good of GOOD_IDS) {
            const base = effectiveBase(port, good);
            const p = price(port.market[good], base);
            const key = `${port.id}:${good}`;
            const list = pricesByKey.get(key) ?? [];
            list.push(p);
            pricesByKey.set(key, list);
          }
        }
      }

      const failedPairs: string[] = [];
      for (const [key, prices] of pricesByKey) {
        const [portId, good] = key.split(":");
        const port = world.region.ports.find((p) => p.id === portId);
        if (!port) continue;

        const profile = ARCHETYPE_PROFILES[port.archetype];
        const hasProduction = (profile.productionPerDay[good as (typeof GOOD_IDS)[number]] ?? 0) > 0;
        const hasConsumption = (profile.consumptionPerDay[good as (typeof GOOD_IDS)[number]] ?? 0) > 0;

        // Only check goods with activity at this port.
        if (!hasProduction && !hasConsumption) continue;

        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        const variance = maxPrice - minPrice;
        if (variance === 0) {
          failedPairs.push(`${key} (price stuck at ${minPrice})`);
        }
      }

      expect(
        failedPairs,
        `Seed ${seed}: price stagnation detected in active goods (real price(), clamp-aware). ` +
          `Pairs with zero variance: ${failedPairs.join(", ")}`,
      ).toHaveLength(0);
    });
  }
});
