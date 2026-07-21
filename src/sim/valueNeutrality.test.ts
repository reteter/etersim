import { describe, expect, it } from "vitest";
import { GOOD_IDS, type GoodId } from "./goods";
import { storeOf } from "./goodsStore";
import { computeNetWorth } from "./ledger";
import { companyStores, moveOwnGoods } from "./transfer";
import { createWorld, type World } from "./world";
import type { Ship } from "./ship";

/**
 * E13.0 (#307, ADR-0008; docs/specs/E13.0-goods-store.md §Testing, C3): the
 * value-neutrality invariant — moving your own goods between two Goods
 * stores the Company owns never changes `computeNetWorth`'s total. This is
 * the guard ADR-0008 substitutes for a typed site registry: it enumerates
 * nothing, so it needs no update when a store kind is added, but it only
 * bites because the test generates its moves from `companyStores` — a store
 * missing from that enumeration is invisible to both `computeNetWorth` and
 * this test alike (the accepted trade-off, spec §Design — "Why an invariant
 * and not a registry"). The drill in the completion report proves that
 * bite: temporarily add a fifth store reachable via `companyStores` but not
 * summed by `computeNetWorth`, watch this test go red, revert.
 */

/** Deterministic, seed-varied nonzero quantities for every good — no RNG
 *  (ADR-0003 doesn't apply to test fixtures, but there is no reason to draw
 *  one either: a simple arithmetic spread already gives 20 distinct,
 *  reproducible fixtures). */
function qtyMap(seedIndex: number, salt: number): Partial<Record<GoodId, number>> {
  const map: Partial<Record<GoodId, number>> = {};
  GOOD_IDS.forEach((good, i) => {
    map[good] = ((seedIndex * 7 + salt * 13 + i * 3) % 20) + 1;
  });
  return map;
}

/** A World with four active stores — both ships' holds, the HQ build site,
 *  and an active Refit — each populated with a seed-varied nonzero quantity
 *  of every good, so `companyStores` walks a real, non-trivial set and
 *  every (from, to, good) triple in the property loop below actually moves
 *  something. Hand-built (not driven through `applyCommand`) because the
 *  invariant is a structural property of GoodsStore + computeNetWorth, not
 *  of the one-Build-Order scarcity rule — HQ build + Refit coexisting here
 *  (legal: Shipyard already "built", no `site`) is deliberately the richest
 *  combination `companyStores` can return short of a second ship refit. */
function scriptedWorld(seedIndex: number): World {
  const base = createWorld(`value-neutrality-${seedIndex}`);
  const hqPortId = base.region.ports[0].id;
  const shipyardPortId = base.region.ports[1].id;

  const s0: Ship = {
    ...base.company.ships[0],
    location: { kind: "docked", portId: hqPortId },
    cargo: storeOf(qtyMap(seedIndex, 1)),
  };
  const s1: Ship = {
    id: "s1",
    name: "s1",
    hold: 50,
    baseHold: 50,
    cargo: storeOf(qtyMap(seedIndex, 2)),
    location: { kind: "docked", portId: shipyardPortId },
  };

  return {
    ...base,
    company: {
      ...base.company,
      thalers: 5000,
      ships: [s0, s1],
      headquarters: { portId: hqPortId, buildOrder: { siteStore: storeOf(qtyMap(seedIndex, 3)) } },
      shipyard: {
        portId: shipyardPortId,
        refitOrder: { shipId: "s1", targetHold: 100, siteStore: storeOf(qtyMap(seedIndex, 4)) },
      },
    },
  };
}

const SEED_INDICES = Array.from({ length: 20 }, (_, i) => i);

describe("value-neutrality invariant (E13.0 #307, spec C3)", () => {
  it.each(SEED_INDICES)(
    "moving goods between any two of the Company's stores never changes computeNetWorth's total (seed index %i)",
    (seedIndex) => {
      const w = scriptedWorld(seedIndex);
      const stores = companyStores(w);
      // Sanity precondition (incident-0005 discipline): the fixture actually
      // has several active stores, so the double loop below isn't vacuous.
      expect(stores.length).toBeGreaterThanOrEqual(4);
      const before = computeNetWorth(w).total;

      for (const from of stores) {
        for (const to of stores) {
          if (from === to) continue;
          for (const good of GOOD_IDS) {
            const moved = moveOwnGoods(w, from, to, good, "max");
            const after = computeNetWorth(moved).total;
            expect(after).toBeCloseTo(before, 6);
          }
        }
      }
    },
  );
});
