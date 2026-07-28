import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { runPolicyBatch, type PolicyBatchReport } from "./batch.ts";
import { POLICY_NAMES } from "./policies/registry.ts";
import { buildReport, renderMarkdown } from "./report.ts";

/**
 * `harness run` CLI (#233, docs/specs/E11-proving-grounds.md §CLI):
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
 * one invocation, never auto-injecting an unrequested baseline.
 */

function parseSeeds(raw: string): readonly number[] {
  if (raw.includes(",")) {
    return raw.split(",").map((part) => {
      const n = Number(part.trim());
      if (!Number.isInteger(n)) throw new Error(`--seeds: "${part.trim()}" is not an integer`);
      return n;
    });
  }
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) {
    throw new Error(`--seeds: "${raw}" must be a positive integer (meaning seeds 1..N) or a comma-separated list`);
  }
  return Array.from({ length: n }, (_, i) => i + 1);
}

function printHelp(): void {
  console.log(
    [
      "harness run --policy <name[,name2,...]> [--params <json>] --seeds <n|list> --days <d> --out <dir>",
      "",
      `Known policies: ${POLICY_NAMES.join(", ")}`,
      "",
      "  --policy   Policy name, or a comma-separated list to run a head-to-head Batch.",
      "  --params   JSON object passed to every named policy's factory (default {}).",
      "  --seeds    A positive integer N (runs seeds 1..N) or a comma-separated explicit list.",
      "  --days     World days per Run (a positive integer).",
      "  --out      Output directory for runs/*.jsonl, report.json and report.md.",
    ].join("\n"),
  );
}

function runCommand(argv: readonly string[]): void {
  const { values } = parseArgs({
    args: [...argv],
    options: {
      policy: { type: "string" },
      params: { type: "string" },
      seeds: { type: "string" },
      days: { type: "string" },
      out: { type: "string" },
      help: { type: "boolean" },
    },
  });

  if (values.help) {
    printHelp();
    return;
  }
  if (!values.policy || !values.seeds || !values.days || !values.out) {
    printHelp();
    process.exitCode = 1;
    return;
  }

  const policyNames = values.policy.split(",").map((s) => s.trim());
  const params = (values.params ? JSON.parse(values.params) : {}) as Readonly<Record<string, unknown>>;
  const seeds = parseSeeds(values.seeds);
  const days = Number(values.days);
  if (!Number.isInteger(days) || days < 1) {
    throw new Error(`--days must be a positive integer, got "${values.days}"`);
  }
  const outDir = values.out;

  const runsDir = join(outDir, "runs");
  mkdirSync(runsDir, { recursive: true });

  const batches: PolicyBatchReport[] = policyNames.map((name) => runPolicyBatch(name, params, seeds, days));

  for (const batch of batches) {
    for (const run of batch.runs) {
      const fileName = `${run.policy}-seed${run.seed}.jsonl`;
      const content = run.ledger.map((event) => JSON.stringify(event)).join("\n");
      writeFileSync(join(runsDir, fileName), content.length > 0 ? content + "\n" : "", "utf8");
    }
  }

  const report = buildReport(batches, days);
  writeFileSync(join(outDir, "report.json"), JSON.stringify(report, null, 2) + "\n", "utf8");
  writeFileSync(join(outDir, "report.md"), renderMarkdown(report) + "\n", "utf8");

  const runCount = batches.reduce((acc, b) => acc + b.runs.length, 0);
  console.log(
    `Batch complete: ${policyNames.length} polic${policyNames.length === 1 ? "y" : "ies"}, ` +
      `${seeds.length} seed(s), ${days} day(s) each, ${runCount} Run(s) total.`,
  );
  console.log(`Report: ${join(outDir, "report.json")}, ${join(outDir, "report.md")}`);
}

function main(): void {
  const [, , command, ...rest] = process.argv;
  if (command === "run") {
    runCommand(rest);
    return;
  }
  printHelp();
  process.exitCode = command ? 1 : 0;
}

main();
