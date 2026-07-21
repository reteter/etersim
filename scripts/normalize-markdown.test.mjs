// Tests for scripts/normalize-markdown.mjs (#341).
//
// Not src/sim (ADR-0002/0003 don't bind here), but the correctness
// properties below — idempotence, fence/table/link-reference preservation,
// the bold-not-first-child micro-rule — are cheap and valuable to pin down
// with Vitest per the task package's recommendation.

import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { reflowMarkdown, ALLOWLIST } from "./normalize-markdown.mjs";

describe("reflowMarkdown — content preservation", () => {
  it("never adds, drops or reorders words (whitespace-normalized content is byte-for-byte equal)", () => {
    const source = [
      "**Aether** (PL: eter):",
      "The physical medium filling the space between worlds; ships sail through it like an ocean.",
      "_Avoid_: space, void, ether",
    ].join("\n");
    const out = reflowMarkdown(source);
    const norm = (s) => s.replace(/\s+/g, " ").trim();
    expect(norm(out)).toBe(norm(source));
  });

  it("is idempotent: reflowing twice equals reflowing once", () => {
    const source = [
      "**Term** (PL: termin):",
      "A long explanatory sentence that runs well past the soft wrap limit so the",
      "hundred-character fallback has to kick in somewhere in the middle of it, for sure.",
      "_Avoid_: a synonym, another synonym",
    ].join("\n");
    const once = reflowMarkdown(source);
    const twice = reflowMarkdown(once);
    expect(twice).toBe(once);
  });
});

describe("reflowMarkdown — bold-span micro-rule (the #341 bug fix)", () => {
  it("never lets a non-first-child strong span lead a wrapped line", () => {
    // The prefix is deliberately 90 chars: 90 + 1 (space) + 20
    // ("**processed goods**".length) = 111 > 100, so the 100-char soft
    // fallback alone would break right before the bold span, placing it at
    // the start of the next line — the exact artifact that opened #341.
    const source =
      "**Processing** (PL: przetwórstwo):\n" +
      "The mechanic of goods transformation consumes many varied kinds of input Goods and creates " +
      "**processed goods** (PL: towary przetworzone), including arcane ones.";
    const out = reflowMarkdown(source);
    const lines = out.split("\n");
    for (const line of lines) {
      expect(line.startsWith("**processed goods**")).toBe(false);
    }
    // And the content is still present, just not line-leading.
    expect(out).toContain("**processed goods**");
  });

  it("leaves a genuine header — bold as the paragraph's first content — untouched by the rule", () => {
    const source = "**Aether** (PL: eter):\nThe physical medium filling the space between worlds.";
    const out = reflowMarkdown(source);
    expect(out.split("\n")[0]).toBe("**Aether** (PL: eter):");
  });
});

describe("reflowMarkdown — must not corrupt code fences, tables, link references", () => {
  it("copies a fenced code block through verbatim", () => {
    const source = [
      "Some intro prose that is short.",
      "",
      "```ts",
      "const   x = 1;   // deliberately odd spacing, must survive untouched",
      "function f() {",
      "  return x;",
      "}",
      "```",
      "",
      "More prose after the fence.",
    ].join("\n");
    const out = reflowMarkdown(source);
    expect(out).toContain(
      "```ts\nconst   x = 1;   // deliberately odd spacing, must survive untouched\nfunction f() {\n  return x;\n}\n```",
    );
  });

  it("copies a GFM pipe table through verbatim", () => {
    const source = [
      "Intro prose.",
      "",
      "| Col A | Col B |",
      "| ----- | ----- |",
      "| one   | two   |",
      "",
      "Outro prose.",
    ].join("\n");
    const out = reflowMarkdown(source);
    expect(out).toContain("| Col A | Col B |\n| ----- | ----- |\n| one   | two   |");
  });

  it("copies a link-reference definition through verbatim", () => {
    const source = ["Some prose with a [reference link][ref1] in it.", "", "[ref1]: https://example.com/page"].join(
      "\n",
    );
    const out = reflowMarkdown(source);
    expect(out).toContain("[ref1]: https://example.com/page");
    expect(out).toContain("[reference link][ref1]");
  });
});

describe("reflowMarkdown — clause-boundary rule", () => {
  it("does not break inside a parenthetical gloss like (PL: eter)", () => {
    const source = "**Aether** (PL: eter):\nProse continues here.";
    const out = reflowMarkdown(source);
    expect(out).toContain("**Aether** (PL: eter):");
  });

  it("does not break at every comma — a comma-joined clause may stay on one line", () => {
    const source =
      "Intro.\nA clause, joined by a comma, that is short enough to fit under the hundred-character limit.";
    const out = reflowMarkdown(source);
    expect(out).toContain(
      "A clause, joined by a comma, that is short enough to fit under the hundred-character limit.",
    );
  });

  it("applies the 100-character soft fallback when no hard separator appears in time", () => {
    const longWord = "word ".repeat(30).trim(); // no punctuation at all
    const source = `Intro.\n${longWord}`;
    const out = reflowMarkdown(source);
    for (const line of out.split("\n")) {
      expect(Array.from(line).length).toBeLessThanOrEqual(100);
    }
  });
});

describe("CLI — docs:normalize", () => {
  function withTempRepo(fn) {
    const dir = mkdtempSync(join(tmpdir(), "normalize-md-cli-"));
    try {
      fn(dir);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  it("--check exits 1 when the allowlisted file would change, 0 once migrated", () => {
    withTempRepo((dir) => {
      const target = join(dir, ALLOWLIST[0]);
      const unmigrated =
        "**Aether** (PL: eter):\nThe physical medium filling the space between worlds; ships sail through it like an ocean.";
      writeFileSync(target, unmigrated, "utf8");

      const scriptPath = join(process.cwd(), "scripts", "normalize-markdown.mjs");

      let checkFailed = false;
      try {
        execFileSync("node", [scriptPath, "--check"], { cwd: dir, stdio: "pipe" });
      } catch {
        checkFailed = true;
      }
      expect(checkFailed).toBe(true);

      execFileSync("node", [scriptPath], { cwd: dir, stdio: "pipe" });
      const migrated = readFileSync(target, "utf8");
      expect(migrated).not.toBe(unmigrated);

      // Now --check should pass clean.
      execFileSync("node", [scriptPath, "--check"], { cwd: dir, stdio: "pipe" });

      // And applying again should be a no-op (idempotence via the CLI).
      const before = readFileSync(target, "utf8");
      execFileSync("node", [scriptPath], { cwd: dir, stdio: "pipe" });
      const after = readFileSync(target, "utf8");
      expect(after).toBe(before);
    });
  });
});
