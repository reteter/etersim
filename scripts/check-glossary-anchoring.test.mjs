// Tests for scripts/check-glossary-anchoring.mjs (#324, W9).
//
// Not src/sim (ADR-0002/0003 don't bind here). Written following
// normalize-markdown.test.mjs's pattern (small fixture directories under a
// temp dir, exercised via execFileSync for the CLI's exit-code contract),
// plus unit tests against the exported pure functions for exact-value
// coverage of the counting/extraction logic itself.

import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  extractGlossaryTerms,
  stripGlossaryHeaders,
  deriveIdentifierForms,
  countTermOccurrences,
  EXIT_OK,
  EXIT_ORPHANS_FOUND,
  EXIT_CONTROL_CHECK_FAILED,
} from "./check-glossary-anchoring.mjs";

describe("extractGlossaryTerms", () => {
  it("captures the canonical term name from each bold glossary header", () => {
    const source = [
      "# Doc",
      "",
      "**Aether** (PL: eter):",
      "The medium ships sail through.",
      "",
      "**Goods store** (PL: miejsce na towary):",
      "Any place goods can sit.",
    ].join("\n");
    expect(extractGlossaryTerms(source)).toEqual(["Aether", "Goods store"]);
  });

  it("does not treat a mid-paragraph bold span as a glossary header", () => {
    // Same bold+PL shape, but not at the start of the line — must be
    // ignored, or extraction would over-count and mask real orphans.
    const source = "See also **Aether** (PL: eter): mentioned inline, not a header.";
    expect(extractGlossaryTerms(source)).toEqual([]);
  });

  it("returns [] for a document with no glossary headers at all", () => {
    expect(extractGlossaryTerms("# Just a heading\n\nSome prose, no bold terms.")).toEqual([]);
  });
});

describe("stripGlossaryHeaders", () => {
  it("removes the header line but leaves body prose (incl. self-reference) intact", () => {
    const source = "**Ship** (PL: statek):\nA Ship carries Cargo in its Hold.";
    const stripped = stripGlossaryHeaders(source);
    expect(stripped).not.toContain("**Ship**");
    expect(stripped).not.toContain("(PL: statek):");
    expect(stripped).toContain("A Ship carries Cargo in its Hold.");
  });
});

describe("deriveIdentifierForms", () => {
  it("returns [] for a single-word term (already covered by the prose regex)", () => {
    expect(deriveIdentifierForms("Thaler")).toEqual([]);
  });

  it("returns exactly one PascalCase form for a multi-word term, not also camelCase", () => {
    // Regression: a separate camelCase pattern would be identical to the
    // PascalCase one under case-insensitive search (they differ only in the
    // first letter's case), so returning both would double-count.
    expect(deriveIdentifierForms("Goods store")).toEqual(["GoodsStore"]);
    expect(deriveIdentifierForms("Aether current")).toEqual(["AetherCurrent"]);
  });
});

describe("countTermOccurrences", () => {
  it("counts case-insensitive prose mentions across docs and src, with no trailing boundary (plurals count)", () => {
    const textContents = ["Aether Aether AETHER-borne winds."];
    const codeContents = ["const aether = 1; // Aether"];
    // text: "Aether"(1) "Aether"(2) "AETHER-borne"(3, prefix match, no
    // trailing \b) = 3; code: "aether"(1) "Aether"(2) = 2. Total 5.
    expect(countTermOccurrences("Aether", textContents, codeContents)).toBe(5);
  });

  it("counts an identifier-cased form in code without double-counting Pascal vs camel", () => {
    const textContents = ["No mention of the term here."];
    const codeContents = ["export function createGoodsStore(): GoodsStore { return goodsStoreInstance; }"];
    // "createGoodsStore" (1), ": GoodsStore {" (2), "goodsStoreInstance" (3)
    // — all three match the single case-insensitive "GoodsStore" pattern.
    // The prose regex "\bGoods\s+store" matches none of these (no space).
    expect(countTermOccurrences("Goods store", textContents, codeContents)).toBe(3);
  });

  it("returns 0 for a term that appears nowhere in the given corpus", () => {
    expect(countTermOccurrences("Nonexistent term", ["some prose"], ["const x = 1;"])).toBe(0);
  });
});

// ---- CLI: exit-code contract ------------------------------------------

function withFixtureRepo(files, fn) {
  const dir = mkdtempSync(join(tmpdir(), "glossary-anchor-cli-"));
  try {
    for (const [relPath, content] of Object.entries(files)) {
      const abs = join(dir, relPath);
      mkdirSync(join(abs, ".."), { recursive: true });
      writeFileSync(abs, content, "utf8");
    }
    fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const SCRIPT_PATH = join(process.cwd(), "scripts", "check-glossary-anchoring.mjs");

function runCli(cwd) {
  try {
    const stdout = execFileSync("node", [SCRIPT_PATH], { cwd, stdio: "pipe", encoding: "utf8" });
    return { exitCode: 0, stdout, stderr: "" };
  } catch (err) {
    return { exitCode: err.status, stdout: err.stdout?.toString() ?? "", stderr: err.stderr?.toString() ?? "" };
  }
}

// A healthy control term corpus: header (stripped from counting) plus 6
// body mentions of "Thaler" across docs — comfortably above
// MIN_CONTROL_OCCURRENCES (5).
const HEALTHY_THALER_DOCS =
  "A Thaler is exchanged for every crate. Traders carry spare Thalers, count " +
  "your Thalers twice, Thaler notes circulate widely, and every Thaler " +
  "matters in this economy of Thalers.";

describe("CLI — check-glossary-anchoring", () => {
  it("exits 0 (clean pass) when every term is spoken somewhere in the corpus", () => {
    withFixtureRepo(
      {
        "CONTEXT.md": [
          "# Fixture",
          "",
          "**Aether** (PL: eter):",
          "The medium ships sail through.",
          "",
          "**Goods store** (PL: miejsce na towary):",
          "Any place goods can sit.",
          "",
          "**Thaler** (PL: talar):",
          "The currency of the realm.",
        ].join("\n"),
        "docs/notes.md": `Aether currents run deep. ${HEALTHY_THALER_DOCS}`,
        "src/example.ts": [
          "export interface GoodsStore {",
          "  amount: number;",
          "}",
          "export function createGoodsStore(): GoodsStore {",
          "  return { amount: 0 };",
          "}",
        ].join("\n"),
      },
      (dir) => {
        const result = runCli(dir);
        expect(result.exitCode).toBe(EXIT_OK);
        expect(result.stdout).toContain("PASS");
        expect(result.stdout).toContain("scanned 3 glossary terms");
      },
    );
  });

  it("exits 1 and names the orphan when one glossary term is never spoken outside its own header", () => {
    withFixtureRepo(
      {
        "CONTEXT.md": [
          "# Fixture",
          "",
          "**Aether** (PL: eter):",
          "The medium ships sail through.",
          "",
          "**Ghost cargo** (PL: cien ladunku):",
          "Something nobody ever actually mentions again.",
          "",
          "**Thaler** (PL: talar):",
          "The currency of the realm.",
        ].join("\n"),
        "docs/notes.md": `Aether currents run deep. ${HEALTHY_THALER_DOCS}`,
        "src/example.ts": "export const x = 1;",
      },
      (dir) => {
        const result = runCli(dir);
        expect(result.exitCode).toBe(EXIT_ORPHANS_FOUND);
        expect(result.stderr).toContain("Ghost cargo");
        expect(result.stderr).toContain("ORPHANED");
      },
    );
  });

  it("exits 2 (not 0, not 1) when the control term is missing from the parsed glossary", () => {
    // "Thaler" renamed to "Talar" in the glossary itself: extraction never
    // produces "Thaler", so the anchor cannot even find its control term —
    // a parsing failure, distinguishable from a real orphan finding.
    withFixtureRepo(
      {
        "CONTEXT.md": ["**Aether** (PL: eter):", "The medium.", "", "**Talar** (PL: talar):", "The currency."].join(
          "\n",
        ),
        "docs/notes.md": `Aether currents run deep. ${HEALTHY_THALER_DOCS}`,
        "src/example.ts": "export const x = 1;",
      },
      (dir) => {
        const result = runCli(dir);
        expect(result.exitCode).toBe(EXIT_CONTROL_CHECK_FAILED);
        expect(result.stderr).toContain("not among the parsed glossary terms");
        expect(result.stderr).not.toContain("ORPHANED");
      },
    );
  });

  it("exits 2 (not 0, not 1) when the control term's own count is suspiciously low", () => {
    // "Thaler" is a real glossary term, but the corpus never mentions it
    // anywhere except its own (stripped) header — the counting pipeline
    // itself is what's broken here, not the glossary.
    withFixtureRepo(
      {
        "CONTEXT.md": [
          "**Aether** (PL: eter):",
          "The medium.",
          "",
          "**Thaler** (PL: talar):",
          "The currency.",
        ].join("\n"),
        "docs/notes.md": "Aether currents run deep. Nothing about the currency here at all.",
        "src/example.ts": "export const x = 1;",
      },
      (dir) => {
        const result = runCli(dir);
        expect(result.exitCode).toBe(EXIT_CONTROL_CHECK_FAILED);
        expect(result.stderr).toContain("suspiciously low");
        expect(result.stderr).not.toContain("ORPHANED");
      },
    );
  });

  it("exits 2 when CONTEXT.md is missing entirely", () => {
    withFixtureRepo({ "docs/notes.md": "Nothing to see here." }, (dir) => {
      const result = runCli(dir);
      expect(result.exitCode).toBe(EXIT_CONTROL_CHECK_FAILED);
      expect(result.stderr).toContain("CONTEXT.md not found");
    });
  });
});
