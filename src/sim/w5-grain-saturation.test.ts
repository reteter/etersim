import { describe, expect, it } from "vitest";
import { GOOD_IDS, type GoodId } from "./goods";
import { ARCHETYPE_PROFILES } from "./region";
import { advanceDays } from "./scenario";
import { STOCK_CAP_MULTIPLIER } from "./market";
import { createWorld } from "./world";

/**
 * W5 grain-saturation guardrail (#234, docs/experiments/2026-07-29-w5-saturation-census.md).
 *
 * Replaces a point assertion with a **distribution bound over a seed
 * sweep** (2026-07-28 comment on #234: "asserted on distribution bounds"),
 * read off the census's measured baseline — grain is the only good whose
 * (port, good) pairs meaningfully lock into saturation (stuck near the
 * price floor/cap, out of headroom) under a null-policy Run; everything
 * else stays interior. The margin below is **deliberately loose** (roughly
 * 2x the measured baseline) — this guards against a future regression
 * (a tuning change that makes saturation *worse*), not against today's
 * measured rate itself, which the census already treats as a known,
 * accepted characteristic (owner grill, 2026-07-29) rather than a defect
 * to eliminate. §Laws 7: these are tuning constants; this test does not
 * pin their values, only the emergent saturation rate they produce.
 *
 * Window: 120 world-days — a stated approximation of "meaningfully far
 * into a playthrough," not a measured player-relevant figure (the
 * intended reference, median world-days-to-`launch`, turned out
 * unmeasurable: no existing reference policy founds/builds/launches — see
 * the census doc's v2 section). Seeds here are disjoint from the census's
 * own seed sample (1000–1019) so this guardrail is a genuine out-of-sample
 * check, not a re-assertion of the exact data used to derive the margin.
 */

const WINDOW_DAYS = 120;
const SATURATION_EPS = 0.03;
const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1); // 1..20, disjoint from the census's 1000-1019

/** Terminal saturation fraction across every non-inert (port, good) pair,
 *  for every good, over `WINDOW_DAYS` of a null-policy Run, across `SEEDS`.
 *  One simulation pass per seed (not per good) — this is the expensive
 *  part, so every good's rate is collected from the same Run. */
function terminalSaturationRates(): Record<GoodId, number> {
  const nonInertPairs: Record<GoodId, number> = Object.fromEntries(GOOD_IDS.map((g) => [g, 0])) as Record<
    GoodId,
    number
  >;
  const stillSaturatedAtEnd: Record<GoodId, number> = Object.fromEntries(GOOD_IDS.map((g) => [g, 0])) as Record<
    GoodId,
    number
  >;

  for (const seed of SEEDS) {
    let world = createWorld(seed);
    for (let day = 1; day <= WINDOW_DAYS; day++) {
      world = advanceDays(world, 1); // doNothing: no decider, zero commands
    }
    for (const port of world.region.ports) {
      const profile = ARCHETYPE_PROFILES[port.archetype];
      for (const good of GOOD_IDS) {
        const production = profile.productionPerDay[good] ?? 0;
        const consumption = profile.consumptionPerDay[good] ?? 0;
        if (production === 0 && consumption === 0) continue; // R1 inert, excluded by construction

        nonInertPairs[good]++;
        const entry = port.market[good];
        const s = entry.stock / (STOCK_CAP_MULTIPLIER * entry.equilibrium);
        if (s <= SATURATION_EPS || s >= 1 - SATURATION_EPS) stillSaturatedAtEnd[good]++;
      }
    }
  }

  return Object.fromEntries(
    GOOD_IDS.map((g) => [g, nonInertPairs[g] === 0 ? 0 : stillSaturatedAtEnd[g] / nonInertPairs[g]]),
  ) as Record<GoodId, number>;
}

describe("W5 grain-saturation distribution guardrail (#234 — replaces a point assertion)", () => {
  it("grain's terminal-saturation rate stays within 2x the measured baseline (~11%, margin to 25%); every other good stays near zero (margin to 10%)", () => {
    const rates = terminalSaturationRates();

    // Baseline measured by the census: ~10-11% of grain (port, good) pairs
    // are still saturated at the window's end. 25% gives roughly 2x
    // headroom for legitimate seed-to-seed variance while still catching a
    // real regression (e.g. an accidental OSMOSIS_CAP reduction, or a
    // worldgen change that further concentrates grain's volume).
    expect(rates.grain, "grain terminal-saturation rate").toBeLessThanOrEqual(0.25);

    // The census found grain uniquely prone to saturation; every other
    // good's non-inert pairs sat at ~0-4% (0 in the 120-day v2 window). A
    // wide net over all of them is the general regression guard: if tuning
    // ever pushes another good into grain's regime, this should catch it.
    for (const good of GOOD_IDS) {
      if (good === "grain") continue;
      expect(rates[good], `${good} terminal-saturation rate`).toBeLessThanOrEqual(0.1);
    }
  }, 20_000);
});
