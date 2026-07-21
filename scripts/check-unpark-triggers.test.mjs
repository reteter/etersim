// Tests for scripts/check-unpark-triggers.mjs (#332).
//
// Builds small fixture docs/design-notes/ directories in a temp dir and runs
// the CLI via execFileSync (cwd = the temp dir, matching how the script
// resolves "docs/design-notes" relative to process.cwd()) — same pattern as
// normalize-markdown.test.mjs's CLI suite.

import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SCRIPT_PATH = join(process.cwd(), "scripts", "check-unpark-triggers.mjs");

function withTempFixture(files, fn) {
  const dir = mkdtempSync(join(tmpdir(), "check-unpark-triggers-"));
  const notesDir = join(dir, "docs", "design-notes");
  mkdirSync(notesDir, { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(notesDir, name), content);
  }
  try {
    fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function runCli(args, cwd) {
  try {
    const stdout = execFileSync("node", [SCRIPT_PATH, ...args], { cwd, encoding: "utf8", stdio: "pipe" });
    return { status: 0, stdout };
  } catch (err) {
    return { status: err.status, stdout: err.stdout?.toString() ?? "" };
  }
}

describe("check-unpark-triggers CLI", () => {
  it("exits 0 when every trigger has a same-paragraph issue citation", () => {
    withTempFixture(
      {
        "note.md": ["This idea is parked for now.", "See #123 for the tracker.", "Nothing else here."].join("\n"),
      },
      (dir) => {
        const result = runCli([], dir);
        expect(result.status).toBe(0);
        expect(result.stdout).toContain("1 trigger-language line(s) scanned across 1 file(s)");
        expect(result.stdout).toContain("clean");
      },
    );
  });

  it("exits 1 and lists a trigger line with no citation anywhere in its paragraph", () => {
    withTempFixture(
      {
        "note.md": ["Filler line one.", "Filler line two.", "This idea is parked for now.", "Filler line three.", "Filler line four.", "Filler line five."].join(
          "\n",
        ),
      },
      (dir) => {
        const result = runCli([], dir);
        expect(result.status).toBe(1);
        expect(result.stdout).toContain("note.md:3: This idea is parked for now.");
        expect(result.stdout).toContain("1 trigger(s) without a same-paragraph issue citation");
      },
    );
  });

  it("excludes README.md and grill-brief-m*-*.md files from scanning, and lists them as exempt", () => {
    withTempFixture(
      {
        "README.md": "This index is parked with no citation and must never be flagged.\n",
        "grill-brief-m4-workbench.md": "Grill scheduled, parked until M4, no citation needed here.\n",
        "note.md": ["Filler.", "Filler.", "This idea is parked for now.", "Filler.", "Filler."].join("\n"),
      },
      (dir) => {
        const result = runCli([], dir);
        expect(result.status).toBe(1);
        expect(result.stdout).toContain("exempt files (2)");
        expect(result.stdout).toContain("README.md");
        expect(result.stdout).toContain("grill-brief-m4-workbench.md");
        // Only note.md's line should be scanned/violate — exempt files never appear as violations.
        expect(result.stdout).toContain("note.md:3:");
        expect(result.stdout).not.toContain("README.md:1:");
        expect(result.stdout).not.toContain("grill-brief-m4-workbench.md:1:");
        expect(result.stdout).toContain("1 trigger-language line(s) scanned across 1 file(s)"); // only note.md scanned
      },
    );
  });

  it("finds a citation several lines below the trigger when it stays in the same paragraph", () => {
    // Reproduces the repo's real #326/#360 citation convention: the pointer
    // is a trailing sentence a few lines after the trigger phrase, in the
    // same paragraph — not on an adjacent line.
    withTempFixture(
      {
        "same-paragraph.md": [
          "Raised by the owner during the grill, while locking guild contract",
          "mechanics (parked, needs its own grill). Status: do not implement yet.",
          "Unpark trigger tracked as #357 (filed 2026-07-21, #326 audit) — this note",
          "carried the trigger in prose only, with no issue and no milestone home.",
        ].join("\n"),
      },
      (dir) => {
        const result = runCli([], dir);
        expect(result.status).toBe(0);
        expect(result.stdout).not.toContain("same-paragraph.md:2:");
        expect(result.stdout).toContain("clean");
      },
    );
  });

  it("still flags a trigger when the citation is 1+ lines away but in a DIFFERENT paragraph", () => {
    withTempFixture(
      {
        "different-paragraph.md": [
          "# Route order conditionals (parked, needs its own grill)",
          "",
          "Raised by the owner during the grill, while locking guild contract",
          "mechanics. Status: parked — do not implement; revisit in a dedicated grill.",
          "",
          "Unpark trigger tracked as #357 (filed 2026-07-21, #326 audit) — this note",
          "carried the trigger in prose only, with no issue and no milestone home.",
        ].join("\n"),
      },
      (dir) => {
        const result = runCli([], dir);
        expect(result.status).toBe(1);
        // The trigger's own paragraph (lines 1-4) has no citation — the
        // blank line at index 4 starts a new paragraph the citation lives
        // in, so it does not rescue the first paragraph's match.
        expect(result.stdout).toContain("different-paragraph.md:1:");
      },
    );
  });

  it("anchors its counts before reporting violations (incident 0020)", () => {
    withTempFixture(
      {
        "a.md": "This idea is parked, no citation.\n",
        "b.md": "Revisit at a later date, no citation either.\n",
      },
      (dir) => {
        const result = runCli([], dir);
        const totalLineIdx = result.stdout.indexOf("trigger-language line(s) scanned");
        const violationLineIdx = result.stdout.indexOf("without a same-paragraph issue citation");
        expect(totalLineIdx).toBeGreaterThan(-1);
        expect(violationLineIdx).toBeGreaterThan(-1);
        expect(totalLineIdx).toBeLessThan(violationLineIdx);
        expect(result.stdout).toContain("2 trigger-language line(s) scanned across 2 file(s)");
      },
    );
  });

  it("--help prints usage and exits 0 without scanning", () => {
    withTempFixture({}, (dir) => {
      const result = runCli(["--help"], dir);
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("Usage:");
    });
  });
});
