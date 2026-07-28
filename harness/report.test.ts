import { describe, expect, it } from "vitest";
import { runPolicyBatch } from "./batch.ts";
import { buildReport, renderMarkdown, round } from "./report.ts";

describe("round", () => {
  it("rounds to the given decimal place", () => {
    expect(round(1.23456, 2)).toBe(1.23);
    expect(round(1.005, 2)).toBeCloseTo(1, 5); // banker's-rounding edge case, not pinned tighter than this
  });

  it("passes NaN and Infinity through unrounded, never coercing to 0", () => {
    expect(round(NaN, 2)).toBeNaN();
    expect(round(Infinity, 2)).toBe(Infinity);
  });
});

describe("buildReport + renderMarkdown — determinism (spec §Testing: identical report on re-run)", () => {
  const DAYS = 20;
  const seeds = [1, 7];

  it("re-running the same Batch twice produces a deep-equal report and byte-identical Markdown", () => {
    const first = [runPolicyBatch("doNothing", {}, seeds, DAYS), runPolicyBatch("gradientLoop", {}, seeds, DAYS)];
    const second = [runPolicyBatch("doNothing", {}, seeds, DAYS), runPolicyBatch("gradientLoop", {}, seeds, DAYS)];

    const reportA = buildReport(first, DAYS);
    const reportB = buildReport(second, DAYS);

    // Vacuity guard: the report is not a report of zeroes (incident 0005).
    const gradient = reportA.policies.find((p) => p.policy === "gradientLoop")!;
    expect(gradient.aggregate.profitPerDay.median).not.toBe(0);
    expect(gradient.runs.some((r) => r.metrics.voyages.total > 0)).toBe(true);

    expect(reportB).toEqual(reportA);
    expect(renderMarkdown(reportB)).toBe(renderMarkdown(reportA));
  });

  it("carries no raw Ledger in the JSON report (kept in its own JSONL file)", () => {
    const batch = runPolicyBatch("doNothing", {}, [1], DAYS);
    const report = buildReport([batch], DAYS);
    for (const run of report.policies[0].runs) {
      expect(run).not.toHaveProperty("ledger");
    }
  });

  it("includes a head-to-head comparison only when at least two policies are present", () => {
    const solo = buildReport([runPolicyBatch("doNothing", {}, [1], DAYS)], DAYS);
    expect(solo.comparisons).toEqual([]);

    const pair = buildReport(
      [runPolicyBatch("doNothing", {}, [1], DAYS), runPolicyBatch("gradientLoop", {}, [1], DAYS)],
      DAYS,
    );
    expect(pair.comparisons).toHaveLength(1);
    expect(pair.comparisons[0]).toMatchObject({ a: "doNothing", b: "gradientLoop" });
  });

  it("the Markdown names units, defines a Run/Batch/thaler, states the cadence note and rounding, and lists per-Run detail", () => {
    const report = buildReport([runPolicyBatch("gradientLoop", {}, seeds, DAYS)], DAYS);
    const md = renderMarkdown(report);
    expect(md).toContain("thaler");
    expect(md).toContain("Cadence note");
    expect(md).toContain("ADR-0005");
    expect(md).toMatch(/rounded to \d+ decimal/);
    expect(md).toContain("gradientLoop");
    expect(md).toContain("Profit/day");
    expect(md).toContain("Voyages");
    expect(md).toContain("Anomalies");
    for (const seed of seeds) expect(md).toContain(`| ${seed} |`);
  });

  it("an empty anomaly list still explains why, rather than a bare empty section", () => {
    const report = buildReport([runPolicyBatch("doNothing", {}, [1], DAYS)], DAYS);
    const md = renderMarkdown(report);
    expect(report.anomalies).toEqual([]);
    expect(md).toContain("None flagged");
  });
});
