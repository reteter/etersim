import { describe, expect, it } from "vitest";
import { advanceDays, createWorld } from "../src/sim/index.ts";
import { reconcileThalers } from "./metrics.ts";
import { runBatchRun, runOne, runPolicyBatch } from "./batch.ts";
import { parseSeeds } from "./runCommand.ts";
import { gradientLoop } from "./policies/gradientLoop.ts";
import { doNothing } from "./policies/doNothing.ts";

const DAYS = 30;

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
});
