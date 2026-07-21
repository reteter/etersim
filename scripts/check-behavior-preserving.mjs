#!/usr/bin/env node
// Surfacer for the "behavior-preserving exemption" (#317, WORKFLOW.md
// §Verification gates): "the suite passes with no assertion changed and no
// test added or removed."
//
// Decision record: docs/design-notes/s14-law-automation-decision-2026-07-21.md
// Issue: #332 ("tooling: detectors for the four s14 laws").
//
// THIS IS A SURFACER, NOT A VERDICT. The literal, mechanically-checkable half
// of the exemption ("no test added or removed") is a file-status diff —
// unambiguous, hard-fails. The softer half ("no assertion changed") cannot
// be verified automatically without understanding whether a changed line's
// *value* moved or only its *syntax* did — exactly the shape of #307's own
// refactor diff: `cargo.grain` -> `amountOf(cargo, "grain")` touches an
// assertion line without changing what it asserts. This script therefore
// only *surfaces* every touched assertion line for a human to eyeball in
// seconds; it never decides whether the exemption still holds.
//
// Usage:
//   node scripts/check-behavior-preserving.mjs <baseRef> [headRef]
//   (headRef defaults to HEAD)
//
// Exit codes (documented here and nowhere else — read this before scripting
// against it):
//   0 - clean: no matched test files changed, or every changed test file has
//       zero assertion-line diffs.
//   1 - hard violation: at least one matched test file was added or deleted
//       between baseRef and headRef. Takes precedence over exit 2 when both
//       conditions are present in the same diff.
//   2 - review needed: assertion-line diffs were found in one or more
//       modified test files. A human must read the surfaced lines and
//       confirm none of them represent a real change in expected value.
//   64 - usage error (missing baseRef argument). Not part of the three-way
//       pass/fail/review contract above; a caller scripting against this
//       tool should treat it as "the invocation itself was wrong", not as a
//       verdict on the diff.

import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const HELP_TEXT = `check-behavior-preserving.mjs — surfacer for the #317 behavior-preserving exemption

Usage:
  node scripts/check-behavior-preserving.mjs <baseRef> [headRef]

  baseRef   required. Git ref to diff from (e.g. a commit before the change).
  headRef   optional. Git ref to diff to. Defaults to HEAD.

What it does:
  1. Finds test files changed between baseRef and headRef, matching either
     src/**/*.test.ts(x) or e2e/**/*.spec.ts.
  2. Hard-fails (exit 1) if any matched test file was added or deleted —
     "no test added or removed" is a literal, mechanical check.
  3. For every matched file that was only modified, prints every +/- diff
     line containing a recognized assertion call (expect(, .toBe(, .toEqual(,
     .toThrow(, .toContain(, .toMatch(, .toHaveLength(, .toBeCloseTo(,
     .toBeGreaterThan(, .toBeLessThan( — a reasonable list, NOT exhaustive).

This is a SURFACER, not a VERDICT: it cannot tell whether a changed assertion
line moved its expected *value* (a real behavior change) or only its *syntax*
(e.g. a refactor that changes how a value is read but not what is asserted).
A human reads the surfaced lines in seconds to tell the difference; the
tool's only job is to make sure nothing is missed silently.

Exit codes: 0 clean, 1 hard violation (test added/removed), 2 review needed
(assertion diffs found), 64 usage error. See the script's header comment for
the full contract.
`;

const TEST_FILE_RE = /^src\/.*\.test\.tsx?$|^e2e\/.*\.spec\.ts$/;

// Non-exhaustive on purpose (documented in --help and the header comment
// above) — extend this list as new matcher styles show up in the suite.
const ASSERTION_SUBSTRINGS = [
  "expect(",
  ".toBe(",
  ".toEqual(",
  ".toThrow(",
  ".toContain(",
  ".toMatch(",
  ".toHaveLength(",
  ".toBeCloseTo(",
  ".toBeGreaterThan(",
  ".toBeLessThan(",
];

function containsAssertion(text) {
  return ASSERTION_SUBSTRINGS.some((needle) => text.includes(needle));
}

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" });
}

/**
 * Parse `git diff --name-status` output into a list of
 * { status, path } records. Renames/copies (status starts with R/C, plus a
 * similarity score, e.g. "R100") carry two paths tab-separated; we report
 * the destination path, since that's what a reviewer would look at post-move.
 * Known limitation, not silently swallowed: a rename that ALSO moves a test
 * file out of the recognized glob (or in) is invisible to the status-letter
 * check below, because we only classify by status letter, not by whether the
 * file matches the test glob on both sides of the rename.
 */
function parseNameStatus(raw) {
  const records = [];
  for (const line of raw.split("\n")) {
    if (line.trim().length === 0) continue;
    const fields = line.split("\t");
    const statusField = fields[0];
    const status = statusField[0];
    const path = fields.length >= 3 ? fields[2] : fields[1];
    records.push({ status, path });
  }
  return records;
}

/**
 * Parse a `git diff <base> <head> -- <file>` unified diff into a flat list
 * of { prefix: "+" | "-", lineNo, text } for every added/removed line,
 * tracking old/new line numbers from each hunk header
 * (`@@ -oldStart,oldCount +newStart,newCount @@`).
 */
function parseDiffHunks(diffText) {
  const results = [];
  let oldLineNo = 0;
  let newLineNo = 0;

  for (const line of diffText.split("\n")) {
    if (line.startsWith("@@")) {
      const match = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
      if (match) {
        oldLineNo = Number(match[1]) - 1;
        newLineNo = Number(match[2]) - 1;
      }
      continue;
    }
    if (line.startsWith("+++") || line.startsWith("---")) continue;
    if (line.startsWith("diff ") || line.startsWith("index ")) continue;
    if (line.startsWith("\\ No newline at end of file")) continue;

    if (line.startsWith("+")) {
      newLineNo += 1;
      const content = line.slice(1);
      if (containsAssertion(content)) {
        results.push({ prefix: "+", lineNo: newLineNo, text: content });
      }
    } else if (line.startsWith("-")) {
      oldLineNo += 1;
      const content = line.slice(1);
      if (containsAssertion(content)) {
        results.push({ prefix: "-", lineNo: oldLineNo, text: content });
      }
    } else if (line.startsWith(" ")) {
      oldLineNo += 1;
      newLineNo += 1;
    }
    // Any other line shape (e.g. a trailing blank from split) is ignored.
  }

  return results;
}

export function run(argv) {
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(HELP_TEXT);
    return 0;
  }

  const [baseRef, headRefArg] = argv;
  if (!baseRef) {
    console.error("check-behavior-preserving: missing required <baseRef> argument.\n");
    console.error(HELP_TEXT);
    return 64;
  }
  const headRef = headRefArg || "HEAD";

  const nameStatusRaw = git(["diff", "--name-status", baseRef, headRef]);
  const changed = parseNameStatus(nameStatusRaw).filter((rec) => TEST_FILE_RE.test(rec.path));

  console.log(
    `check-behavior-preserving: ${changed.length} test file(s) changed between ${baseRef} and ${headRef}.`,
  );

  const added = changed.filter((rec) => rec.status === "A");
  const deleted = changed.filter((rec) => rec.status === "D");
  const modified = changed.filter((rec) => rec.status === "M" || rec.status === "R" || rec.status === "C");

  let totalAssertionDiffs = 0;
  const perFileDiffs = [];
  for (const rec of modified) {
    const diffText = git(["diff", baseRef, headRef, "--", rec.path]);
    const hits = parseDiffHunks(diffText);
    totalAssertionDiffs += hits.length;
    if (hits.length > 0) perFileDiffs.push({ path: rec.path, hits });
  }

  console.log(
    `check-behavior-preserving: ${totalAssertionDiffs} assertion-line diff(s) found across ${modified.length} modified test file(s) scanned.`,
  );

  if (added.length > 0 || deleted.length > 0) {
    console.error("\ncheck-behavior-preserving: HARD VIOLATION — test file(s) added or deleted.");
    console.error('"No test added or removed" is a literal requirement of the #317 exemption:\n');
    for (const rec of added) console.error(`  A  ${rec.path}`);
    for (const rec of deleted) console.error(`  D  ${rec.path}`);
    console.error("\nThis diff does not qualify for the behavior-preserving exemption.");
    return 1;
  }

  if (totalAssertionDiffs > 0) {
    console.log("\ncheck-behavior-preserving: REVIEW NEEDED — assertion-line diffs found. Read each one:\n");
    for (const { path, hits } of perFileDiffs) {
      console.log(`${path}:`);
      for (const hit of hits) {
        console.log(`  ${hit.prefix}${hit.lineNo}: ${hit.text}`);
      }
      console.log("");
    }
    console.log(
      "This tool is a surfacer, not a verdict (see --help): confirm each line above moved only\n" +
        "syntax, not an expected value, before treating this diff as behavior-preserving.",
    );
    return 2;
  }

  console.log("\ncheck-behavior-preserving: clean — no assertion-line diffs in changed test files.");
  return 0;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const code = run(process.argv.slice(2));
  process.exit(code);
}
