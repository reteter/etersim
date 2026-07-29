import { describe, expect, it } from "vitest";
import { advanceDays, createWorld, ECONOMIC_ARCHETYPES, TICKS_PER_DAY } from "../src/sim/index.ts";
import { reconcileThalers, type MilestoneTiming, type RunMetrics } from "./metrics.ts";
import { aggregateMilestones, aggregateStat, runBatchRun, runOne, runPolicyBatch, type RunRecord } from "./batch.ts";
import { parseSeeds } from "./runCommand.ts";
import { gradientLoop } from "./policies/gradientLoop.ts";
import { doNothing } from "./policies/doNothing.ts";
import { MILESTONE_KINDS } from "./ledgerKinds.ts";
import { buildReport } from "./report.ts";

const DAYS = 30;

/** Minimal, fully-synthetic RunRecord for `aggregateMilestones` tests — every
 *  milestone unreached except `founding`, which is reached at `foundingTick`
 *  (or unreached when `null`). Every other `RunMetrics` field is a zero
 *  value; `aggregateMilestones` reads only `metrics.milestoneTimings`. */
function fakeRunRecord(seed: number, foundingTick: number | null): RunRecord {
  const milestoneTimings: readonly MilestoneTiming[] = MILESTONE_KINDS.map((kind) =>
    kind === "founding" && foundingTick !== null
      ? { kind, reached: true, tick: foundingTick, worldDays: foundingTick / TICKS_PER_DAY }
      : { kind, reached: false, tick: null, worldDays: null },
  );
  const zeroNetWorth = { thalers: 0, cargoValue: 0, siteStoreValue: 0, buildingStoreValue: 0, total: 0 };
  const metrics: RunMetrics = {
    days: 10,
    netWorthStart: zeroNetWorth,
    netWorthEnd: zeroNetWorth,
    profitPerDay: 0,
    netWorthCurve: [],
    costLines: [],
    revenueLines: [],
    voyages: { total: 0, byShip: {} },
    holdUtilization: { byShip: [], fleetMean: 0 },
    goodsPnL: [],
    churn: { switches: 0, runLengths: [] },
    guildStandings: [],
    settlementCounts: { met: 0, missed: 0, breached: 0, resigned: 0 },
    activeContractLoad: [],
    reconciliation: { ledgerSum: 0, startThalers: 0, endThalers: 0, drift: 0 },
    milestoneTimings,
  };
  return {
    policy: "doNothing",
    params: {},
    seed,
    days: 10,
    replayCommand: "n/a",
    ledger: [],
    metrics,
    anomalies: [],
  };
}

describe("runBatchRun — day-chunked, but tick-for-tick identical to the one-shot seam", () => {
  it("produces the same end World as advanceDays(world, days, decide) called once (doNothing)", () => {
    const start = createWorld(5);
    const chunked = runBatchRun(start, doNothing, DAYS);
    const oneShot = advanceDays(start, DAYS);
    expect(chunked.world).toEqual(oneShot);
  });

  it("produces the same end World as one continuous decide loop (gradientLoop, a policy with memory and Commands)", () => {
    const start = createWorld(5);
    const policy = gradientLoop();
    const chunked = runBatchRun(start, policy, DAYS);

    let memory = policy.init(start);
    const oneShot = advanceDays(start, DAYS, (w) => {
      const step = policy.act(w, memory);
      memory = step.memory;
      return step.commands;
    });

    expect(chunked.world).toEqual(oneShot);
    expect(chunked.memory).toEqual(memory);
    // Non-vacuous: the Run actually traded (incident 0005 discipline).
    expect(chunked.world.ledger.some((e) => e.kind === "trade")).toBe(true);
  });

  it("samples exactly one fleet snapshot per day, in order", () => {
    const chunked = runBatchRun(createWorld(5), gradientLoop(), DAYS);
    expect(chunked.daily).toHaveLength(DAYS);
    expect(chunked.daily.map((d) => d.day)).toEqual(Array.from({ length: DAYS }, (_, i) => i + 1));
  });
});

describe("runOne — determinism (spec §Testing: same policy + seed + days ⇒ byte-equal Ledger)", () => {
  it("re-running the same Run twice produces byte-equal Ledgers and an identical (deep-equal) report", () => {
    const first = runOne("gradientLoop", {}, 7, DAYS);
    const second = runOne("gradientLoop", {}, 7, DAYS);

    // Vacuity guard: the Run actually did something before checking equality of it.
    expect(first.ledger.some((e) => e.kind === "trade" && e.side === "buy")).toBe(true);
    expect(first.ledger.some((e) => e.kind === "trade" && e.side === "sell")).toBe(true);
    expect(first.ledger.filter((e) => e.kind === "dockingFee").length).toBeGreaterThanOrEqual(2);
    expect(first.metrics.profitPerDay).not.toBe(0);

    expect(JSON.stringify(second.ledger)).toBe(JSON.stringify(first.ledger));
    expect(second.metrics).toEqual(first.metrics);
    expect(second.replayCommand).toBe(first.replayCommand);
  });

  it("a different seed changes the Ledger (the equality above is not testing a constant)", () => {
    const a = runOne("gradientLoop", {}, 1, DAYS);
    const b = runOne("gradientLoop", {}, 2, DAYS);
    expect(JSON.stringify(b.ledger)).not.toBe(JSON.stringify(a.ledger));
  });

  it("reconciles every thaler movement against the Company's own purse delta (finding, not an assumption)", () => {
    for (const seed of [1, 7, 42]) {
      const run = runOne("gradientLoop", {}, seed, DAYS);
      const recon = reconcileThalers(
        run.ledger,
        run.metrics.netWorthStart.thalers,
        run.metrics.netWorthEnd.thalers,
      );
      expect(recon.drift, `seed ${seed}: ${JSON.stringify(recon)}`).toBe(0);
    }
  });

  it("doNothing's replay command has no --params flag and its --seeds value round-trips to exactly the one seed", () => {
    const run = runOne("doNothing", {}, 3, DAYS);
    expect(run.replayCommand).not.toContain("--params");
    const seedsFlag = /--seeds ([^ ]+)/.exec(run.replayCommand)![1];
    // The bug this guards: a bare "--seeds 3" parses as seeds 1..3, not seed 3.
    expect(parseSeeds(seedsFlag)).toEqual([3]);
  });

  it("gradientLoop's replay command carries --params and the same --seeds round-trip guarantee", () => {
    const run = runOne("gradientLoop", { good: "grain" }, 12, DAYS);
    expect(run.replayCommand).toContain(`--params '${JSON.stringify({ good: "grain" })}'`);
    const seedsFlag = /--seeds ([^ ]+)/.exec(run.replayCommand)![1];
    expect(parseSeeds(seedsFlag)).toEqual([12]);
  });

  it("rejects an unknown policy name", () => {
    expect(() => runOne("notAPolicy", {}, 1, DAYS)).toThrow(/Unknown policy/);
  });
});

describe("runOne -> buildReport — the anomaly-list wiring (#234)", () => {
  it("a deliberately-broken World fixture's invariant violation appears in the flattened report anomalies, not just in checkInvariants isolation", () => {
    // Deliberately-broken World: one ContractOffer with tier 99, outside the
    // documented [1, 4] range (`checkTierRange`, harness/invariants.ts).
    // Constructed directly rather than via natural offer generation — the
    // point of this test is the wiring downstream of checkInvariants
    // (runOne -> RunRecord.anomalies -> buildReport's flattened list), which
    // harness/invariants.test.ts's isolated checkInvariants(...) calls never
    // exercise, not the offer-generation logic itself.
    const seed = 1;
    const base = createWorld(seed);
    const [port] = base.region.ports;
    if (port === undefined) throw new Error("fixture requires at least one port");

    const brokenOffer = {
      id: "test:broken:offer",
      guildId: ECONOMIC_ARCHETYPES[0]!, // any real guild id — a "freeport" port has none
      portId: port.id,
      good: "grain" as const,
      quotaPerPeriod: 1,
      periodDays: 1,
      minPeriods: 1,
      feePerPeriod: 1,
      tier: 99,
      requiredRank: 1,
      // expectedTrips: 2 keeps this offer haulability-clean (checkOfferHaulability
      // needs >= 2) so this fixture trips exactly the one deliberate violation
      // (tier 99) and not an incidental second one.
      basis: { sourcePortId: port.id, roundTripTicks: 10, expectedTrips: 2 },
    };
    // Craters this port's grain stock to below the shortage threshold so
    // `refreshContractOffers` (`src/sim/contract.ts`) treats the broken
    // offer as a surviving offer at the next day boundary instead of
    // dropping it before checkInvariants ever sees it (`survivors` filter:
    // an offer only survives if its (port, good) is still short).
    const craterMarket = { ...port.market, grain: { ...port.market.grain, stock: 0 } };
    const craterPort = { ...port, market: craterMarket };
    const craterPorts = base.region.ports.map((p) => (p.id === port.id ? craterPort : p));
    const brokenWorld = {
      ...base,
      region: { ...base.region, ports: craterPorts },
      contractOffers: [brokenOffer],
    };

    const record = runOne("doNothing", {}, seed, 1, { enableAssertions: true, world0: brokenWorld });

    expect(record.anomalies).not.toHaveLength(0);
    expect(record.anomalies[0]!.reason).toContain("Tier range violation");
    expect(record.anomalies[0]!.reason).toContain("Day 1");

    const aggregate = {
      profitPerDay: aggregateStat([record.metrics.profitPerDay]),
      voyages: aggregateStat([record.metrics.voyages.total]),
      fleetHoldUtilization: aggregateStat([record.metrics.holdUtilization.fleetMean]),
      netWorthEnd: aggregateStat([record.metrics.netWorthEnd.total]),
      milestoneDays: aggregateMilestones([record]),
    };
    const report = buildReport(
      [{ policy: "doNothing", params: {}, seeds: [seed], days: 1, runs: [record], aggregate }],
      1,
    );

    // The gap this closes: report.json's anomalies must actually contain
    // what checkInvariants found, flattened across every Run — not `[]`
    // because nothing wired the checks into a real Run.
    expect(report.anomalies).toHaveLength(1);
    expect(report.anomalies[0]!.reason).toContain("Tier range violation");
    expect(report.anomalies[0]!.policy).toBe("doNothing");
    expect(report.anomalies[0]!.seed).toBe(seed);
  });

  it("a healthy Run with assertions enabled reports zero anomalies (not because the checks never ran)", () => {
    const record = runOne("doNothing", {}, 42, DAYS, { enableAssertions: true });
    expect(record.anomalies).toEqual([]);
  });
});

describe("runPolicyBatch — N Runs over a seed grid, aggregated", () => {
  it("runs one Run per seed and aggregates profit/day, voyages, hold utilization and final net worth", () => {
    const seeds = [1, 7, 42];
    const batch = runPolicyBatch("gradientLoop", {}, seeds, DAYS);

    expect(batch.runs).toHaveLength(3);
    expect(batch.runs.map((r) => r.seed)).toEqual(seeds);

    const profits = batch.runs.map((r) => r.metrics.profitPerDay).sort((a, b) => a - b);
    expect(batch.aggregate.profitPerDay.min).toBe(profits[0]);
    expect(batch.aggregate.profitPerDay.max).toBe(profits[2]);
    expect(batch.aggregate.profitPerDay.median).toBe(profits[1]);
  });

  it("an even seed count medians the middle two, not one arbitrarily", () => {
    const batch = runPolicyBatch("doNothing", {}, [1, 2], DAYS);
    const [a, b] = batch.runs.map((r) => r.metrics.profitPerDay).sort((x, y) => x - y);
    expect(batch.aggregate.profitPerDay.median).toBeCloseTo((a + b) / 2, 10);
  });

  describe("aggregate.milestoneDays (#446 — world-days to milestone, a distribution across seeds)", () => {
    it("one row per MILESTONE_KINDS entry, in canonical order, whether or not any seed reached it", () => {
      const batch = runPolicyBatch("doNothing", {}, [1, 2, 3], DAYS);
      expect(batch.aggregate.milestoneDays.map((m) => m.kind)).toEqual([
        "founding",
        "launch",
        "shipyardBuilt",
        "refitStart",
        "refitComplete",
        "completed",
      ]);
      // doNothing never founds a Headquarters — every milestone unreached by
      // every seed (vacuity guard: this is a real, checked fact, not assumed).
      for (const row of batch.aggregate.milestoneDays) {
        expect(row.reachedSeeds).toBe(0);
        expect(row.totalSeeds).toBe(3);
        // wave-check B1: unreached must be unrepresentable as a number, never
        // aggregateStat([])'s {median:0,min:0,max:0} — a consumer reading
        // .worldDays.median without checking reachedSeeds would otherwise
        // read "reached at world-day 0", not "never reached".
        expect(row.worldDays).toBeNull();
      }
    });

    it("medians world-days only across the seeds that actually reached the milestone", () => {
      // Hand-built RunRecords (not a real Run) so "reached by some seeds, not
      // others" is exercised deliberately, without depending on which
      // milestones a reference policy happens to reach (incident 0005: don't
      // let a real Run's accidental coverage stand in for a fixture shaped
      // on purpose).
      const runs = [fakeRunRecord(1, 24), fakeRunRecord(2, 48), fakeRunRecord(3, null)];
      const rows = aggregateMilestones(runs);
      const founding = rows.find((m) => m.kind === "founding")!;
      expect(founding.reachedSeeds).toBe(2);
      expect(founding.totalSeeds).toBe(3);
      expect(founding.worldDays).toEqual({ median: 1.5, min: 1, max: 2 });
      // Every other milestone stays unreached by all three fake Runs.
      for (const row of rows) {
        if (row.kind === "founding") continue;
        expect(row.reachedSeeds).toBe(0);
      }
    });
  });
});
