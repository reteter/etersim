import { describe, expect, it } from "vitest";
import { CONSTRUCTION_RESERVE, HEADQUARTERS_COST } from "./building";
import { applyCommand } from "./commands";
import type { ActiveContract } from "./contract";
import { settleContracts } from "./contract";
import { computeNetWorth, regionAverageMid, type LedgerEvent } from "./ledger";
import { effectiveBase, price } from "./market";
import { shortestCourse } from "./pathfinding";
import { TICKS_PER_DAY, type MarketGood, type Port, type Region } from "./region";
import type { Route } from "./route";
import { GOOD_IDS, type GoodId } from "./goods";
import { emptyCargo, type Ship } from "./ship";
import { tick } from "./tick";
import { createWorld, type World } from "./world";

/**
 * docs/specs/E9-fleet-and-routes.md — Ledger. Unit-level tests for the
 * region-average mid price and net-worth formula, hand-computed against a
 * small fixed fixture (not `computeNetWorth` called twice — that only tests
 * determinism, not the formula, per incident-0005 discipline).
 */

function makeMarket(stock: number, equilibrium: number): Record<GoodId, MarketGood> {
  const market = {} as Record<GoodId, MarketGood>;
  for (const good of GOOD_IDS) market[good] = { stock, equilibrium };
  return market;
}

function makePort(id: string, stock: number, equilibrium: number, biasGrain: number): Port {
  const priceBias = {} as Record<GoodId, number>;
  for (const good of GOOD_IDS) priceBias[good] = 1;
  priceBias.grain = biasGrain;
  return {
    id,
    name: id,
    archetype: "agrarian",
    x: 0,
    y: 0,
    market: makeMarket(stock, equilibrium),
    priceBias,
  };
}

describe("regionAverageMid", () => {
  it("is the arithmetic mean of the marginal mid price across ports, at each port's own effective base", () => {
    // Two ports with different stock levels and price bias — hand-computed
    // grain mid at each, then averaged.
    const portA = makePort("A", 80, 100, 1.0); // below equilibrium => above base
    const portB = makePort("B", 100, 100, 1.2); // at equilibrium => exactly base

    const region: Region = { ports: [portA, portB], lanes: [] };

    const midA = price(portA.market.grain, effectiveBase(portA, "grain"));
    const midB = price(portB.market.grain, effectiveBase(portB, "grain"));
    const expected = (midA + midB) / 2;

    expect(regionAverageMid(region, "grain")).toBeCloseTo(expected, 10);
    // Sanity: hand-verify against the known price formula directly (not just
    // re-deriving from the same helper functions under test).
    // price = base * (equilibrium/stock)^0.75, clamped to [0.25, 4] * base.
    const base = 10 * 1.0; // GOODS.grain.basePrice * priceBias
    const rawA = base * (100 / 80) ** 0.75;
    expect(midA).toBeCloseTo(rawA, 6);
    const baseB = 10 * 1.2;
    expect(midB).toBeCloseTo(baseB, 6); // at equilibrium, price == base
  });

  it("returns 0 for a region with no ports", () => {
    expect(regionAverageMid({ ports: [], lanes: [] }, "grain")).toBe(0);
  });
});

describe("computeNetWorth", () => {
  it("hand-computed: thalers + cargo (at region-average mid) + site store (at region-average mid)", () => {
    const portA = makePort("A", 100, 100, 1.0); // at equilibrium, mid == base for every good
    const portB = makePort("B", 100, 100, 1.0);
    const region: Region = { ports: [portA, portB], lanes: [] };

    // Both ports at equilibrium with bias 1.0 => mid price == GOODS[good].basePrice exactly.
    const mids: Record<GoodId, number> = {
      grain: 10,
      textiles: 40,
      aetherSalt: 60,
      electronics: 150,
      timber: 250,
    };

    const base0 = createWorld(1);
    const laden: Ship = {
      ...base0.company.ships[0],
      cargo: { ...emptyCargo(), grain: 20, timber: 2 },
      location: { kind: "docked", portId: "A" },
    };
    const world: World = {
      ...base0,
      region,
      company: {
        ...base0.company,
        thalers: 1000,
        ships: [laden],
        headquarters: {
          portId: "A",
          buildOrder: { siteStore: { ...emptyCargo(), textiles: 5, aetherSalt: 3 } },
        },
      },
    };

    const expectedCargoValue = 20 * mids.grain + 2 * mids.timber;
    const expectedSiteStoreValue = 5 * mids.textiles + 3 * mids.aetherSalt;
    const expectedTotal = 1000 + expectedCargoValue + expectedSiteStoreValue;

    const result = computeNetWorth(world);
    expect(result.thalers).toBe(1000);
    expect(result.cargoValue).toBeCloseTo(expectedCargoValue, 6);
    expect(result.siteStoreValue).toBeCloseTo(expectedSiteStoreValue, 6);
    expect(result.total).toBeCloseTo(expectedTotal, 6);
  });

  it("ships and buildings carry no book value: an empty fleet with no build is worth exactly its thalers", () => {
    const base0 = createWorld(2);
    const world: World = { ...base0, company: { ...base0.company, thalers: 777, ships: [] } };
    expect(computeNetWorth(world)).toEqual({
      thalers: 777,
      cargoValue: 0,
      siteStoreValue: 0,
      total: 777,
    });
  });

  it("values cargo aboard an underway ship the same way (region-average, not port-of-origin)", () => {
    const base0 = createWorld(3);
    const underwayShip: Ship = {
      ...base0.company.ships[0],
      cargo: { ...emptyCargo(), grain: 10 },
      location: {
        kind: "underway",
        course: [],
        voyageIndex: 0,
        voyageProgressTicks: 0,
        destination: base0.region.ports[0].id,
      },
    };
    const world: World = { ...base0, company: { ...base0.company, ships: [underwayShip] } };
    const expectedGrainMid = regionAverageMid(world.region, "grain");
    expect(computeNetWorth(world).cargoValue).toBeCloseTo(10 * expectedGrainMid, 6);
  });
});

/** Ship docked at `portId` with `thalers` in the purse — the scripted-run fixture. */
function seedAt(seedStr: string, portId: string, thalers: number): World {
  const w = createWorld(seedStr);
  const ship: Ship = { ...w.company.ships[0], location: { kind: "docked", portId } };
  return { ...w, company: { ...w.company, thalers, ships: [ship] } };
}

describe("Ledger wiring — exactly one event per mutation (scripted manual run)", () => {
  it("reconstructs the exact final purse from the Ledger alone (no double-counting, no gaps)", () => {
    const base = createWorld("ledger-count");
    const lane = base.region.lanes[0];
    const { a, b } = { a: lane.a, b: lane.b };
    const startingThalers = 1000;
    let w = seedAt("ledger-count", a, startingThalers);
    const shipId = w.company.ships[0].id;

    // Two buys at A.
    w = tick(w, [{ kind: "buy", shipId, good: "grain", qty: 5 }]);
    w = tick(w, [{ kind: "buy", shipId, good: "grain", qty: 3 }]);

    // Sail to B (one docking fee on arrival), then sell everything.
    w = tick(w, [{ kind: "sailTo", shipId, portId: b }]);
    let guard = 0;
    while (w.company.ships[0].location.kind !== "docked" && guard++ < 500) w = tick(w, []);
    const cargoAtB = w.company.ships[0].cargo.grain;
    expect(cargoAtB).toBeGreaterThan(0);
    w = tick(w, [{ kind: "sell", shipId, good: "grain", qty: cargoAtB }]);

    // Sail back to A (a second docking fee).
    w = tick(w, [{ kind: "sailTo", shipId, portId: a }]);
    guard = 0;
    while (w.company.ships[0].location.kind !== "docked" && guard++ < 500) w = tick(w, []);

    const tradeEvents = w.ledger.filter((e) => e.kind === "trade");
    const feeEvents = w.ledger.filter((e) => e.kind === "dockingFee");
    expect(tradeEvents.length).toBe(3); // 2 buys + 1 sell, exactly
    expect(feeEvents.length).toBe(2); // arrival at B, arrival at A, exactly

    // Independent reconciliation: replaying only the Ledger's thaler-moving
    // events from the known starting purse must equal the actual final purse
    // — the "every mutation ⇒ exactly one event, no drift" acceptance
    // criterion, checked end-to-end rather than by event count alone.
    const reconciled = w.ledger.reduce((sum, e) => {
      switch (e.kind) {
        case "trade":
          return sum + (e.side === "buy" ? -e.thalers : e.thalers);
        case "dockingFee":
        case "laborFee":
        case "founding":
        case "autoDraw":
        case "rush":
        case "upkeep":
          return sum - e.thalers;
        default:
          return sum;
      }
    }, startingThalers);
    expect(reconciled).toBe(w.company.thalers);
  });
});

describe("Economics guardrail (docs/specs/E9-fleet-and-routes.md — Testing)", () => {
  // PAYBACK_WINDOW_DAYS (E12 re-anchoring, was #147): under HEARTLAND v2,
  // this test's fixture (seed 42 — a *different* generated region than v1's
  // seed 42; the freeport slot alone shifts every later RNG draw) needs more
  // world days than v1's 40-day bound to pay back the second hull. Net worth
  // isn't monotonic day to day (an underway ship's unsold cargo is marked to
  // the region-average mid, which drifts tick to tick), so "first day payback
  // crosses the cost" is noisy — measured directly over 80 days, payback
  // crosses the cost at day 44 but still dips below it on 4 of the next 9
  // days, only becoming durably true from day 53 on. 60 keeps a full week of
  // margin past that durable point.
  //
  // Seed 42 is the *healthy reference lane*. Payback is lane-conditional by
  // Market impact (#152 grill, 2026-07-14 — resolved; CONTEXT.md "Market
  // impact", E9 spec — Pacing): a second hull on the same route walks the same
  // marginal buy/sell prices, compressing that route's margin. Across
  // [1, 7, 42, 99] the two-ship payback is ~40–60 days on the three healthy
  // lanes (seeds 7/42/99) but ~175+ on seed 1, whose single-ship margin (~84%)
  // is the thinnest of the four and collapses to ~21% with two hulls. That is NOT a
  // bug and NOT the phase-synchronization once hypothesized here (staggering
  // the second hull's launch 0–13 days barely moves seed 1: ~200→~178) — it
  // is the designed diminishing return of concentrating volume on one lane.
  // The property test below locks that mechanic so a future change can't
  // silently remove it.
  const PAYBACK_WINDOW_DAYS = 60;

  it("a scripted 2-ship producer→consumer loop recoups the second hull's cost within the payback window of its launch", () => {
    // "the standard seed" — 42 is the canonical seed shared by the E8 economy
    // guardrail suite (economy.test.ts SEEDS).
    const SEED = 42;
    const base = createWorld(SEED);

    // grain/agrarian→urban is the region's cleanest single-good gradient
    // (economy.test.ts — exactly one producer archetype, and urban is the
    // highest-consuming, highest-bias neighbor): the fairest "does this
    // route's economics support a second hull" scenario, not a cherry-picked
    // best case.
    const good: GoodId = "grain";
    const producer = base.region.ports.find((p) => p.archetype === "agrarian")!;
    const consumer = base.region.ports.find((p) => p.archetype === "urban")!;
    expect(shortestCourse(base.region, producer.id, consumer.id)).not.toBeNull();

    const route: Route = {
      id: "loop",
      name: "loop",
      stops: [
        { portId: producer.id, orders: [{ kind: "buy", good }] },
        { portId: consumer.id, orders: [{ kind: "sell", good }] },
      ],
    };

    // Found the Headquarters at a THIRD port (neither the route's producer
    // nor its consumer) — founding at the producer would have auto-draw's
    // grain purchases (the recipe needs grain too) compete with the route's
    // own buy leg for the same local stock, cannibalizing the very economics
    // under test. A real player would make the same call ("build near cheap
    // materials, run loops elsewhere").
    const hqPort = base.region.ports.find(
      (p) => p.id !== producer.id && p.id !== consumer.id,
    )!;

    // Fund generously so founding + auto-draw never stalls on the purse — the
    // guardrail is about route payback economics after launch, not the early
    // manual-trading grind to ₸2,500 (that pacing is covered by E8 playtest
    // evidence and the spec's separate "Headquarters ~day 20-30" target).
    let w: World = {
      ...base,
      company: { ...base.company, thalers: 30_000, routes: [route] },
    };
    const s0Id = w.company.ships[0].id;
    // s0 starts the loop immediately (docked at the producer, wherever
    // createWorld happened to place it, is irrelevant — the route pass
    // redirects it to Stop 0 on the first tick).
    w = {
      ...w,
      company: {
        ...w.company,
        ships: [{ ...w.company.ships[0], location: { kind: "docked", portId: producer.id } }],
      },
    };
    w = tick(w, [
      { kind: "foundHeadquarters", portId: hqPort.id },
      { kind: "assignRoute", shipId: s0Id, routeId: "loop" },
    ]);
    w = tick(w, [{ kind: "placeBuildOrder" }]);

    // Drive the build to completion via auto-draw alone (near-equilibrium
    // cost — rush's marginal-walk-plus-spread premium would inflate "recipe
    // market cost" beyond what the spec's balance table assumes).
    let guard = 0;
    while (w.company.headquarters?.buildOrder && guard++ < 5000) {
      w = tick(w, []);
    }
    expect(w.company.headquarters?.buildOrder).toBeUndefined(); // launched
    expect(w.company.ships).toHaveLength(2);

    // The actual cost of the second hull, read straight from the Ledger:
    // labor fee + every autoDraw purchase (no rush was used).
    const buildCost = w.ledger.reduce((sum, e) => {
      if (e.kind === "laborFee" || e.kind === "autoDraw") return sum + e.thalers;
      return sum;
    }, 0);
    expect(buildCost).toBeGreaterThan(0);

    const s1 = w.company.ships[1];
    w = tick(w, [{ kind: "assignRoute", shipId: s1.id, routeId: "loop" }]);

    const netWorthAtLaunch = computeNetWorth(w);
    for (let day = 0; day < PAYBACK_WINDOW_DAYS; day++) {
      for (let t = 0; t < TICKS_PER_DAY; t++) w = tick(w, []);
    }
    const netWorthAfter = computeNetWorth(w);

    const payback = netWorthAfter.total - netWorthAtLaunch.total;
    expect(payback).toBeGreaterThanOrEqual(buildCost);
  });

  // Market impact property (#152 grill, 2026-07-14): locks the designed
  // diminishing return so a future change can't silently remove it. On the
  // healthy reference lane (seed 42) a second hull on the *same* route must
  // (a) still add net profit — scaling a good lane is rewarded — yet (b) earn a
  // lower per-unit margin than one ship, because both ships walk the same
  // marginal buy/sell prices against each other (CONTEXT.md "Market impact";
  // E9 spec — Pacing).
  it("a second hull on a healthy lane adds net profit but at a compressed per-unit margin (Market impact)", () => {
    const SEED = 42;
    const good: GoodId = "grain";
    const WINDOW_DAYS = 90;

    const runShips = (nShips: number) => {
      const base = createWorld(SEED);
      const producer = base.region.ports.find((p) => p.archetype === "agrarian")!;
      const consumer = base.region.ports.find((p) => p.archetype === "urban")!;
      const route: Route = {
        id: "loop",
        name: "loop",
        stops: [
          { portId: producer.id, orders: [{ kind: "buy", good }] },
          { portId: consumer.id, orders: [{ kind: "sell", good }] },
        ],
      };
      const extras = Array.from({ length: nShips - 1 }, (_, i) => ({
        ...base.company.ships[0],
        id: `market-impact-probe-${i + 1}`,
      }));
      const ships = [base.company.ships[0], ...extras].map((s) => ({
        ...s,
        location: { kind: "docked" as const, portId: producer.id },
      }));
      let w: World = {
        ...base,
        company: { ...base.company, thalers: 30_000, routes: [route], ships },
      };
      w = tick(
        w,
        ships.map((s) => ({ kind: "assignRoute" as const, shipId: s.id, routeId: "loop" })),
      );
      const start = w.ledger.length;
      for (let day = 0; day < WINDOW_DAYS; day++) {
        for (let t = 0; t < TICKS_PER_DAY; t++) w = tick(w, []);
      }
      let buySpend = 0;
      let buyQty = 0;
      let sellRevenue = 0;
      let sellQty = 0;
      for (const e of w.ledger.slice(start)) {
        if (e.kind !== "trade" || e.good !== good) continue;
        if (e.side === "buy") {
          buySpend += e.thalers;
          buyQty += e.qty;
        } else {
          sellRevenue += e.thalers;
          sellQty += e.qty;
        }
      }
      const avgBuy = buySpend / buyQty;
      const avgSell = sellRevenue / sellQty;
      return { profit: sellRevenue - buySpend, margin: (avgSell - avgBuy) / avgBuy };
    };

    const one = runShips(1);
    const two = runShips(2);

    // (a) scaling a healthy lane is rewarded: two hulls out-earn one.
    expect(two.profit).toBeGreaterThan(one.profit);
    // (b) but at a compressed per-unit margin — the trades move the price
    //     against themselves (Market impact).
    expect(two.margin).toBeLessThan(one.margin);
  });
});

/**
 * Ledger grammar law (issue #203, CONTEXT.md — Ledger; ledger.ts module
 * comment): every thaler-moving kind carries `thalers`; every rank-moving
 * kind carries `pointsDelta`. `netWorth` is a daily *snapshot*, not a
 * movement — it carries `thalers` as part of its payload (the issue #203
 * audit's "9 kinds carry thalers" count includes it), so it is classified
 * with the thalers-carrying group for the field-presence assertion below;
 * the CONTEXT.md law itself is a one-way implication ("moving ⇒ carries")
 * that a snapshot doesn't violate.
 *
 * `KIND_CATEGORY` is a `Record` keyed by the full `LedgerEvent["kind"]`
 * union — TypeScript rejects the object literal if a key is missing, so a
 * new `LedgerEvent` kind added without updating this table fails to
 * typecheck (readable message: tsc's own "Property '<kind>' is missing").
 * The runtime test below is a secondary, belt-and-braces check that a
 * scripted run's actually emitted events match the table — not the source
 * of exhaustiveness itself.
 */
type LedgerGrammarCategory = "thalers" | "pointsDelta" | "neither";

const KIND_CATEGORY: Record<LedgerEvent["kind"], LedgerGrammarCategory> = {
  trade: "thalers",
  dockingFee: "thalers",
  autoDraw: "thalers",
  rush: "thalers",
  delivery: "neither",
  laborFee: "thalers",
  founding: "thalers",
  launch: "neither",
  netWorth: "thalers",
  enrollmentFee: "thalers",
  upkeep: "thalers",
  contractFee: "thalers",
  settlement: "pointsDelta",
};

/** Drives a world through every LedgerEvent kind via real Commands and tick
 *  phases — not hand-written literals (incident-0005 discipline: a
 *  guardrail that only inspects its own fixtures can't fail). `settlement`
 *  and `contractFee` are the one exception: reaching a "met" settlement
 *  through the full shortage/fulfilment economy would need a much larger
 *  script, so an already-due, quota-met `ActiveContract` is rigged directly
 *  and run through the real `settleContracts` — the exact seam the day
 *  boundary calls — rather than through a hand-written Ledger literal. */
function scriptedAllKindsWorld(): World {
  const base = createWorld("ledger-grammar-203");
  const portA = base.region.ports[0].id;
  const portB = base.region.ports.find((p) => p.id !== portA)!.id;
  const shipId = base.company.ships[0].id;

  let w: World = {
    ...base,
    company: {
      ...base.company,
      thalers: HEADQUARTERS_COST + CONSTRUCTION_RESERVE + 100_000,
      ships: [{ ...base.company.ships[0], location: { kind: "docked", portId: portA } }],
    },
  };

  // trade (buy) — grain aboard s0, spent later on `deliver` (hold is 50 —
  // stay under it).
  w = applyCommand(w, { kind: "buy", shipId, good: "grain", qty: 40 });

  // dockingFee — sail to B and back, driving ticks until each arrival.
  w = applyCommand(w, { kind: "sailTo", shipId, portId: portB });
  let guard = 0;
  while (w.company.ships[0].location.kind !== "docked" && guard++ < 2000) w = tick(w, []);
  w = applyCommand(w, { kind: "sailTo", shipId, portId: portA });
  guard = 0;
  while (w.company.ships[0].location.kind !== "docked" && guard++ < 2000) w = tick(w, []);

  w = applyCommand(w, { kind: "foundHeadquarters", portId: portA }); // founding
  w = applyCommand(w, { kind: "placeBuildOrder" }); // laborFee
  w = applyCommand(w, { kind: "deliver", shipId, good: "grain" }); // delivery

  // rush — a deliberately small budget buys only a partial line, leaving the
  // rest of the recipe for auto-draw (both kinds must fire from one build).
  const fundedThalers = w.company.thalers;
  w = { ...w, company: { ...w.company, thalers: CONSTRUCTION_RESERVE + 50 } };
  w = applyCommand(w, { kind: "rushBuild" }); // rush
  w = { ...w, company: { ...w.company, thalers: fundedThalers } };

  // autoDraw + launch — tick until the recipe completes.
  guard = 0;
  while (w.company.headquarters?.buildOrder && guard++ < 5000) w = tick(w, []);
  expect(w.company.ships.length).toBeGreaterThan(1); // precondition: actually launched

  // netWorth + upkeep — a few more day boundaries.
  for (let i = 0; i < 3 * TICKS_PER_DAY; i++) w = tick(w, []);

  w = applyCommand(w, { kind: "enroll", guildId: "agrarian" }); // enrollmentFee

  const activeContract: ActiveContract = {
    id: "grammar-test-contract",
    guildId: "agrarian",
    portId: portA,
    good: "grain",
    quotaPerPeriod: 1,
    periodDays: 1,
    minPeriods: 1,
    feePerPeriod: 50,
    tier: 1,
    basis: { sourcePortId: portA, roundTripTicks: 10, expectedTrips: 1 },
    startTick: 0,
    periodIndex: 0,
    deliveredThisPeriod: 1, // meets quota
    consecutiveMisses: 0,
  };
  w = { ...w, company: { ...w.company, contracts: [activeContract] } };
  w = settleContracts(w); // settlement (met) + contractFee

  return w;
}

describe("Ledger grammar law (issue #203)", () => {
  it("classifies every LedgerEvent kind — an unclassified new kind fails to typecheck (Record<LedgerEvent['kind'], Category>)", () => {
    const kinds = Object.keys(KIND_CATEGORY);
    expect(new Set(kinds).size).toBe(kinds.length); // no accidental duplicate keys
  });

  it("a scripted run touching every kind carries thalers/pointsDelta exactly per its classification, and hits every kind at least once", () => {
    const world = scriptedAllKindsWorld();
    const seenKinds = new Set<string>();

    for (const event of world.ledger) {
      seenKinds.add(event.kind);
      const category = KIND_CATEGORY[event.kind];
      const record = event as unknown as Record<string, unknown>;
      if (category === "thalers") {
        expect(typeof record.thalers, `${event.kind} must carry a numeric thalers`).toBe("number");
        expect(record.pointsDelta, `${event.kind} must not carry pointsDelta`).toBeUndefined();
      } else if (category === "pointsDelta") {
        expect(typeof record.pointsDelta, `${event.kind} must carry a numeric pointsDelta`).toBe(
          "number",
        );
        expect(record.thalers, `${event.kind} must not carry thalers`).toBeUndefined();
      } else {
        expect(record.thalers, `${event.kind} must not carry thalers`).toBeUndefined();
        expect(record.pointsDelta, `${event.kind} must not carry pointsDelta`).toBeUndefined();
      }
    }

    // Vacuous-truth guard (incident-0005): the scripted run must have
    // actually produced every classified kind, not merely never contradicted
    // an empty or partial ledger.
    expect(seenKinds).toEqual(new Set(Object.keys(KIND_CATEGORY)));
  });
});
