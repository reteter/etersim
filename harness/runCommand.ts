import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { runPolicyBatch, type PolicyBatchReport } from "./batch.ts";
import { POLICY_NAMES, resolvePolicy } from "./policies/registry.ts";
import { buildReport, renderMarkdown } from "./report.ts";

/**
 * `harness run` implementation (#233, docs/specs/E11-proving-grounds.md
 * §CLI). Extracted from `cli.ts` (which has no top-level side effects other
 * than the top-level `main()` call) so `runCommand` is importable and
 * testable without shelling out (spec §Testing: "CLI smoke: `harness run`
 * over a small Batch, within the CI time budget").
 *
 *   harness run --policy <name[,name2,...]> [--params <json>] --seeds <n|list> --days <d> --out <dir>
 *
 * Writes, under `--out`:
 * - `runs/<policy>-seed<seed>.jsonl` — one Run's raw Ledger, one JSON line
 *   per event, unrounded (incidents 0023/0024 — the sim's own float bytes,
 *   never rounded away).
 * - `report.json` — the aggregate Batch report, rounded (see
 *   `harness/report.ts`'s `ROUND_DP`).
 * - `report.md` — the same report, rendered as a portfolio-legible summary
 *   (spec §Portfolio note).
 *
 * `--policy` accepting a comma-separated list (rather than one name per
 * invocation) is this wave's own reading of the spec's literal singular
 * flag — flagged in the completion report as a decision, not a silent
 * scope call. It is what lets one Batch produce a head-to-head comparison
 * (spec §Evaluation model): running two policies over the same seed grid in
 * one invocation, never auto-injecting an unrequested baseline. `--params`
 * applies to *every* named policy alike — two differently-parameterized
 * instances of the same policy cannot be compared in one invocation (run
 * two separate Batches for that).
 *
 * **All input is validated before any work happens** (wave-check finding):
 * every policy name is resolved and every seed parsed/range-checked before
 * a single directory is created or a single Run executes, so a typo in the
 * second of two policies fails fast rather than after the first (expensive)
 * Batch has already run.
 */

/** Parses `--seeds`: a bare positive integer N means "seeds 1..N"; anything
 *  containing a comma is an explicit list (a single seed is written with a
 *  trailing comma, e.g. `"7,"`, to disambiguate it from "seeds 1..7" — this
 *  is what `replayCommandFor` (`harness/batch.ts`) emits, so a printed
 *  replay command actually reproduces the one Run it names). Empty segments
 *  (a trailing or doubled comma) are dropped rather than parsed as `NaN`.
 *
 *  Every parsed seed must be a positive integer, in both forms — an empty
 *  seed set (`--seeds ","`) and an out-of-range seed (`--seeds "0,"` or
 *  `--seeds "-5,"`) are both rejected here rather than silently reaching
 *  `createWorld` or producing a zero-Run Batch that reports as if it had
 *  genuinely earned nothing (wave-check finding — an empty report is not
 *  the same fact as a real Run that earned 0, and both artifacts are what
 *  get quoted into a later balance decision). */
export function parseSeeds(raw: string): readonly number[] {
  const seeds: number[] = raw.includes(",")
    ? raw
        .split(",")
        .map((part) => part.trim())
        .filter((part) => part.length > 0)
        .map((part) => {
          const n = Number(part);
          if (!Number.isInteger(n)) throw new Error(`--seeds: "${part}" is not an integer`);
          return n;
        })
    : (() => {
        const n = Number(raw);
        if (!Number.isInteger(n) || n < 1) {
          throw new Error(
            `--seeds: "${raw}" must be a positive integer (meaning seeds 1..N) or a comma-separated list`,
          );
        }
        return Array.from({ length: n }, (_, i) => i + 1);
      })();

  if (seeds.length === 0) {
    throw new Error(`--seeds: "${raw}" parsed to an empty seed set — a Batch needs at least one seed`);
  }
  for (const n of seeds) {
    if (n < 1) {
      throw new Error(`--seeds: "${n}" must be a positive integer (createWorld seeds are 1-indexed by convention)`);
    }
  }
  return seeds;
}

export function printHelp(log: (line: string) => void = console.log): void {
  log(
    [
      "harness run --policy <name[,name2,...]> [--params <json>] --seeds <n|list> --days <d> --out <dir>",
      "",
      `Known policies: ${POLICY_NAMES.join(", ")}`,
      "",
      "  --policy   Policy name, or a comma-separated list to run a head-to-head Batch.",
      "  --params   JSON object passed to every named policy's factory (default {}) —",
      "             applies to every policy named in --policy alike; two differently-",
      "             parameterised instances of the same policy need two invocations.",
      "  --seeds    A positive integer N (runs seeds 1..N), or a comma-separated explicit",
      "             list — write a single seed with a trailing comma (e.g. \"7,\") so it",
      "             is not read as \"seeds 1..7\".",
      "  --days     World days per Run (a positive integer).",
      "  --out      Output directory for runs/*.jsonl, report.json and report.md.",
      "  --enable-assertions",
      "             Check runtime invariants (harness/invariants.ts) at every day",
      "             boundary and record violations as report.json's anomalies list.",
      "             Off by default (extra per-day check cost); turn on for an",
      "             explicit bug-hunt run, e.g. against a deliberately adversarial",
      "             policy (docs/experiments/README.md §Bug-hunt mode).",
    ].join("\n"),
  );
}

export interface RunCommandResult {
  readonly exitCode: number;
  readonly outDir?: string;
}

export function runCommand(argv: readonly string[], log: (line: string) => void = console.log): RunCommandResult {
  const { values } = parseArgs({
    args: [...argv],
    options: {
      policy: { type: "string" },
      params: { type: "string" },
      seeds: { type: "string" },
      days: { type: "string" },
      out: { type: "string" },
      help: { type: "boolean" },
      "enable-assertions": { type: "boolean" },
    },
  });

  if (values.help) {
    printHelp(log);
    return { exitCode: 0 };
  }
  if (!values.policy || !values.seeds || !values.days || !values.out) {
    printHelp(log);
    return { exitCode: 1 };
  }

  // Validate everything before doing any work (wave-check finding): parse
  // and range-check seeds/days, and resolve every policy name, before
  // creating a directory or running a single Run.
  const policyNames = values.policy.split(",").map((s) => s.trim());
  const params = (values.params ? JSON.parse(values.params) : {}) as Readonly<Record<string, unknown>>;
  const seeds = parseSeeds(values.seeds);
  const days = Number(values.days);
  if (!Number.isInteger(days) || days < 1) {
    throw new Error(`--days must be a positive integer, got "${values.days}"`);
  }
  for (const name of policyNames) resolvePolicy(name, params); // throws "Unknown policy" up front
  const outDir = values.out;
  const runOptions = { enableAssertions: values["enable-assertions"] === true };

  const runsDir = join(outDir, "runs");
  mkdirSync(runsDir, { recursive: true });

  const batches: PolicyBatchReport[] = policyNames.map((name) =>
    runPolicyBatch(name, params, seeds, days, runOptions),
  );

  for (const batch of batches) {
    for (const run of batch.runs) {
      const fileName = `${run.policy}-seed${run.seed}.jsonl`;
      const content = run.ledger.map((event) => JSON.stringify(event)).join("\n");
      writeFileSync(join(runsDir, fileName), content.length > 0 ? content + "\n" : "", "utf8");
    }
  }

  const report = buildReport(batches, days);
  writeFileSync(join(outDir, "report.json"), JSON.stringify(report, null, 2) + "\n", "utf8");
  // renderMarkdown reads the raw (unrounded) `batches` for every number it
  // aggregates, and rounds once at print time — reading the already-rounded
  // `report` here instead would round-then-aggregate (wave-check finding:
  // a median recomputed from pre-rounded per-Run values can disagree with
  // the same median computed once from raw values and rounded after).
  writeFileSync(join(outDir, "report.md"), renderMarkdown(batches, report) + "\n", "utf8");

  const runCount = batches.reduce((acc, b) => acc + b.runs.length, 0);
  log(
    `Batch complete: ${policyNames.length} polic${policyNames.length === 1 ? "y" : "ies"}, ` +
      `${seeds.length} seed(s), ${days} day(s) each, ${runCount} Run(s) total.`,
  );
  log(`Report: ${join(outDir, "report.json")}, ${join(outDir, "report.md")}`);
  return { exitCode: 0, outDir };
}
