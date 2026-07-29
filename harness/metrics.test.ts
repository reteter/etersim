import { describe, expect, it } from "vitest";
import type { Company, LedgerEvent } from "../src/sim/index.ts";
import { TICKS_PER_DAY } from "../src/sim/index.ts";
import {
  computeActiveContractLoad,
  computeChurn,
  computeCostLines,
  computeGoodsPnL,
  computeGuildStandings,
  computeHoldUtilization,
  computeMilestoneTimings,
  computeNetWorthCurve,
  computeRevenueLines,
  computeSettlementCounts,
  computeVoyages,
  reconcileThalers,
  signedThalers,
  type DaySnapshot,
} from "./metrics.ts";
import { MILESTONE_KINDS, THALER_MOVEMENT_KINDS } from "./ledgerKinds.ts";

/** Minimal fixtures — synthetic Ledger arrays, never a real Run's byte-exact
 *  numbers (incidents 0023/0024: no float precision pinned as a fixture).
 *  Each test's assertion is a behaviour contract on the fold, not a replayed
 *  engine number. */

describe("signedThalers — the one place the debit/credit direction is decided", () => {
  it("a trade sell is a credit, a trade buy a debit (both stored as positive magnitudes)", () => {
    const sell: LedgerEvent = { kind: "trade", tick: 1, shipId: "s0", portId: "p1", good: "grain", side: "sell", qty: 5, thalers: 50 };
    const buy: LedgerEvent = { kind: "trade", tick: 1, shipId: "s0", portId: "p1", good: "grain", side: "buy", qty: 5, thalers: 50 };
    expect(signedThalers(sell)).toBe(50);
    expect(signedThalers(buy)).toBe(-50);
  });

  it("a met contractFee is a credit to the Company (settleOne pays it out)", () => {
    const event: LedgerEvent = { kind: "contractFee", tick: 1, guildId: "agrarian", contractId: "c1", thalers: 30 };
    expect(signedThalers(event)).toBe(30);
  });

  it("every other thaler-carrying kind is a debit", () => {
    const dockingFee: LedgerEvent = { kind: "dockingFee", tick: 1, shipId: "s0", portId: "p1", thalers: 5 };
    const upkeep: LedgerEvent = { kind: "upkeep", tick: 1, shipId: "s0", thalers: 10 };
    const founding: LedgerEvent = { kind: "founding", tick: 1, portId: "p1", thalers: 300 };
    expect(signedThalers(dockingFee)).toBe(-5);
    expect(signedThalers(upkeep)).toBe(-10);
    expect(signedThalers(founding)).toBe(-300);
  });

  it("netWorth (a snapshot total) and a thalers-free kind both return null", () => {
    const netWorth: LedgerEvent = { kind: "netWorth", tick: 1, thalers: 500, cargoValue: 0, siteStoreValue: 0, buildingStoreValue: 0, total: 500 };
    const delivery: LedgerEvent = { kind: "delivery", tick: 1, shipId: "s0", portId: "p1", good: "grain", qty: 3 };
    expect(signedThalers(netWorth)).toBeNull();
    expect(signedThalers(delivery)).toBeNull();
  });
});

describe("computeCostLines", () => {
  it("sums each COST_KINDS entry as a negative total, and reports a zero-count kind at 0", () => {
    const ledger: LedgerEvent[] = [
      { kind: "dockingFee", tick: 1, shipId: "s0", portId: "p1", thalers: 5 },
      { kind: "dockingFee", tick: 2, shipId: "s0", portId: "p2", thalers: 5 },
      { kind: "upkeep", tick: 24, shipId: "s0", thalers: 10 },
    ];
    const lines = computeCostLines(ledger);
    const docking = lines.find((l) => l.kind === "dockingFee")!;
    const upkeep = lines.find((l) => l.kind === "upkeep")!;
    const rush = lines.find((l) => l.kind === "rush")!;
    expect(docking).toEqual({ kind: "dockingFee", thalers: -10, count: 2 });
    expect(upkeep).toEqual({ kind: "upkeep", thalers: -10, count: 1 });
    expect(rush).toEqual({ kind: "rush", thalers: 0, count: 0 });
  });

  it("every COST_KINDS entry is <= 0, even over a fixture exercising every cost kind plus a met contractFee (the invariant the doc comment claims)", () => {
    const ledger: LedgerEvent[] = [
      { kind: "dockingFee", tick: 1, shipId: "s0", portId: "p1", thalers: 5 },
      { kind: "upkeep", tick: 24, shipId: "s0", thalers: 10 },
      { kind: "laborFee", tick: 2, thalers: 100 },
      { kind: "enrollmentFee", tick: 3, guildId: "agrarian", thalers: 400 },
      { kind: "autoDraw", tick: 4, portId: "p1", good: "grain", qty: 5, thalers: 20 },
      { kind: "rush", tick: 5, portId: "p1", good: "grain", qty: 5, thalers: 30 },
      // contractFee is a *credit* (settleOne pays it to the Company on a met
      // settlement) — deliberately included here to prove it does not leak
      // into computeCostLines and flip the invariant.
      { kind: "contractFee", tick: 6, guildId: "agrarian", contractId: "c1", thalers: 999 },
    ];
    const lines = computeCostLines(ledger);
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) expect(line.thalers).toBeLessThanOrEqual(0);
    // Not vacuous: at least one line actually moved money.
    expect(lines.some((l) => l.thalers < 0)).toBe(true);
    // The credit is excluded entirely from the cost-line kind set.
    expect(lines.find((l) => l.kind === "contractFee")).toBeUndefined();
  });
});

describe("computeRevenueLines", () => {
  it("sums contractFee as a positive total — the credit computeCostLines must never carry", () => {
    const ledger: LedgerEvent[] = [
      { kind: "contractFee", tick: 1, guildId: "agrarian", contractId: "c1", thalers: 150 },
      { kind: "contractFee", tick: 2, guildId: "agrarian", contractId: "c2", thalers: 50 },
    ];
    const lines = computeRevenueLines(ledger);
    expect(lines).toEqual([{ kind: "contractFee", thalers: 200, count: 2 }]);
  });
});

describe("computeGoodsPnL", () => {
  it("nets sell revenue against buy cost per good, in GOOD_IDS order, other goods at zero", () => {
    const ledger: LedgerEvent[] = [
      { kind: "trade", tick: 1, shipId: "s0", portId: "p1", good: "grain", side: "buy", qty: 10, thalers: 40 },
      { kind: "trade", tick: 5, shipId: "s0", portId: "p2", good: "grain", side: "sell", qty: 10, thalers: 70 },
    ];
    const pnl = computeGoodsPnL(ledger);
    const grain = pnl.find((p) => p.good === "grain")!;
    expect(grain).toEqual({ good: "grain", boughtQty: 10, soldQty: 10, netThalers: 30 });
    expect(pnl.filter((p) => p.good !== "grain").every((p) => p.netThalers === 0 && p.boughtQty === 0 && p.soldQty === 0)).toBe(true);
  });
});

describe("computeVoyages", () => {
  it("counts dockingFee events fleet-wide and per ship", () => {
    const ledger: LedgerEvent[] = [
      { kind: "dockingFee", tick: 1, shipId: "s0", portId: "p1", thalers: 5 },
      { kind: "dockingFee", tick: 2, shipId: "s1", portId: "p2", thalers: 5 },
      { kind: "dockingFee", tick: 3, shipId: "s0", portId: "p3", thalers: 5 },
    ];
    expect(computeVoyages(ledger)).toEqual({ total: 3, byShip: { s0: 2, s1: 1 } });
  });

  it("a Run with no dockingFee events reports zero, not undefined (vacuity guard)", () => {
    expect(computeVoyages([])).toEqual({ total: 0, byShip: {} });
  });
});

describe("computeHoldUtilization", () => {
  it("averages used/hold per ship across samples, and the fleet mean weighs every ship equally", () => {
    const daily: DaySnapshot[] = [
      { day: 1, tick: 24, ships: [{ shipId: "s0", hold: 50, used: 25 }, { shipId: "s1", hold: 100, used: 100 }], activeContracts: 0 },
      { day: 2, tick: 48, ships: [{ shipId: "s0", hold: 50, used: 0 }, { shipId: "s1", hold: 100, used: 100 }], activeContracts: 0 },
    ];
    const { byShip, fleetMean } = computeHoldUtilization(daily);
    expect(byShip).toEqual([
      { shipId: "s0", meanUtilization: 0.25, samples: 2 },
      { shipId: "s1", meanUtilization: 1, samples: 2 },
    ]);
    // (0.25 + 1) / 2 = 0.625 — the two-ship fixture the package flags as
    // untested by gradientLoop (fleet policies are #443/Batch-time question).
    expect(fleetMean).toBeCloseTo(0.625, 10);
  });

  it("a ship absent from every sample reports zero utilization over zero samples", () => {
    expect(computeHoldUtilization([])).toEqual({ byShip: [], fleetMean: 0 });
  });
});

describe("computeActiveContractLoad", () => {
  it("carries the day/tick/count straight from each snapshot, in order", () => {
    const daily: DaySnapshot[] = [
      { day: 1, tick: 24, ships: [], activeContracts: 2 },
      { day: 2, tick: 48, ships: [], activeContracts: 3 },
    ];
    expect(computeActiveContractLoad(daily)).toEqual([
      { day: 1, tick: 24, count: 2 },
      { day: 2, tick: 48, count: 3 },
    ]);
  });
});

describe("computeNetWorthCurve", () => {
  it("reads only netWorth events, tagging them with a 1-based day index in emission order", () => {
    const ledger: LedgerEvent[] = [
      { kind: "trade", tick: 5, shipId: "s0", portId: "p1", good: "grain", side: "buy", qty: 1, thalers: 4 },
      { kind: "netWorth", tick: 24, thalers: 460, cargoValue: 40, siteStoreValue: 0, buildingStoreValue: 0, total: 500 },
      { kind: "netWorth", tick: 48, thalers: 600, cargoValue: 0, siteStoreValue: 0, buildingStoreValue: 0, total: 600 },
    ];
    expect(computeNetWorthCurve(ledger)).toEqual([
      { day: 1, tick: 24, thalers: 460, cargoValue: 40, siteStoreValue: 0, buildingStoreValue: 0, total: 500 },
      { day: 2, tick: 48, thalers: 600, cargoValue: 0, siteStoreValue: 0, buildingStoreValue: 0, total: 600 },
    ]);
  });
});

describe("computeGuildStandings", () => {
  it("accumulates pointsDelta into a trajectory, per guild, in ECONOMIC_ARCHETYPES order", () => {
    const ledger: LedgerEvent[] = [
      { kind: "settlement", tick: 24, contractId: "c1", guildId: "urban", outcome: "met", pointsDelta: 1 },
      { kind: "settlement", tick: 48, contractId: "c1", guildId: "urban", outcome: "met", pointsDelta: 1 },
      { kind: "settlement", tick: 24, contractId: "c2", guildId: "agrarian", outcome: "missed", pointsDelta: -1 },
    ];
    const finalGuilds: Company["guilds"] = { agrarian: { points: 0 }, urban: { points: 2 } };
    const standings = computeGuildStandings(ledger, finalGuilds);
    expect(standings.map((s) => s.guildId)).toEqual(["agrarian", "urban"]); // ECONOMIC_ARCHETYPES order
    const urban = standings.find((s) => s.guildId === "urban")!;
    expect(urban.trajectory).toEqual([{ tick: 24, points: 1 }, { tick: 48, points: 2 }]);
    expect(urban.finalPoints).toBe(2);
    expect(urban.finalRank).toBeGreaterThanOrEqual(1);
  });

  it("omits a guild neither enrolled nor ever settled", () => {
    expect(computeGuildStandings([], {})).toEqual([]);
  });
});

describe("computeSettlementCounts", () => {
  it("tallies every outcome, at 0 for one never seen", () => {
    const ledger: LedgerEvent[] = [
      { kind: "settlement", tick: 1, contractId: "c1", guildId: "urban", outcome: "met", pointsDelta: 1 },
      { kind: "settlement", tick: 2, contractId: "c2", guildId: "urban", outcome: "missed", pointsDelta: -1 },
      { kind: "settlement", tick: 3, contractId: "c3", guildId: "urban", outcome: "missed", pointsDelta: -1 },
    ];
    expect(computeSettlementCounts(ledger)).toEqual({ met: 1, missed: 2, breached: 0, resigned: 0 });
  });
});

describe("computeChurn", () => {
  it("counts a switch only on a *change* of buy good, and reports the run-length distribution", () => {
    const ledger: LedgerEvent[] = [
      { kind: "trade", tick: 1, shipId: "s0", portId: "p1", good: "grain", side: "buy", qty: 1, thalers: 1 },
      { kind: "trade", tick: 2, shipId: "s0", portId: "p1", good: "grain", side: "buy", qty: 1, thalers: 1 },
      { kind: "trade", tick: 3, shipId: "s0", portId: "p1", good: "textiles", side: "buy", qty: 1, thalers: 1 },
      { kind: "trade", tick: 4, shipId: "s0", portId: "p2", good: "grain", side: "sell", qty: 2, thalers: 5 }, // sells never count
      { kind: "trade", tick: 5, shipId: "s0", portId: "p1", good: "grain", side: "buy", qty: 1, thalers: 1 },
    ];
    // Sequence of buys: grain, grain, textiles, grain → run-lengths [2, 1, 1], 2 switches.
    expect(computeChurn(ledger)).toEqual({ switches: 2, runLengths: [2, 1, 1] });
  });

  it("a Run with no buys has zero switches and an empty distribution (not vacuously true of a Run with one buy)", () => {
    expect(computeChurn([])).toEqual({ switches: 0, runLengths: [] });
    const oneBuy: LedgerEvent[] = [
      { kind: "trade", tick: 1, shipId: "s0", portId: "p1", good: "grain", side: "buy", qty: 1, thalers: 1 },
    ];
    expect(computeChurn(oneBuy)).toEqual({ switches: 0, runLengths: [1] });
  });
});

describe("reconcileThalers", () => {
  it("zero drift when the purse delta exactly matches the signed Ledger sum", () => {
    const ledger: LedgerEvent[] = [
      { kind: "trade", tick: 1, shipId: "s0", portId: "p1", good: "grain", side: "buy", qty: 10, thalers: 40 },
      { kind: "trade", tick: 5, shipId: "s0", portId: "p2", good: "grain", side: "sell", qty: 10, thalers: 70 },
      { kind: "dockingFee", tick: 2, shipId: "s0", portId: "p1", thalers: 5 },
      { kind: "netWorth", tick: 24, thalers: 525, cargoValue: 0, siteStoreValue: 0, buildingStoreValue: 0, total: 525 },
    ];
    // 500 start -40 (buy) +70 (sell) -5 (docking) = 525.
    const result = reconcileThalers(ledger, 500, 525);
    expect(result).toEqual({ ledgerSum: 25, startThalers: 500, endThalers: 525, drift: 0 });
  });

  it("reports a non-zero drift honestly rather than absorbing it (adversarial: a purse move with no matching event)", () => {
    const ledger: LedgerEvent[] = [{ kind: "dockingFee", tick: 1, shipId: "s0", portId: "p1", thalers: 5 }];
    const result = reconcileThalers(ledger, 500, 400); // -100 unaccounted
    expect(result.drift).toBe(-95);
  });

  /**
   * #449 — the guard historically covered 3 of 10 thaler-movement kinds
   * because no real reference-policy Run reaches the building/guild kinds
   * (no policy founds a Headquarters, builds, enrolls or refits). This
   * fixture is synthetic on purpose (cheaper than a builder policy written
   * solely to exercise a guard).
   *
   * **Cases, not kinds** (wave-check finding N1): `trade` has two distinct
   * sign cases (`sell` a credit, `buy` a debit) and a fixture covering only
   * one of them lets a `buy`-side sign bug hide behind the older
   * `signedThalers`/`computeGoodsPnL` unit tests instead of this guard. Each
   * of the 11 cases below (10 kinds, `trade` split into `sell`/`buy`) appears
   * exactly once, at a distinct, known, non-zero amount, so a sign bug in any
   * single case is individually detectable — no other case's contribution
   * can cancel it.
   */
  describe("reconcileThalers over a synthetic fixture covering all ten THALER_MOVEMENT_KINDS / eleven sign cases (#449)", () => {
    /** One movement's known amount, its correct sign (independent oracle —
     *  must not read from `signedThalers`, or a real sign bug there would
     *  silently move the oracle too and the test below would stop being able
     *  to fail), and the event carrying it. */
    interface SignCase {
      readonly id: string;
      readonly kind: (typeof THALER_MOVEMENT_KINDS)[number];
      readonly amount: number;
      readonly expectedSign: 1 | -1;
      readonly event: LedgerEvent;
    }

    const CASES: readonly SignCase[] = [
      {
        id: "trade-sell",
        kind: "trade",
        amount: 111,
        expectedSign: 1, // a credit
        event: { kind: "trade", tick: 1, shipId: "s0", portId: "p1", good: "grain", side: "sell", qty: 1, thalers: 111 },
      },
      {
        id: "trade-buy",
        kind: "trade",
        amount: 77,
        expectedSign: -1, // a debit — the case the #233 fixture never reached
        event: { kind: "trade", tick: 1, shipId: "s1", portId: "p1", good: "grain", side: "buy", qty: 1, thalers: 77 },
      },
      {
        id: "dockingFee",
        kind: "dockingFee",
        amount: 7,
        expectedSign: -1,
        event: { kind: "dockingFee", tick: 2, shipId: "s0", portId: "p1", thalers: 7 },
      },
      { id: "upkeep", kind: "upkeep", amount: 13, expectedSign: -1, event: { kind: "upkeep", tick: 3, shipId: "s0", thalers: 13 } },
      { id: "laborFee", kind: "laborFee", amount: 29, expectedSign: -1, event: { kind: "laborFee", tick: 4, thalers: 29 } },
      {
        id: "enrollmentFee",
        kind: "enrollmentFee",
        amount: 41,
        expectedSign: -1,
        event: { kind: "enrollmentFee", tick: 5, guildId: "agrarian", thalers: 41 },
      },
      {
        id: "contractFee",
        kind: "contractFee",
        amount: 53,
        expectedSign: 1, // a credit (settleOne pays it to the Company)
        event: { kind: "contractFee", tick: 6, guildId: "agrarian", contractId: "c1", thalers: 53 },
      },
      {
        id: "autoDraw",
        kind: "autoDraw",
        amount: 17,
        expectedSign: -1,
        event: { kind: "autoDraw", tick: 7, portId: "p1", good: "grain", qty: 1, thalers: 17 },
      },
      { id: "rush", kind: "rush", amount: 19, expectedSign: -1, event: { kind: "rush", tick: 8, portId: "p1", good: "grain", qty: 1, thalers: 19 } },
      { id: "founding", kind: "founding", amount: 23, expectedSign: -1, event: { kind: "founding", tick: 9, portId: "p1", thalers: 23 } },
      {
        id: "refitStart",
        kind: "refitStart",
        amount: 31,
        expectedSign: -1,
        event: { kind: "refitStart", tick: 10, shipId: "s0", portId: "p1", thalers: 31 },
      },
    ];

    function buildFixtureLedger(): readonly LedgerEvent[] {
      return CASES.map((c) => c.event);
    }

    it("carries every THALER_MOVEMENT_KINDS entry — trade with both a sell and a buy case, every other kind once", () => {
      const ledger = buildFixtureLedger();
      for (const kind of THALER_MOVEMENT_KINDS) {
        const expectedCount = kind === "trade" ? 2 : 1;
        expect(ledger.filter((e) => e.kind === kind), `kind ${kind}`).toHaveLength(expectedCount);
      }
      expect(ledger.filter((e) => e.kind === "trade" && e.side === "sell")).toHaveLength(1);
      expect(ledger.filter((e) => e.kind === "trade" && e.side === "buy")).toHaveLength(1);
    });

    it("reconciles to zero drift — the known-good baseline every mutation below is compared against", () => {
      const ledger = buildFixtureLedger();
      const oracleSum = CASES.reduce((acc, c) => acc + c.expectedSign * c.amount, 0);
      const start = 1000;
      const end = start + oracleSum;
      const result = reconcileThalers(ledger, start, end);
      expect(result).toEqual({ ledgerSum: oracleSum, startThalers: start, endThalers: end, drift: 0 });
    });

    /**
     * The "prove the guard can fail" evidence (#449 AC), against the real
     * `reconcileThalers` — not a self-referential recomputation of
     * `signedThalers`. For each case `c`, `endWithFlippedC` is the purse
     * total the Company would show if every case settled at its
     * independently-known `expectedSign`, **except** `c`, which is (wrongly)
     * assumed flipped. `reconcileThalers` computes `ledgerSum` from the real,
     * correctly-signed `signedThalers` — so if production is correct,
     * `ledgerSum` disagrees with the flipped-`c` purse total by exactly
     * `2 * c.amount`, and `drift` is non-zero: this row passes only because
     * `signedThalers`' sign for `c` matches the oracle. If a future edit
     * flipped `signedThalers` for this case (including a `trade`/`side`
     * regression that only hits `buy`, not `sell` — N1's own gap, now its
     * own row), `ledgerSum` would equal the flipped-`c` total exactly,
     * `drift` would be 0, and **this row would go red** — the mechanical
     * proof the guard can fail, per sign case, not merely per kind.
     */
    it.each(CASES)("case $id: signedThalers matches the independent oracle, and a flip of just this case is caught as drift", (c) => {
      const ledger = buildFixtureLedger();
      // Direct per-case assertion: production's sign for this case, checked
      // against the oracle table above (not derived from signedThalers).
      expect(signedThalers(c.event)).toBe(c.expectedSign * c.amount);

      const oracleSum = CASES.reduce((acc, other) => acc + other.expectedSign * other.amount, 0);
      // Same total, but case `c`'s own contribution is negated — the
      // hypothetical purse total under a flipped sign for `c` alone.
      const flippedCContribution = oracleSum - 2 * c.expectedSign * c.amount;
      const start = 1000;
      const endWithFlippedC = start + flippedCContribution;
      const result = reconcileThalers(ledger, start, endWithFlippedC);
      expect(result.drift, `case ${c.id}: ${JSON.stringify(result)}`).not.toBe(0);
    });
  });
});

describe("computeMilestoneTimings (#446 — world-days to milestone)", () => {
  it("reports world-days = tick / TICKS_PER_DAY for every reached milestone, in MILESTONE_KINDS order", () => {
    const ledger: LedgerEvent[] = [
      { kind: "founding", tick: TICKS_PER_DAY * 2, portId: "p1", thalers: 300 },
      { kind: "launch", tick: TICKS_PER_DAY * 3, shipId: "s1", portId: "p1" },
    ];
    const timings = computeMilestoneTimings(ledger);
    expect(timings.map((t) => t.kind)).toEqual(MILESTONE_KINDS);

    const founding = timings.find((t) => t.kind === "founding")!;
    expect(founding).toEqual({ kind: "founding", reached: true, tick: TICKS_PER_DAY * 2, worldDays: 2 });

    const launch = timings.find((t) => t.kind === "launch")!;
    expect(launch).toEqual({ kind: "launch", reached: true, tick: TICKS_PER_DAY * 3, worldDays: 3 });
  });

  it("reports an unreached milestone as its own row (reached: false, worldDays: null) rather than omitting it", () => {
    const ledger: LedgerEvent[] = [{ kind: "founding", tick: TICKS_PER_DAY, portId: "p1", thalers: 300 }];
    const timings = computeMilestoneTimings(ledger);
    expect(timings).toHaveLength(MILESTONE_KINDS.length);
    const shipyardBuilt = timings.find((t) => t.kind === "shipyardBuilt")!;
    expect(shipyardBuilt).toEqual({ kind: "shipyardBuilt", reached: false, tick: null, worldDays: null });
  });

  it("an empty Ledger reports every milestone unreached (vacuity guard)", () => {
    const timings = computeMilestoneTimings([]);
    expect(timings).toHaveLength(MILESTONE_KINDS.length);
    expect(timings.every((t) => !t.reached && t.tick === null && t.worldDays === null)).toBe(true);
  });

  it("uses the first occurrence when a milestone kind repeats (e.g. two Storehouses completing)", () => {
    const ledger: LedgerEvent[] = [
      { kind: "completed", tick: TICKS_PER_DAY * 5, portId: "p1", buildingType: "storehouse" },
      { kind: "completed", tick: TICKS_PER_DAY * 9, portId: "p2", buildingType: "storehouse" },
    ];
    const completed = computeMilestoneTimings(ledger).find((t) => t.kind === "completed")!;
    expect(completed).toEqual({ kind: "completed", reached: true, tick: TICKS_PER_DAY * 5, worldDays: 5 });
  });
});
