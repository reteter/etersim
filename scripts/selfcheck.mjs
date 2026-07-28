#!/usr/bin/env node
// Pre-work selfcheck — the mechanical half of the old docs/SELFCHECK.md, as a command.
//
// Why a script and not a document (owner decision 2026-07-28, s29): the prose version was
// the most-broken document in the repo — five incidents (0003, 0004, 0021, 0022, 0030), and
// every fix added another paragraph to it. Incident 0022 named the cause exactly: "budget
// pressure is a solvent on ceremony; every soft precondition gives it a foothold". A command
// has no foothold — it either ran or it did not, and its output is evidence rather than a
// claim. The *normative* half (which gate applies, the stop-and-wait report, what to do on a
// red baseline) stayed prose, in CLAUDE.md, because it is law rather than procedure.
//
// Three scars are wired in deliberately:
//
//   0022 — the task kind must be said out loud. `--kind` is required; there is no default,
//          because the silent classification ("this isn't really a task") is what dissolved
//          the check in the first place.
//   0020 — anchored counts. A detector with a known non-zero baseline is compared against
//          that number; drift either way is a finding. A bare "it failed" would be ignored.
//   0030 — a check nobody runs is not a gate. Everything the old §3 block listed runs here,
//          including the three detectors that sat outside every gate for a week.
//
// And the postmerge.ps1 discipline: this script REFUSES to report READY when it skipped
// something the task kind required. Not-verified is never reported as fine.
//
// Usage:  npm run selfcheck -- --kind=docs|impl|design|analysis [--offline] [--json]

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Detectors whose current red is inherited and documented. Compared by count, not by exit
 * code (scar 0020): the number moving in either direction is the signal. Clearing one means
 * deleting its entry here in the same commit.
 */
const KNOWN_BASELINES = {
  // Empty by design. `check:triggers` was pinned here at 27 until 2026-07-28,
  // when it was reclassified as a surfacer (#412) and stopped returning a
  // verdict at all — see SURFACERS below.
};

/**
 * Commands that report for a human to read and never gate (`check-behavior-preserving`'s
 * contract, extended to `check:triggers` by the owner's #412 call). They exit 0 whether or
 * not they surfaced anything, so "green" would be a lie: the run is reported by how many
 * lines it raised, and only a crash is a failure.
 */
const SURFACERS = {
  "check:triggers": "candidate lines only — the law is about a promise, the pattern matches a word",
};

const TASK_KINDS = {
  docs: {
    label: "Docs-only change",
    gate: "Branch + PR (exceptions: session-close batch, and docs/HANDOFF.md alone at a session boundary); sweep for stale cross-references",
    requires: ["env", "detectors"],
    skips: { baseline: "docs-only diff cannot break tests, typecheck or lint" },
  },
  impl: {
    label: "Implementation (issue)",
    gate: "Approved spec + issue in a milestone; TDD for src/sim; feature branch + PR; the owner merges",
    requires: ["env", "baseline", "detectors"],
    skips: {},
  },
  design: {
    label: "Design / grill / spec",
    gate: "Conversation with the owner; never delegated; one question at a time; output lands in specs + CONTEXT.md + PRD",
    requires: ["env"],
    skips: {
      baseline: "no code changes",
      detectors: "run them with the docs batch that lands the spec",
    },
  },
  analysis: {
    label: "Playtest analysis",
    gate: "Verify each observation against code before classifying; route to grill / issue / parking lot — a parked item with an unpark trigger also gets an issue; do not decide design",
    requires: ["env", "detectors"],
    skips: { baseline: "read-only pass over existing behaviour" },
  },
};

function sh(command, { cwd = REPO_ROOT, timeout = 600_000 } = {}) {
  const r = spawnSync(command, { cwd, shell: true, encoding: "utf8", timeout });
  return {
    ok: r.status === 0,
    status: r.status,
    out: `${r.stdout ?? ""}${r.stderr ?? ""}`.trim(),
    spawnError: r.error ? String(r.error.message ?? r.error) : null,
  };
}

/** pass | fail | warn | known | skip — `skip` is the only one that can withhold READY. */
const result = (status, headline, detail) => ({ status, headline, detail });

// ---------------------------------------------------------------- environment

function checkWorkingTree() {
  const st = sh("git status --porcelain");
  if (!st.ok) return result("fail", "git status failed", st.out);
  const dirty = st.out.split("\n").filter(Boolean);
  const merging = sh("git rev-parse --verify --quiet MERGE_HEAD").out !== "";
  const rebasing = sh("git rev-parse --git-path rebase-merge").ok && sh("test -d $(git rev-parse --git-path rebase-merge)").ok;
  if (merging || rebasing) return result("fail", "mid-merge/rebase — finish or abort it first", st.out);
  return dirty.length === 0
    ? result("pass", "clean")
    : result("warn", `${dirty.length} uncommitted path(s)`, dirty.join("\n"));
}

function checkBranch() {
  const b = sh("git branch --show-current");
  if (!b.ok) return result("fail", "cannot read current branch", b.out);
  const branch = b.out || "(detached HEAD)";
  // Not a failure by itself: CLAUDE.md allows two docs-only exceptions on main. The report
  // states the branch so the reader applies the rule; the script does not guess intent.
  return result(branch === "main" ? "warn" : "pass", branch,
    branch === "main" ? "on main — allowed only for the session-close docs batch or docs/HANDOFF.md alone (CLAUDE.md §Rules)" : undefined);
}

function checkSyncWithOrigin(offline) {
  if (offline) return result("skip", "skipped (--offline)");
  const f = sh("git fetch origin --quiet");
  if (!f.ok) return result("skip", "git fetch failed — ahead/behind unverified", f.out);
  const sb = sh("git status -sb");
  const line = sb.out.split("\n")[0] ?? "";
  const diverged = line.includes("[ahead") || line.includes("[behind");
  return diverged
    ? result("warn", line.trim(), "a diverged main blocks work — reconcile first (incident 0006)")
    : result("pass", line.trim() || "level with origin");
}

function checkWorktree() {
  const list = sh("git worktree list");
  if (!list.ok) return result("fail", "git worktree list failed", list.out);
  const entries = list.out.split("\n").filter(Boolean);
  const top = sh("git rev-parse --show-toplevel").out;
  const cwdIsListed = entries.some((e) => e.split(" ")[0].replace(/\\/g, "/") === process.cwd().replace(/\\/g, "/"));
  const detail = `${entries.length} entry/entries; toplevel ${top}` +
    (cwdIsListed ? "" : "; cwd is NOT a listed worktree — paths are relative to toplevel, use git -C (CLAUDE.md §Git & worktrees)");
  return result(entries.length === 1 ? "pass" : "warn", `${entries.length} worktree(s)`, detail);
}

function checkRecentHistory() {
  const log = sh("git log --oneline -3");
  return log.ok ? result("pass", "readable", log.out) : result("fail", "git log failed", log.out);
}

function checkOpenIssues(offline) {
  if (offline) return result("skip", "skipped (--offline)");
  const gh = sh("gh issue list --limit 10");
  return gh.ok
    ? result("pass", `${gh.out.split("\n").filter(Boolean).length} shown (of the open set)`, gh.out)
    : result("skip", "gh unavailable — find your issue and its milestone by hand", gh.out);
}

// ---------------------------------------------------------------- baseline + detectors

const baselineStep = (label, cmd) => () => {
  const r = sh(`npm run ${cmd} --silent`);
  return r.ok ? result("pass", "green") : result("fail", `${label} RED`, tail(r.out, 25));
};

function detectorStep(cmd) {
  return () => {
    const r = sh(`npm run ${cmd} --silent`);

    const surfacerNote = SURFACERS[cmd];
    if (surfacerNote) {
      if (!r.ok) return result("fail", "surfacer could not run", tail(r.out, 25));
      const surfaced = r.out.match(/(\d+)\s+line\(s\) surfaced/);
      return surfaced
        ? result("known", `${surfaced[1]} line(s) surfaced — not a gate`, surfacerNote)
        : result("known", "nothing surfaced — not a gate", surfacerNote);
    }

    const known = KNOWN_BASELINES[cmd];
    if (r.ok) {
      return known
        ? result("warn", "now green — remove its KNOWN_BASELINES entry", `${cmd} was pinned at ${known.count} (${known.ref})`)
        : result("pass", "green");
    }
    if (!known) return result("fail", "RED and not a known baseline", tail(r.out, 25));
    const found = countViolations(r.out);
    if (found === null) return result("warn", `RED, count unreadable (expected ${known.count})`, tail(r.out, 25));
    if (found === known.count) {
      return result("known", `${found} violations — inherited, matches baseline (${known.ref})`, known.note);
    }
    return result("fail", `${found} violations, baseline is ${known.count} (${known.ref}) — drift either way is a finding`, tail(r.out, 25));
  };
}

/** Anchored count (scar 0020): a crashing or reworded reporter must not read as zero. */
export function countViolations(output) {
  const explicit = output.match(/(\d+)\s+violations?/i);
  if (explicit) return Number(explicit[1]);
  const lines = output.split("\n").filter((l) => /^\s*(?:[-*]|\S+:\d+)/.test(l));
  return lines.length > 0 ? lines.length : null;
}

const tail = (text, n) => text.split("\n").slice(-n).join("\n");

// ---------------------------------------------------------------- assembly

function buildPlan(kind, offline) {
  const groups = {
    env: [
      ["working tree", checkWorkingTree],
      ["branch", checkBranch],
      ["sync with origin", () => checkSyncWithOrigin(offline)],
      ["recent history", checkRecentHistory],
      ["worktrees", checkWorktree],
      ["open issues", () => checkOpenIssues(offline)],
    ],
    baseline: [
      ["tests", baselineStep("vitest", "test")],
      ["typecheck", baselineStep("typecheck", "typecheck")],
      ["lint", baselineStep("lint", "lint")],
    ],
    detectors: [
      ["check:triggers", detectorStep("check:triggers")],
      ["check:glossary", detectorStep("check:glossary")],
    ],
  };
  return TASK_KINDS[kind].requires.flatMap((g) => groups[g].map(([label, run]) => ({ group: g, label, run })));
}

/**
 * READY is withheld on any fail, and on any *required* group that could not be verified —
 * the postmerge.ps1 rule: never report clean for something you did not check.
 */
export function verdict(rows) {
  const fails = rows.filter((r) => r.status === "fail");
  const skipped = rows.filter((r) => r.status === "skip");
  if (fails.length) return { code: 1, label: "NOT READY", why: `${fails.length} check(s) failed` };
  if (skipped.length) {
    return { code: 1, label: "UNVERIFIED", why: `${skipped.length} required check(s) could not run — do not report these as clean` };
  }
  const warns = rows.filter((r) => r.status === "warn");
  return warns.length
    ? { code: 0, label: "READY, with notes", why: `${warns.length} item(s) need a human read` }
    : { code: 0, label: "READY", why: "all required checks green" };
}

const GLYPH = { pass: "ok  ", fail: "FAIL", warn: "note", known: "known", skip: "SKIP" };

function main() {
  const args = process.argv.slice(2);
  const kindArg = args.find((a) => a.startsWith("--kind="))?.slice("--kind=".length);
  const offline = args.includes("--offline");

  if (!kindArg || !TASK_KINDS[kindArg]) {
    console.error(
      `Usage: npm run selfcheck -- --kind=<${Object.keys(TASK_KINDS).join("|")}> [--offline]\n\n` +
      `--kind is required on purpose (incident 0022): the task classification is the one thing\n` +
      `budget pressure silently skips, so it is said out loud or nothing runs.\n\n` +
      Object.entries(TASK_KINDS).map(([k, v]) => `  ${k.padEnd(9)} ${v.label}`).join("\n")
    );
    process.exit(2);
  }

  const kind = TASK_KINDS[kindArg];
  console.log(`selfcheck — kind: ${kindArg} (${kind.label})`);
  console.log(`gate: ${kind.gate}\n`);

  const rows = buildPlan(kindArg, offline).map((step) => {
    const r = step.run();
    console.log(`  [${GLYPH[r.status].padEnd(5)}] ${step.label.padEnd(18)} ${r.headline}`);
    if (r.detail) console.log(r.detail.split("\n").map((l) => `           ${l}`).join("\n"));
    return { ...step, ...r };
  });

  for (const [group, why] of Object.entries(kind.skips)) {
    console.log(`  [n/a  ] ${group.padEnd(18)} not run for --kind=${kindArg}: ${why}`);
  }

  const v = verdict(rows);
  console.log(`\n${v.label} — ${v.why}`);
  console.log(
    `\nPaste this, filled in, before your first edit (CLAUDE.md §Before you start — post it\n` +
    `and wait,\n` +
    `especially when it feels unnecessary; incident 0022):\n\n` +
    `  Selfcheck: <task> → gate ${kindArg} | env: ${rows.find((r) => r.label === "branch")?.headline ?? "?"}, ` +
    `baseline ${rows.some((r) => r.group === "baseline") ? (rows.filter((r) => r.group === "baseline").every((r) => r.status === "pass") ? "green" : "RED") : "n/a"} | plan: <one line>`
  );

  process.exit(v.code);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
