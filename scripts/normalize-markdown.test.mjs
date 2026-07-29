// Tests for scripts/normalize-markdown.mjs (#341).
//
// Not src/sim (ADR-0002/0003 don't bind here), but the correctness
// properties below — idempotence, fence/table/link-reference preservation,
// the bold-not-first-child micro-rule — are cheap and valuable to pin down
// with Vitest per the task package's recommendation.

import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import {
  reflowMarkdown,
  collectTargets,
  assertContentPreserved,
} from "./normalize-markdown.mjs";

const parseMd = (s) => unified().use(remarkParse).use(remarkGfm).parse(s);

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

describe("reflowMarkdown — hard line breaks (the #384 sweep bug)", () => {
  // Found by the corpus sweep, not by review: the two-space hard break was
  // emitted as a placeholder *in place of* its own whitespace, so the words
  // either side of it fused into one token — "session)**Origin**". Content
  // loss, in a tool whose whole contract is "whitespace only".
  it("keeps the words either side of a two-space hard break separate", () => {
    const source = "**Created**: 2026-07-07 (during a session)  \n**Origin**: somewhere else";
    const out = reflowMarkdown(source);
    expect(out).not.toContain("session)**Origin**");
    expect(() => assertContentPreserved(source, out, "x.md")).not.toThrow();
  });

  it("still forces a break at that point rather than reflowing across it", () => {
    const source = "Short line one.  \nShort line two.";
    const out = reflowMarkdown(source);
    expect(out.split("\n").length).toBeGreaterThan(1);
  });

  // The author's explicit break outranks every cosmetic micro-rule. Found in
  // icon-implementation-handoff.md: the bold-span rule deferred the break past
  // "**Origin**:", moving the <br> a line later and regrouping the metadata.
  it("does not let the bold micro-rule move a hard break past the bold span", () => {
    const source = "**Created**: 2026-07-07 (during a session)  \n**Origin**: somewhere else";
    const out = reflowMarkdown(source);
    const hardBreakLine = out.split("\n").find((l) => l.endsWith("  "));
    expect(hardBreakLine).toBeDefined();
    expect(hardBreakLine).toContain("session)");
    expect(hardBreakLine).not.toContain("**Origin**");
  });

  // The whitespace-normalized guard is blind to this one: trailing spaces
  // normalize away on both sides, so a silently downgraded `<br>` would pass it.
  it("preserves the hard break itself, not just the newline (a <br> stays a <br>)", () => {
    const source = "Short line one.  \nShort line two.";
    const out = reflowMarkdown(source);
    expect(out).toContain("Short line one.  \n");
  });

  it("handles a backslash hard break the same way", () => {
    const source = "First half\\\nSecond half";
    const out = reflowMarkdown(source);
    expect(() => assertContentPreserved(source, out, "x.md")).not.toThrow();
  });
});

describe("reflowMarkdown — line-start reparse hazard (#384 corpus sweep)", () => {
  // The whole-corpus sweep created thousands of new line starts, and a token
  // that is harmless mid-line can be block syntax at line start. Found in
  // incident 0012: prose "worktree + branch" wrapped so that "+" led a line,
  // turning it into a bullet list. Both content checks pass this — the words
  // are identical — which is why the real gate is an AST-shape comparison.
  const shapeOf = (s) => {
    const out = [];
    const walk = (n) => {
      out.push(n.type);
      (n.children || []).forEach(walk);
    };
    walk(parseMd(s));
    return out.join(",");
  };

  // 20 four-letter words + 19 spaces = 99 chars, so the *next* token always
  // lands at 101 > SOFT_LIMIT and the wrap falls exactly on it. Without this
  // each case would silently not exercise the boundary — a test that cannot
  // fail is the thing this whole PR is about.
  const padTo99 = Array(20).fill("word").join(" ");

  for (const marker of ["+", "-", "*", ">", "1."]) {
    it(`never lets a bare "${marker}" lead a wrapped line`, () => {
      const source = `${padTo99} ${marker} branch, and the sentence continues well past here afterwards.`;
      expect(padTo99.length).toBe(99); // the boundary is real, not assumed
      const out = reflowMarkdown(source);
      for (const line of out.split("\n")) {
        expect(line.startsWith(marker)).toBe(false);
      }
      expect(shapeOf(out)).toBe(shapeOf(source));
    });
  }
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

  it("--check exits 1 when a discovered file would change, 0 once migrated", () => {
    withTempRepo((dir) => {
      const target = join(dir, "CONTEXT.md");
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

describe("collectTargets — what the sweep is allowed to touch (#384)", () => {
  function withTree(files, fn) {
    const dir = mkdtempSync(join(tmpdir(), "normalize-md-targets-"));
    try {
      for (const [rel, body] of Object.entries(files)) {
        const abs = join(dir, rel);
        mkdirSync(join(abs, ".."), { recursive: true });
        writeFileSync(abs, body, "utf8");
      }
      fn(dir);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  it("finds root docs and everything under docs/, at any depth", () => {
    withTree(
      {
        "CLAUDE.md": "# a",
        "CONTEXT.md": "# b",
        "docs/PRD.md": "# c",
        "docs/adr/0001-x.md": "# d",
        "docs/workflows/nested/deep.md": "# e",
      },
      (dir) => {
        expect(collectTargets(dir).sort()).toEqual([
          "CLAUDE.md",
          "CONTEXT.md",
          "docs/PRD.md",
          "docs/adr/0001-x.md",
          "docs/workflows/nested/deep.md",
        ]);
      },
    );
  });

  it("never returns anything under docs/souvenirs — the owner's private material", () => {
    withTree(
      {
        "docs/PRD.md": "# keep",
        "docs/souvenirs/private.md": "# never",
        "docs/souvenirs/deeper/also-private.md": "# never",
      },
      (dir) => {
        expect(collectTargets(dir)).toEqual(["docs/PRD.md"]);
      },
    );
  });

  it("ignores non-markdown and directories the sweep has no business in", () => {
    withTree(
      {
        "docs/PRD.md": "# keep",
        "docs/diagram.svg": "<svg/>",
        "node_modules/pkg/README.md": "# never",
        ".git/COMMIT_EDITMSG.md": "# never",
      },
      (dir) => {
        expect(collectTargets(dir)).toEqual(["docs/PRD.md"]);
      },
    );
  });
});

describe("assertContentPreserved — the sweep's corruption guard (#384)", () => {
  it("passes when only whitespace moved", () => {
    expect(() =>
      assertContentPreserved("a b\nc d", "a b c\nd", "x.md"),
    ).not.toThrow();
  });

  it("throws when a word is dropped", () => {
    expect(() => assertContentPreserved("a b c", "a c", "x.md")).toThrow(/x\.md/);
  });

  it("throws when a word is added", () => {
    expect(() => assertContentPreserved("a b", "a b c", "x.md")).toThrow(/x\.md/);
  });

  it("throws when words are reordered", () => {
    expect(() => assertContentPreserved("a b", "b a", "x.md")).toThrow(/x\.md/);
  });
});
