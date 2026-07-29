#!/usr/bin/env node
// Deterministic markdown reflow — semantic line breaks, not width-wrapping.
//
// Decision record: docs/design-notes/markdown-normalizer-grill-2026-07-21.md
// Rule: docs/WORKFLOW.md §Documentation law ("Line breaks are semantic").
//
// A line breaks at a clause boundary — sentence end (. ! ?), semicolon,
// "explanatory" colon, or em-dash — plus a 100-character soft fallback for
// any segment between hard separators. It never breaks at an arbitrary
// width, and it never breaks at every comma (see WORKFLOW.md's own example:
// a comma-joined clause within one "thought" may legitimately stay on one
// line — this script only reacts to the punctuation set above).
//
// Implementation: AST-based (remark/unified + remark-gfm), not a hand-rolled
// line/regex scanner — see decision 5 in the grill note. We do NOT round-trip
// through remark-stringify (that would flip this repo's underscore emphasis
// `_Avoid_`/`_Implementation_` to asterisks and re-escape characters, producing
// a noisy diff unrelated to reflow). Instead we parse only for AST *positions*
// and rewrite the original source text surgically: every non-paragraph node
// (headings, code fences, tables, link-reference definitions, thematic breaks,
// html blocks) is copied verbatim; only `paragraph` node spans are rewritten.
//
// Micro-rule (the actual #341 bug fix): an inline `**bold**` span (a `strong`
// AST node) must never become the first token of a wrapped line *inside a
// paragraph* — unless it is the paragraph's first child (a genuine glossary
// header, e.g. `**Aether** (PL: eter):`). Detected from AST tree position
// (child index 0 of the paragraph), not from any text heuristic.
//
// Known limitation (documented, not silently swallowed): paragraphs nested
// inside a blockquote or list item are left untouched rather than reflowed,
// because rewriting their line-internal `> ` / list-marker prefixes correctly
// is out of scope for this proof migration (CONTEXT.md has neither). Extend
// this when a future segment migration needs it.

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";

// The literal ALLOWLIST is retired (#384). It existed for the segment-by-segment
// rollout of #341 and named exactly one proof-migration file; once every doc is
// migrated, a hand-maintained list only rots — a doc added next month would be
// silently ungated, which is the "surfacer scanning nothing" shape this repo has
// been bitten by before (#442, incident 0030). Discovery has no such gap: a new
// doc is gated the moment it exists.
//
// Scope: repo-root Markdown plus everything under docs/, at any depth.

// Directories the sweep must never descend into.
//
// `docs/souvenirs` is the owner's private material (CLAUDE.md §Rules): gitignored,
// never read, never cited. It sits under docs/, so discovery would otherwise walk
// straight into it — this entry is the enforcement, and its test is the one in this
// file that must never be deleted.
const EXCLUDED_DIRS = new Set(["souvenirs", "node_modules", ".git"]);

/**
 * Every Markdown file the sweep is allowed to rewrite, as repo-relative,
 * forward-slashed paths. Deterministic order (directory walk, sorted) so a
 * `--check` run reports the same sequence every time.
 */
export function collectTargets(cwd) {
  const targets = [];

  for (const entry of readdirSync(cwd, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.isFile() && entry.name.endsWith(".md")) targets.push(entry.name);
  }

  function walk(relDir) {
    const entries = readdirSync(resolve(cwd, relDir), { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (EXCLUDED_DIRS.has(entry.name)) continue;
        walk(`${relDir}/${entry.name}`);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        targets.push(`${relDir}/${entry.name}`);
      }
    }
  }

  try {
    walk("docs");
  } catch {
    // No docs/ directory (a temp fixture, another checkout) — root files only.
  }

  return targets;
}

/**
 * The sweep's corruption guard: reflow moves whitespace and nothing else.
 *
 * #384 reformats the entire corpus in one pass, which makes "review the diff"
 * an unreliable gate — nobody reads 130 files of line-position churn closely
 * enough to spot one dropped word. So the property is asserted mechanically on
 * every file, every run, and a violation refuses the write rather than
 * reporting it. Asked of this guard, "can it fail?" has a yes: see the dropped/
 * added/reordered-word cases in normalize-markdown.test.mjs.
 */
export function assertContentPreserved(original, reflowed, relPath) {
  const norm = (s) => s.replace(/\s+/g, " ").trim();
  if (norm(original) !== norm(reflowed)) {
    throw new Error(
      `normalize-markdown: refusing to write ${relPath} — reflow changed content, not just line positions. ` +
        `This is a bug in the reflow rules for that file; nothing was written.`,
    );
  }
}

const SOFT_LIMIT = 100;

// Trailing punctuation that ends a clause. Order doesn't matter; checked as
// "does the token's last character match one of these".
const HARD_SEPARATOR_CHARS = new Set([".", "!", "?", ";", ":"]);
const EM_DASH = "—"; // —

// Common abbreviations whose internal period is not a sentence end. Not
// exhaustive — extend as new prose needs it (documented limitation, not a
// silent gap: an unlisted abbreviation would simply get a slightly early
// break, never corrupted content).
const ABBREVIATIONS = new Set(["e.g.", "i.e.", "etc.", "vs.", "cf."]);

// Node types whose containing paragraph we do NOT reflow (see "Known
// limitation" above).
const SKIP_ANCESTOR_TYPES = new Set(["blockquote", "listItem"]);

/**
 * Walk the mdast tree, collecting `paragraph` nodes that are safe to reflow
 * (i.e. not nested inside a blockquote or list item).
 */
function collectReflowableParagraphs(tree) {
  const paragraphs = [];

  function walk(node, skip) {
    if (node.type === "paragraph" && !skip) {
      paragraphs.push(node);
      // Paragraphs don't nest paragraphs; no need to recurse further for
      // more paragraph nodes, but we still don't need to walk children here.
      return;
    }
    const nextSkip = skip || SKIP_ANCESTOR_TYPES.has(node.type);
    if (node.children) {
      for (const child of node.children) walk(child, nextSkip);
    }
  }

  walk(tree, false);
  return paragraphs;
}

/**
 * Build the token stream for a single paragraph node, given the original
 * source text. Each token is either a reflowable word (from a `text` child)
 * or an atomic span (any other inline node type: strong, emphasis, link,
 * linkReference, image, inlineCode, html, delete, footnoteReference, ...).
 *
 * Returns an array of tokens: { text, isStrong, isFirstChild, breakAfter }.
 *
 * Adjacency matters: `_Avoid_: space, void, ether` has NO space between the
 * emphasis span and the colon, so they must land in the very same token
 * (never re-inserted as `_Avoid_ :`). We build the paragraph's raw text with
 * every atomic (non-text) child replaced by a whitespace-free placeholder —
 * this both preserves exact original adjacency (a single global
 * whitespace-split later either merges an atom with touching punctuation
 * into one token, or keeps them apart exactly as the source did) and
 * insulates the split from any internal newline the atom's own raw slice
 * might carry (e.g. a bold span hand-wrapped across two lines pre-migration).
 */
function tokenizeParagraph(paragraphNode, source) {
  const PLACEHOLDER_MARK = "";
  const atomsByIndex = [];
  let flatText = "";

  const children = paragraphNode.children;
  for (let i = 0; i < children.length; i += 1) {
    const child = children[i];
    const isFirstChild = i === 0;

    if (child.type === "break") {
      // Hard line break in the source: force a break at this point, but
      // contribute no visible text.
      //
      // The placeholder is emitted *surrounded by spaces* (#384). A break's raw
      // slice ("  \n" or "\\\n") is the only whitespace between its neighbours,
      // and substituting a placeholder for it used to fuse them into a single
      // token — "session)" + "**Origin**" became "session)**Origin**", silent
      // content loss in a tool whose entire contract is "whitespace only".
      // The resulting empty token is not dropped: it hands its forced break to
      // the token before it (see the zero-length branch below).
      //
      // The marker itself ("  " or "\\") is carried, not discarded: it *is* the
      // hard break. Dropping it silently downgraded a `<br>` to a soft break —
      // a rendering change, which "whitespace only" does not license. The
      // whitespace-normalized guard cannot see the two-space form disappear,
      // so this is a case where the property test would have passed a real
      // regression; the backslash form is what exposed it.
      const rawBreak = child.position
        ? source.slice(child.position.start.offset, child.position.end.offset)
        : "  \n";
      const idx = atomsByIndex.length;
      atomsByIndex.push({
        type: "break",
        isStrong: false,
        isFirstChild: false,
        text: "",
        forceBreak: true,
        hardBreakMarker: rawBreak.replace(/\r?\n[\s\S]*$/, "") || "  ",
      });
      flatText += ` ${PLACEHOLDER_MARK}${idx}${PLACEHOLDER_MARK} `;
      continue;
    }

    if (!child.position) continue; // defensive: nodes should always have one

    const rawSlice = source.slice(child.position.start.offset, child.position.end.offset);

    if (child.type === "text") {
      flatText += rawSlice;
    } else {
      // Any other inline node type is atomic: never split internally, and
      // normalize any internal whitespace (incl. hand-wrap newlines) to a
      // single space in the text we'll eventually display.
      const idx = atomsByIndex.length;
      atomsByIndex.push({
        type: child.type,
        isStrong: child.type === "strong",
        isFirstChild,
        text: rawSlice.replace(/\s+/g, " "),
        forceBreak: false,
      });
      flatText += `${PLACEHOLDER_MARK}${idx}${PLACEHOLDER_MARK}`;
    }
  }

  const placeholderRe = new RegExp(`${PLACEHOLDER_MARK}(\\d+)${PLACEHOLDER_MARK}`, "g");
  const rawWords = flatText.split(/\s+/).filter((w) => w.length > 0);

  const tokens = [];
  let parenDepth = 0;

  for (const rawWord of rawWords) {
    let isStrong = false;
    let isFirstChild = false;
    let forceBreak = false;
    let hardBreakMarker = null;

    const display = rawWord.replace(placeholderRe, (_m, idxStr) => {
      const atom = atomsByIndex[Number(idxStr)];
      if (atom.isStrong) isStrong = true;
      if (atom.isFirstChild) isFirstChild = true;
      if (atom.forceBreak) forceBreak = true;
      if (atom.hardBreakMarker) hardBreakMarker = atom.hardBreakMarker;
      return atom.text;
    });

    // A lone break placeholder carries no text — it carries only the obligation
    // to break, and the marker that makes the break hard. Both are handed to
    // the token it followed.
    if (display.length === 0) {
      if (forceBreak && tokens.length > 0) {
        tokens[tokens.length - 1].breakAfter = true;
        tokens[tokens.length - 1].hardBreakMarker = hardBreakMarker;
      }
      continue;
    }

    // isFirstChild only grants the header exemption when this token is
    // wholly that atom (no attached punctuation splitting the header off
    // from something else) — true for every case in CONTEXT.md.
    if (isFirstChild && display !== atomsByIndex.find((a) => a.isFirstChild)?.text) {
      isFirstChild = tokens.length === 0;
    }

    // Update running paren depth from this token's own characters.
    for (const ch of display) {
      if (ch === "(") parenDepth += 1;
      else if (ch === ")") parenDepth = Math.max(0, parenDepth - 1);
    }

    let breakAfter = forceBreak;
    if (!breakAfter) {
      if (display === EM_DASH) {
        breakAfter = parenDepth === 0;
      } else {
        const lower = display.toLowerCase();
        const lastChar = display[display.length - 1];
        breakAfter = !ABBREVIATIONS.has(lower) && parenDepth === 0 && HARD_SEPARATOR_CHARS.has(lastChar);
      }
    }

    tokens.push({ text: display, isStrong, isFirstChild, breakAfter, hardBreakMarker: null });
  }

  return tokens;
}

/**
 * Tokens that are ordinary prose mid-line but become *block syntax* when they
 * start one: bullet and ordered-list markers, blockquote marks, table pipes and
 * fences. Reflow may never place one at a line start (#384).
 *
 * Found the expensive way: the corpus sweep wrapped incident 0012's prose
 * "…orphaned harness worktree + branch, and…" so that "+" led a line, silently
 * turning a sentence into a bullet list. Both content checks passed it — the
 * word stream is identical — so this is guarded by AST-shape tests instead.
 *
 * Deliberately narrow. `-word` or `#123` are *not* hazards: a bullet needs a
 * space after its marker, and an ATX heading needs one after the `#`. Only a
 * bare marker token qualifies. `>` is the exception CommonMark grants no such
 * grace — `>quoted` is a blockquote — so any token starting with it counts.
 */
function isLineStartUnsafe(text) {
  if (text.startsWith(">")) return true;
  if (text.startsWith("```") || text.startsWith("~~~")) return true;
  return /^(?:[-+*#|]|\d+[.)])$/.test(text);
}

/**
 * Lay out a token stream into wrapped lines per the semantic-break rule.
 */
function layoutLines(tokens) {
  const lines = [];
  let current = [];
  let currentLen = 0;
  let mustBreakBeforeNext = false;
  // Set when the line being built ended at a hard break; appended verbatim so
  // the `<br>` survives the reflow.
  let pendingSuffix = "";

  function flush() {
    if (current.length > 0) {
      lines.push(current.join(" ") + pendingSuffix);
      current = [];
      currentLen = 0;
    }
    pendingSuffix = "";
  }

  for (const token of tokens) {
    const wouldExceedSoftLimit =
      current.length > 0 && currentLen + 1 + token.text.length > SOFT_LIMIT;
    let doBreak = mustBreakBeforeNext || wouldExceedSoftLimit;

    // Micro-rule: never let a non-first-child `strong` span lead a wrapped
    // line. Suppress the break here and defer it to right after this token.
    // A pending hard break is the author's own explicit break: no cosmetic
    // micro-rule may defer it past the next token, which would move the `<br>`
    // to a different line and regroup the content around it.
    let deferBreakToAfter = false;
    if (doBreak && !pendingSuffix && token.isStrong && !token.isFirstChild) {
      doBreak = false;
      deferBreakToAfter = true;
    }

    // Same mechanism, harder requirement: a block-syntax token may never lead a
    // line — with the same exemption for an explicit hard break.
    if (doBreak && !pendingSuffix && isLineStartUnsafe(token.text)) {
      doBreak = false;
      deferBreakToAfter = true;
    }

    if (doBreak) flush();

    current.push(token.text);
    currentLen += token.text.length + (current.length > 1 ? 1 : 0);

    mustBreakBeforeNext = token.breakAfter || deferBreakToAfter;
    if (token.hardBreakMarker) pendingSuffix = token.hardBreakMarker;
  }

  flush();
  return lines;
}

/**
 * Reflow a single paragraph's raw source text; returns the new raw text
 * (no leading/trailing paragraph delimiters — just the paragraph's own
 * content, newline-joined).
 */
function reflowParagraph(paragraphNode, source) {
  const tokens = tokenizeParagraph(paragraphNode, source);
  if (tokens.length === 0) return "";
  const lines = layoutLines(tokens);
  return lines.join("\n");
}

/**
 * Reflow an entire markdown document: parse once, rewrite only `paragraph`
 * node spans (skipping ones nested in blockquotes/list items), copy
 * everything else verbatim.
 */
export function reflowMarkdown(source) {
  const tree = unified().use(remarkParse).use(remarkGfm).parse(source);
  const paragraphs = collectReflowableParagraphs(tree);

  let result = "";
  let cursor = 0;
  for (const para of paragraphs) {
    const start = para.position.start.offset;
    const end = para.position.end.offset;
    result += source.slice(cursor, start);
    result += reflowParagraph(para, source);
    cursor = end;
  }
  result += source.slice(cursor);
  return result;
}

// ---- CLI ----------------------------------------------------------------

function runCli(argv) {
  const checkMode = argv.includes("--check");
  const cwd = process.cwd();

  let anyChanged = false;
  let anyError = false;

  const targets = collectTargets(cwd);
  // A sweep that swept nothing must not report success (the hollow-gate test).
  if (targets.length === 0) {
    console.error("normalize-markdown: no Markdown files found — nothing was checked");
    process.exit(2);
  }

  for (const relPath of targets) {
    const absPath = resolve(cwd, relPath);
    let original;
    try {
      original = readFileSync(absPath, "utf8");
    } catch (err) {
      console.error(`normalize-markdown: cannot read ${relPath}: ${err.message}`);
      anyError = true;
      continue;
    }

    let reflowed;
    try {
      reflowed = reflowMarkdown(original);
      assertContentPreserved(original, reflowed, relPath);
    } catch (err) {
      console.error(`normalize-markdown: ${relPath}: ${err.message}`);
      anyError = true;
      continue;
    }

    const changed = reflowed !== original;
    if (changed) anyChanged = true;

    if (checkMode) {
      console.log(`${changed ? "WOULD CHANGE" : "OK"}  ${relPath}`);
    } else if (changed) {
      writeFileSync(absPath, reflowed, "utf8");
      console.log(`REWRITTEN  ${relPath}`);
    } else {
      console.log(`UNCHANGED  ${relPath}`);
    }
  }

  if (anyError) process.exit(2);
  if (checkMode && anyChanged) process.exit(1);
  process.exit(0);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  runCli(process.argv.slice(2));
}
