#!/usr/bin/env node
// Detector for "a trigger is a promise" (#327, WORKFLOW.md §Documentation
// law): "every unpark trigger in docs/design-notes/ names an issue."
//
// Decision record: docs/design-notes/s14-law-automation-decision-2026-07-21.md
// Issue: #332. Reproduces mechanically the manual backlog pass #326's own
// audit performed (docs/design-notes/parked-item-audit-2026-07-21.md).
//
// Usage:
//   node scripts/check-unpark-triggers.mjs
//   (no arguments — always scans the full docs/design-notes/ directory,
//   relative to the current working directory)
//
// What it does:
//   1. Scans every docs/design-notes/*.md file, except README.md (the index
//      itself, not a note with its own triggers) and any file matching
//      grill-brief-m*-*.md (the settled exemption: a grill tied to a named
//      PRD milestone slot needs no issue — the roadmap sweep is its tracker,
//      per parked-item-audit-2026-07-21.md's ruling). Exempted files are
//      always listed in the output, so the exemption stays visible.
//   2. Matches each line against unpark-trigger language:
//      /unpark|parked|revisit at|when .* lands|when .* is picked up/i
//      (same pattern class #326's manual audit used).
//   3. For every match, checks a window of 2 lines before through 2 lines
//      after (inclusive) for an issue-number citation (/#\d+/). No citation
//      in the window = violation.
//
// Blind spot, stated plainly: this is a mechanical citation check, not a
// judgement of whether the citation is the RIGHT tracker. #326's own manual
// audit excused some hits whose tracker was a named PRD epic/milestone slot
// (e.g. "E5", "E6") rather than a bare issue number — this script cannot
// make that distinction and will flag such lines as violations even though
// a human audit correctly judged them tracked. A flagged line is "needs a
// human to check the window", not "definitely orphaned".
//
// Exit codes:
//   0 - every matched trigger line has a nearby issue citation.
//   1 - at least one matched trigger line has no citation in its window;
//       each is printed as `file:line: <trimmed line text>`.

import { readFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";

const HELP_TEXT = `check-unpark-triggers.mjs — detector for the #327 trigger-is-a-promise law

Usage:
  node scripts/check-unpark-triggers.mjs

No arguments: always scans the full docs/design-notes/ directory (relative
to the current working directory) for unpark-trigger language lacking a
nearby issue-number citation. See the script's header comment for the full
exemption rules and the detector's documented blind spot.

Exit codes: 0 clean, 1 violation(s) found (listed as file:line: <text>).
`;

const DESIGN_NOTES_DIR = "docs/design-notes";
const GRILL_BRIEF_RE = /^grill-brief-m.*-.*\.md$/;
const TRIGGER_RE = /unpark|parked|revisit at|when .* lands|when .* is picked up/i;
const CITATION_RE = /#\d+/;
const WINDOW_RADIUS = 2;

function isExempt(fileName) {
  return fileName === "README.md" || GRILL_BRIEF_RE.test(fileName);
}

/**
 * Scan one file's lines for trigger matches, checking a +/-2 line window
 * around each for an issue citation. Returns { matchCount, violations }.
 */
function scanFile(fileName, lines) {
  let matchCount = 0;
  const violations = [];

  for (let i = 0; i < lines.length; i += 1) {
    if (!TRIGGER_RE.test(lines[i])) continue;
    matchCount += 1;

    const windowStart = Math.max(0, i - WINDOW_RADIUS);
    const windowEnd = Math.min(lines.length - 1, i + WINDOW_RADIUS);
    const windowText = lines.slice(windowStart, windowEnd + 1).join("\n");

    if (!CITATION_RE.test(windowText)) {
      violations.push({ file: fileName, lineNo: i + 1, text: lines[i].trim() });
    }
  }

  return { matchCount, violations };
}

export function run(argv, cwd = process.cwd()) {
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(HELP_TEXT);
    return 0;
  }

  const dirPath = resolve(cwd, DESIGN_NOTES_DIR);
  const entries = readdirSync(dirPath).filter((name) => name.endsWith(".md"));

  const exemptFiles = entries.filter(isExempt).sort();
  const scannedFiles = entries.filter((name) => !isExempt(name)).sort();

  console.log(`check-unpark-triggers: exempt files (${exemptFiles.length}):`);
  for (const name of exemptFiles) console.log(`  ${name}`);

  let totalMatches = 0;
  const allViolations = [];

  for (const fileName of scannedFiles) {
    const filePath = join(dirPath, fileName);
    const content = readFileSync(filePath, "utf8");
    const lines = content.split("\n");
    const { matchCount, violations } = scanFile(fileName, lines);
    totalMatches += matchCount;
    allViolations.push(...violations);
  }

  console.log(
    `check-unpark-triggers: ${totalMatches} trigger-language line(s) scanned across ${scannedFiles.length} file(s).`,
  );

  if (allViolations.length > 0) {
    console.log(`\ncheck-unpark-triggers: ${allViolations.length} trigger(s) without a nearby issue citation:\n`);
    for (const v of allViolations) {
      console.log(`${v.file}:${v.lineNo}: ${v.text}`);
    }
    return 1;
  }

  console.log("\ncheck-unpark-triggers: clean — every matched trigger has a nearby issue citation.");
  return 0;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const code = run(process.argv.slice(2));
  process.exit(code);
}
