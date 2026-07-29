import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseSeeds, runCommand } from "./runCommand.ts";

/** CLI smoke test (docs/specs/E11-proving-grounds.md §Testing: "CLI smoke:
 *  `harness run` over a small Batch, within the CI time budget"). Calls
 *  `runCommand` directly (no child process) — same code path `cli.ts` runs,
 *  minus process-exit plumbing, so it exercises real argument parsing, file
 *  writing and the full Batch/report pipeline. */

describe("parseSeeds", () => {
  it("a bare positive integer N means seeds 1..N", () => {
    expect(parseSeeds("3")).toEqual([1, 2, 3]);
  });

  it("a comma-separated list is explicit, and a single seed needs a trailing comma to disambiguate", () => {
    expect(parseSeeds("1,7,42")).toEqual([1, 7, 42]);
    expect(parseSeeds("7,")).toEqual([7]); // the one thing replayCommandFor relies on
  });

  it("rejects a non-integer", () => {
    expect(() => parseSeeds("abc")).toThrow(/positive integer/);
    expect(() => parseSeeds("1,abc")).toThrow(/not an integer/);
    expect(() => parseSeeds("0")).toThrow(/positive integer/);
  });

  it("rejects an empty seed set rather than silently producing a zero-Run Batch (blocker: --seeds ',' used to parse to [])", () => {
    expect(() => parseSeeds(",")).toThrow(/empty seed set/);
    expect(() => parseSeeds("")).toThrow(); // bare empty string: no comma, falls to the "must be a positive integer" branch
  });

  it("rejects a non-positive seed even in list form, consistent with the bare-N form (blocker: '0,'/'-5,' used to pass straight to createWorld)", () => {
    expect(() => parseSeeds("0,")).toThrow(/positive integer/);
    expect(() => parseSeeds("-5,")).toThrow(/positive integer/);
    expect(() => parseSeeds("1,-5,3")).toThrow(/positive integer/);
  });
});

describe("runCommand — CLI smoke", () => {
  let outDir: string;
  const logs: string[] = [];
  const log = (line: string) => logs.push(line);

  beforeEach(() => {
    outDir = mkdtempSync(join(tmpdir(), "harness-smoke-"));
    logs.length = 0;
  });

  afterEach(() => {
    rmSync(outDir, { recursive: true, force: true });
  });

  it("prints help and exits 0 on --help, writing nothing", () => {
    const result = runCommand(["--help"], log);
    expect(result.exitCode).toBe(0);
    expect(logs.join("\n")).toContain("harness run --policy");
  });

  it("exits 1 and prints help when a required flag is missing", () => {
    const result = runCommand(["--policy", "doNothing"], log);
    expect(result.exitCode).toBe(1);
  });

  it("runs a small two-policy Batch and writes runs/*.jsonl, report.json and report.md", () => {
    const result = runCommand(
      ["--policy", "doNothing,gradientLoop", "--seeds", "2", "--days", "5", "--out", outDir],
      log,
    );
    expect(result.exitCode).toBe(0);

    const runFiles = readdirSync(join(outDir, "runs")).sort();
    expect(runFiles).toEqual([
      "doNothing-seed1.jsonl",
      "doNothing-seed2.jsonl",
      "gradientLoop-seed1.jsonl",
      "gradientLoop-seed2.jsonl",
    ]);

    const ledgerLines = readFileSync(join(outDir, "runs", "gradientLoop-seed1.jsonl"), "utf8")
      .trim()
      .split("\n");
    expect(ledgerLines.length).toBeGreaterThan(0);
    expect(() => JSON.parse(ledgerLines[0])).not.toThrow();

    const report = JSON.parse(readFileSync(join(outDir, "report.json"), "utf8"));
    expect(report.policies).toHaveLength(2);
    expect(report.comparisons).toHaveLength(1);

    expect(existsSync(join(outDir, "report.md"))).toBe(true);
    const md = readFileSync(join(outDir, "report.md"), "utf8");
    expect(md).toContain("gradientLoop");
  });

  it("is deterministic end to end: two invocations to two directories write byte-identical files", () => {
    const outDir2 = mkdtempSync(join(tmpdir(), "harness-smoke-"));
    try {
      runCommand(["--policy", "gradientLoop", "--seeds", "2", "--days", "10", "--out", outDir], log);
      runCommand(["--policy", "gradientLoop", "--seeds", "2", "--days", "10", "--out", outDir2], log);

      expect(readFileSync(join(outDir, "report.json"), "utf8")).toBe(
        readFileSync(join(outDir2, "report.json"), "utf8"),
      );
      expect(readFileSync(join(outDir, "runs", "gradientLoop-seed1.jsonl"), "utf8")).toBe(
        readFileSync(join(outDir2, "runs", "gradientLoop-seed1.jsonl"), "utf8"),
      );
    } finally {
      rmSync(outDir2, { recursive: true, force: true });
    }
  });

  it("every printed replay command's --seeds value parses back to exactly the Run's own seed", () => {
    runCommand(["--policy", "gradientLoop", "--seeds", "1,7", "--days", "5", "--out", outDir], log);
    const report = JSON.parse(readFileSync(join(outDir, "report.json"), "utf8"));
    for (const run of report.policies[0].runs) {
      const seedsFlag = /--seeds ([^ ]+)/.exec(run.replayCommand)![1];
      expect(parseSeeds(seedsFlag)).toEqual([run.seed]);
    }
  });

  it("an empty --seeds value throws rather than writing a zero-Run, all-zeros report (blocker)", () => {
    expect(() =>
      runCommand(["--policy", "doNothing", "--seeds", ",", "--days", "5", "--out", outDir], log),
    ).toThrow(/empty seed set/);
    // Nothing was written — the failure happened before any file touched disk.
    expect(existsSync(join(outDir, "report.json"))).toBe(false);
  });

  it("an unknown policy in a multi-policy invocation fails before running anything, and before the first (valid) policy's expensive Batch runs (blocker: ordering)", () => {
    expect(() =>
      runCommand(
        ["--policy", "doNothing,notAPolicy", "--seeds", "5", "--days", "30", "--out", outDir],
        log,
      ),
    ).toThrow(/Unknown policy "notAPolicy"/);
    // Validation happens before mkdir/run — no runs/ directory, no partial report.
    expect(existsSync(join(outDir, "runs"))).toBe(false);
    expect(existsSync(join(outDir, "report.json"))).toBe(false);
  });
});
