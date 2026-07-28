#!/usr/bin/env node
// Surfacer for "a trigger is a promise" (#327, docs/workflows/documentation.md
// §A trigger is a promise): "every unpark trigger in docs/design-notes/ names
// an issue."
//
// THIS IS A SURFACER, NOT A VERDICT (owner decision 2026-07-28, #412). It
// prints candidate lines for a human to read and always exits 0; only its own
// failure to run is an error. Reason, from #412's evidence: the law is about a
// *promise*, and this script matches the *word* — "parked"/"unpark" in a
// heading, in a sentence stating the law itself, in a retrospective about a
// trigger that already fired, in a cross-reference to a hook parked somewhere
// else. It shipped at 27 hits, stayed at exactly 27 for a week, and sat in no
// gate. A red that is mostly false positives teaches the team to scroll past a
// red line, which is worse than no detector at all (incident 0030).
//
// The two hit classes it CAN legitimately point at: a live unpark trigger whose
// paragraph names no issue, and the law's own escape hatch ("record it as an
// idea with no commitment"), which no mechanical check can tell apart from a
// violation. Both need a human, which is precisely why this exits 0.
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
//   3. For every match, checks the surrounding PARAGRAPH (the block of
//      contiguous non-blank lines the trigger line sits in, per markdown's
//      natural unit — split on one-or-more blank lines) for an issue-number
//      citation (/#\d+/) anywhere in that paragraph. No citation anywhere in
//      the same paragraph = violation.
//
//      This replaced an earlier fixed +/-2-line window (#332's first cut):
//      the repo's real citation convention, established by #326's own audit
//      fixes, is a trailing sentence a few lines *after* the trigger phrase
//      in the same paragraph — e.g. "...needs its own grill." followed two
//      sentences later by "**Unpark trigger tracked as #357**..." — which a
//      fixed small window systematically missed. Paragraph scope is still
//      fully mechanical (no judgment call, no exemption list to maintain);
//      it just matches how this repo actually writes the pointer.
//
// Blind spot, stated plainly: this is a mechanical citation check, not a
// judgement of whether the citation is the RIGHT tracker. #326's own manual
// audit excused some hits whose tracker was a named PRD epic/milestone slot
// (e.g. "E5", "E6") rather than a bare issue number — this script cannot
// make that distinction and will flag such lines as violations even though
// a human audit correctly judged them tracked. A flagged line is "needs a
// human to check the paragraph", not "definitely orphaned". A citation that
// lives in a *different* paragraph of the same file (or only in the
// design-notes index) is also invisible to this check, by the same design.
//
// Exit codes:
//   0 - always, whether or not anything was surfaced. Surfaced lines are
//       printed as `file:line: <trimmed line text>` for a human to read.
//       Nothing here gates a commit, a PR or `npm run selfcheck`.
//   non-zero - the surfacer itself could not run (unreadable directory, I/O
//       error). That, and only that, is a failure.

import { readFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";

const HELP_TEXT = `check-unpark-triggers.mjs — SURFACER for the #327 trigger-is-a-promise law

Usage:
  node scripts/check-unpark-triggers.mjs

No arguments: always scans the full docs/design-notes/ directory (relative
to the current working directory) for unpark-trigger language lacking an
issue-number citation anywhere in its same paragraph (blank-line-delimited
block). See the script's header comment for the full exemption rules and
the surfacer's documented blind spot.

This is a SURFACER, not a VERDICT (#412): it matches the WORD "parked" /
"unpark", while the law is about a PROMISE. Headings, the law's own wording,
retrospectives about triggers that already fired and cross-references to
items parked elsewhere all match it and are not violations. It prints
candidates; a human decides.

Exit codes: 0 always — including when lines are surfaced. Non-zero only when
the surfacer itself cannot run. Nothing here gates anything.
`;

const DESIGN_NOTES_DIR = "docs/design-notes";
const GRILL_BRIEF_RE = /^grill-brief-m.*-.*\.md$/;
const TRIGGER_RE = /unpark|parked|revisit at|when .* lands|when .* is picked up/i;
const CITATION_RE = /#\d+/;

function isExempt(fileName) {
  return fileName === "README.md" || GRILL_BRIEF_RE.test(fileName);
}

/**
 * Split a file's lines into paragraphs: maximal runs of contiguous
 * non-blank lines, separated by one or more blank lines — markdown's
 * natural block unit. Returns [{ startLine, endLine }] (0-indexed,
 * inclusive), in source order.
 */
function splitParagraphs(lines) {
  const paragraphs = [];
  let start = null;

  for (let i = 0; i < lines.length; i += 1) {
    const isBlank = lines[i].trim().length === 0;
    if (isBlank) {
      if (start !== null) {
        paragraphs.push({ startLine: start, endLine: i - 1 });
        start = null;
      }
    } else if (start === null) {
      start = i;
    }
  }
  if (start !== null) paragraphs.push({ startLine: start, endLine: lines.length - 1 });

  return paragraphs;
}

/**
 * Scan one file's lines for trigger matches, checking the whole paragraph
 * each match sits in for an issue citation anywhere within it. Returns
 * { matchCount, violations }.
 */
function scanFile(fileName, lines) {
  let matchCount = 0;
  const violations = [];

  for (const para of splitParagraphs(lines)) {
    const paraLines = lines.slice(para.startLine, para.endLine + 1);
    const paragraphHasCitation = CITATION_RE.test(paraLines.join("\n"));

    for (let i = para.startLine; i <= para.endLine; i += 1) {
      if (!TRIGGER_RE.test(lines[i])) continue;
      matchCount += 1;

      if (!paragraphHasCitation) {
        violations.push({ file: fileName, lineNo: i + 1, text: lines[i].trim() });
      }
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
    console.log(`\ncheck-unpark-triggers: ${allViolations.length} line(s) surfaced — trigger language with no same-paragraph issue citation:\n`);
    for (const v of allViolations) {
      console.log(`${v.file}:${v.lineNo}: ${v.text}`);
    }
    console.log(
      "\ncheck-unpark-triggers: SURFACER, NOT A VERDICT (#412) — read the lines above and decide. Exit 0 either way.",
    );
    return 0;
  }

  console.log("\ncheck-unpark-triggers: nothing surfaced — clean, every matched trigger has a same-paragraph issue citation.");
  return 0;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const code = run(process.argv.slice(2));
  process.exit(code);
}
