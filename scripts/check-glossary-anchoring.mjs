#!/usr/bin/env node
// W9 — "every term the glossary defines is spoken somewhere" — automated.
//
// Source: docs/design-notes/world-model-implications.md §W9, issue #324.
// Guards against incident 0020: a crashing `grep | wc -l` pipeline turned an
// aborted grep (exit 134) into a silent count of `0`, manufacturing ten
// fabricated "orphaned term" findings. Nothing here shells out for counting
// — every count is done in-process (fs.readFileSync + regex), so there is no
// subprocess exit code to lose in a pipe. File *discovery* does use fs
// directory walks (also in-process, no shell-out) rather than any `find`/
// `grep` subprocess, for the same reason.
//
// Anchoring (the load-bearing requirement, step 3 of the issue): before any
// zero-occurrence term is trusted as a real orphan, the script verifies its
// own counting pipeline against a known-answer control term (CONTROL_TERM,
// "Thaler" — the world's currency, incident 0020's own worked example: "a
// currency cannot have zero mentions"). Two independent ways the anchor can
// fail, both fatal (exit 2, distinct from "real orphan found" = exit 1):
//   1. the control term isn't even in the parsed glossary list — extraction
//      is broken (wrong regex, renamed term, corrupted CONTEXT.md), or
//   2. the control term's own count comes back zero or suspiciously low —
//      the corpus walk or the counting regex is broken.
//
// Design choice worth stating explicitly: a term's own glossary *header*
// line (`**Term** (PL: ...):`) is stripped out of CONTEXT.md before counting
// (see `stripGlossaryHeaders`). Without that, every term would trivially
// score >= 1 forever (it always appears in its own header), making "zero
// occurrences" impossible to construct and the whole check tautological.
// Stripping the header means a term only counts as "spoken" if something —
// its own body prose, another entry's body, another doc, or code — actually
// uses it, which is the "dead vocabulary" question §W9 is really asking.

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";

export const CONTROL_TERM = "Thaler";
// Deliberately modest: real full-repo runs land in the hundreds, but a small
// test fixture only needs to clear "not zero, not a fluke" — see
// scripts/check-glossary-anchoring.test.mjs.
export const MIN_CONTROL_OCCURRENCES = 5;

export const EXIT_OK = 0;
export const EXIT_ORPHANS_FOUND = 1;
export const EXIT_CONTROL_CHECK_FAILED = 2;

// Matches a CONTEXT.md glossary header at the start of a line, e.g.
// "**Goods store** (PL: miejsce na towary):". Captures the canonical
// English term name. Anchored to line-start (`^` + multiline flag) so it
// never fires on a bold span mid-paragraph.
const GLOSSARY_HEADER_RE = /^\*\*([^*]+)\*\*\s*\(PL:[^)]*\):/gm;

/**
 * Parse CONTEXT.md's raw text for its bold glossary headers, returning the
 * ordered list of canonical term names (e.g. "Goods store", "Thaler").
 */
export function extractGlossaryTerms(contextMdContent) {
  const terms = [];
  const re = new RegExp(GLOSSARY_HEADER_RE);
  let match;
  while ((match = re.exec(contextMdContent)) !== null) {
    terms.push(match[1].trim());
  }
  return terms;
}

/**
 * Remove every glossary header line from CONTEXT.md's text, leaving the
 * body prose intact. Used only for *counting*, never for extraction — see
 * the header note above for why.
 */
export function stripGlossaryHeaders(contextMdContent) {
  return contextMdContent.replace(new RegExp(GLOSSARY_HEADER_RE), "");
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Build the case-insensitive "plain English mention" pattern for a term:
 * word-boundary at the start (so "Port" doesn't fire inside "important"),
 * no boundary requirement at the end (so "Thaler" also matches the far more
 * common plural "Thalers" — see calibration note in the issue/README).
 */
function buildProseRegex(term) {
  const escaped = escapeRegExp(term).replace(/\s+/g, "\\s+");
  return new RegExp(`\\b${escaped}`, "gi");
}

function countMatches(regex, text) {
  const matches = text.match(regex);
  return matches ? matches.length : 0;
}

/**
 * Derive the identifier-cased form a multi-word term is expected to take in
 * code (e.g. "Goods store" -> "GoodsStore"). Single-word terms return []
 * deliberately: their identifier form is case-identical to the term itself,
 * already covered by the case-insensitive prose regex, and adding it here
 * would double-count every occurrence.
 *
 * Only the PascalCase spelling is returned, not also camelCase: since the
 * search is case-insensitive (a real `goodsStore` field name should count
 * too), a separate camelCase pattern would differ from the PascalCase one
 * only in the first character's case — which case-insensitive matching
 * already ignores — so adding both would search for the same pattern twice
 * and double-count every code occurrence.
 */
export function deriveIdentifierForms(term) {
  const words = term.split(/[^a-zA-Z0-9]+/).filter(Boolean);
  if (words.length < 2) return [];
  const capitalize = (w) => w[0].toUpperCase() + w.slice(1);
  return [words.map(capitalize).join("")];
}

/**
 * Count a single term's occurrences across the already-loaded corpus:
 * plain-English mentions in the text corpus (docs/CONTEXT.md sans headers/
 * README) and in src (comments, strings), plus identifier-cased forms in
 * src for multi-word terms.
 */
export function countTermOccurrences(term, textContents, codeContents) {
  const proseRe = buildProseRegex(term);
  let total = 0;
  for (const content of textContents) total += countMatches(proseRe, content);
  for (const content of codeContents) total += countMatches(proseRe, content);

  for (const idForm of deriveIdentifierForms(term)) {
    const idRe = new RegExp(escapeRegExp(idForm), "gi");
    for (const content of codeContents) total += countMatches(idRe, content);
  }
  return total;
}

function listFilesRecursive(dir, extensions) {
  if (!existsSync(dir)) return [];
  const results = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...listFilesRecursive(full, extensions));
    } else if (entry.isFile() && extensions.some((ext) => entry.name.toLowerCase().endsWith(ext))) {
      results.push(full);
    }
  }
  return results;
}

/**
 * Enumerate the corpus file paths from a repo root: docs (docs/**\/*.md,
 * CONTEXT.md, README.md if present) and src (src/**\/*.ts, *.tsx).
 */
export function buildCorpusFilePaths(cwd) {
  const contextPath = resolve(cwd, "CONTEXT.md");
  const docsDir = resolve(cwd, "docs");
  const readmePath = resolve(cwd, "README.md");
  const srcDir = resolve(cwd, "src");

  const textFiles = [contextPath, ...listFilesRecursive(docsDir, [".md"])];
  if (existsSync(readmePath)) textFiles.push(readmePath);

  const codeFiles = listFilesRecursive(srcDir, [".ts", ".tsx"]);

  return { contextPath, textFiles, codeFiles };
}

/**
 * Run the full W9 check against a repo rooted at `cwd`. Pure function, no
 * process.exit — the CLI wrapper below turns the result into an exit code.
 */
export function runGlossaryCheck(cwd) {
  const messages = [];
  const contextPath = resolve(cwd, "CONTEXT.md");

  if (!existsSync(contextPath)) {
    return {
      exitCode: EXIT_CONTROL_CHECK_FAILED,
      messages: [`check-glossary-anchoring: CONTEXT.md not found at ${contextPath}.`],
    };
  }

  const rawContextContent = readFileSync(contextPath, "utf8");
  const terms = extractGlossaryTerms(rawContextContent);

  if (terms.length === 0) {
    return {
      exitCode: EXIT_CONTROL_CHECK_FAILED,
      messages: [
        "check-glossary-anchoring: parsed zero glossary terms from CONTEXT.md — " +
          "the header regex or the file itself is broken, not reporting orphans.",
      ],
    };
  }

  const { textFiles, codeFiles } = buildCorpusFilePaths(cwd);
  const textContents = textFiles.map((f) => {
    const content = readFileSync(f, "utf8");
    return f === contextPath ? stripGlossaryHeaders(content) : content;
  });
  const codeContents = codeFiles.map((f) => readFileSync(f, "utf8"));
  const fileCount = textFiles.length + codeFiles.length;

  // Anchored, before any pass/fail verdict — the incident-0020 discipline:
  // never let a reader infer a total from a truncated list.
  messages.push(
    `check-glossary-anchoring: scanned ${terms.length} glossary terms across ${fileCount} corpus files ` +
      `(${textFiles.length} docs, ${codeFiles.length} src).`,
  );

  if (!terms.includes(CONTROL_TERM)) {
    messages.push(
      `check-glossary-anchoring: control term "${CONTROL_TERM}" is not among the parsed glossary terms — ` +
        "glossary extraction is broken, not reporting orphans (incident 0020).",
    );
    return { exitCode: EXIT_CONTROL_CHECK_FAILED, termCount: terms.length, fileCount, messages };
  }

  const controlCount = countTermOccurrences(CONTROL_TERM, textContents, codeContents);
  messages.push(`check-glossary-anchoring: control term "${CONTROL_TERM}" occurrences: ${controlCount}.`);

  if (controlCount < MIN_CONTROL_OCCURRENCES) {
    messages.push(
      `check-glossary-anchoring: control term count is zero or suspiciously low (< ${MIN_CONTROL_OCCURRENCES}) — ` +
        "counting pipeline is broken, not reporting orphans (incident 0020).",
    );
    return { exitCode: EXIT_CONTROL_CHECK_FAILED, termCount: terms.length, fileCount, controlCount, messages };
  }

  const counts = terms.map((term) => ({ term, count: countTermOccurrences(term, textContents, codeContents) }));
  const orphans = counts.filter((c) => c.count === 0).map((c) => c.term);
  const totalMentions = counts.reduce((sum, c) => sum + c.count, 0);

  messages.push(`check-glossary-anchoring: total mentions across all terms: ${totalMentions}.`);

  if (orphans.length > 0) {
    messages.push(`check-glossary-anchoring: ORPHANED terms (zero occurrences): ${orphans.join(", ")}`);
    return {
      exitCode: EXIT_ORPHANS_FOUND,
      termCount: terms.length,
      fileCount,
      controlCount,
      totalMentions,
      orphans,
      messages,
    };
  }

  messages.push("check-glossary-anchoring: PASS — every glossary term is spoken somewhere in the corpus.");
  return {
    exitCode: EXIT_OK,
    termCount: terms.length,
    fileCount,
    controlCount,
    totalMentions,
    orphans: [],
    messages,
  };
}

// ---- CLI ------------------------------------------------------------------

function runCli() {
  const result = runGlossaryCheck(process.cwd());
  for (const line of result.messages) {
    if (result.exitCode === EXIT_OK) console.log(line);
    else console.error(line);
  }
  process.exit(result.exitCode);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  runCli();
}
