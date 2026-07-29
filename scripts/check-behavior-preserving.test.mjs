// Tests for scripts/check-behavior-preserving.mjs (#332).
//
// Not src/sim (ADR-0002/0003 don't bind here). Each test builds a small,
// real git repo in a temp dir (two commits to diff between) and runs the
// CLI via execFileSync, asserting on exit code and stdout/stderr content —
// same pattern as normalize-markdown.test.mjs's CLI suite.

import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SCRIPT_PATH = join(process.cwd(), "scripts", "check-behavior-preserving.mjs");

function git(args, cwd) {
  return execFileSync("git", args, { cwd, encoding: "utf8" });
}

function initRepo(dir) {
  git(["init", "--initial-branch=main"], dir);
  git(["config", "user.email", "test@example.com"], dir);
  git(["config", "user.name", "Test"], dir);
}

function commitAll(dir, message) {
  git(["add", "-A"], dir);
  git(["commit", "-m", message, "--no-gpg-sign"], dir);
  return git(["rev-parse", "HEAD"], dir).trim();
}

function withTempRepo(fn) {
  const dir = mkdtempSync(join(tmpdir(), "check-behavior-preserving-"));
  try {
    initRepo(dir);
    fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function runCli(args, cwd) {
  try {
    const stdout = execFileSync("node", [SCRIPT_PATH, ...args], { cwd, encoding: "utf8", stdio: "pipe" });
    return { status: 0, stdout, stderr: "" };
  } catch (err) {
    return { status: err.status, stdout: err.stdout?.toString() ?? "", stderr: err.stderr?.toString() ?? "" };
  }
}

describe("check-behavior-preserving CLI", () => {
  it("exits 0 when no test files changed at all", () => {
    withTempRepo((dir) => {
      writeFileSync(join(dir, "readme.txt"), "hello\n");
      const base = commitAll(dir, "initial");
      writeFileSync(join(dir, "readme.txt"), "hello again\n");
      commitAll(dir, "second");

      const result = runCli([base], dir);
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("0 test file(s) changed");
      expect(result.stdout).toContain("clean");
    });
  });

  it("exits 0 when a test file is modified but no assertion line changes", () => {
    withTempRepo((dir) => {
      mkdirSync(join(dir, "src", "sim"), { recursive: true });
      const testFile = join(dir, "src", "sim", "widget.test.ts");
      writeFileSync(
        testFile,
        ["import { describe, it, expect } from 'vitest';", "", "describe('widget', () => {", "  // comment only", "  it('works', () => {", "    expect(1).toBe(1);", "  });", "});", ""].join("\n"),
      );
      const base = commitAll(dir, "initial");
      writeFileSync(
        testFile,
        ["import { describe, it, expect } from 'vitest';", "", "describe('widget', () => {", "  // comment only, edited", "  it('works', () => {", "    expect(1).toBe(1);", "  });", "});", ""].join("\n"),
      );
      commitAll(dir, "second");

      const result = runCli([base], dir);
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("1 test file(s) changed");
      expect(result.stdout).toContain("0 assertion-line diff(s)");
    });
  });

  it("hard-fails (exit 1) when a test file is added", () => {
    withTempRepo((dir) => {
      mkdirSync(join(dir, "src", "sim"), { recursive: true });
      writeFileSync(join(dir, "src", "sim", "existing.test.ts"), "expect(1).toBe(1);\n");
      const base = commitAll(dir, "initial");
      writeFileSync(join(dir, "src", "sim", "new.test.ts"), "expect(2).toBe(2);\n");
      commitAll(dir, "second");

      const result = runCli([base], dir);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("HARD VIOLATION");
      expect(result.stderr).toContain("new.test.ts");
    });
  });

  it("hard-fails (exit 1) when a test file is deleted", () => {
    withTempRepo((dir) => {
      mkdirSync(join(dir, "e2e"), { recursive: true });
      writeFileSync(join(dir, "e2e", "fleet.spec.ts"), "expect(1).toBe(1);\n");
      const base = commitAll(dir, "initial");
      rmSync(join(dir, "e2e", "fleet.spec.ts"));
      commitAll(dir, "second");

      const result = runCli([base], dir);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("HARD VIOLATION");
      expect(result.stderr).toContain("fleet.spec.ts");
    });
  });

  it("returns review-needed (exit 2) and prints the changed assertion lines", () => {
    withTempRepo((dir) => {
      mkdirSync(join(dir, "src", "sim"), { recursive: true });
      const testFile = join(dir, "src", "sim", "cargo.test.ts");
      writeFileSync(
        testFile,
        ["import { expect, it } from 'vitest';", "", "it('holds grain', () => {", "  expect(cargo.grain).toBe(5);", "});", ""].join("\n"),
      );
      const base = commitAll(dir, "initial");
      writeFileSync(
        testFile,
        ["import { expect, it } from 'vitest';", "", "it('holds grain', () => {", "  expect(cargo.grain).toBe(7);", "});", ""].join("\n"),
      );
      commitAll(dir, "second");

      const result = runCli([base], dir);
      expect(result.status).toBe(2);
      // Both the removed (-) and added (+) assertion lines count separately.
      expect(result.stdout).toContain("2 assertion-line diff(s)");
      expect(result.stdout).toContain("REVIEW NEEDED");
      // Both the removed and added assertion line should be surfaced.
      expect(result.stdout).toContain("-4: ");
      expect(result.stdout).toContain("+4: ");
      expect(result.stdout).toContain("toBe(5)");
      expect(result.stdout).toContain("toBe(7)");
      expect(result.stdout).toContain("surfacer, not a verdict");
    });
  });

  it("exits 64 (usage error) when baseRef is missing", () => {
    withTempRepo((dir) => {
      writeFileSync(join(dir, "readme.txt"), "hello\n");
      commitAll(dir, "initial");

      const result = runCli([], dir);
      expect(result.status).toBe(64);
      expect(result.stderr).toContain("missing required <baseRef>");
    });
  });

  it("--help prints usage and exits 0 without touching git", () => {
    withTempRepo((dir) => {
      const result = runCli(["--help"], dir);
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("Usage:");
      expect(result.stdout).toContain("surfacer");
    });
  });

  it("defaults headRef to HEAD when only baseRef is given", () => {
    withTempRepo((dir) => {
      writeFileSync(join(dir, "readme.txt"), "hello\n");
      const base = commitAll(dir, "initial");
      writeFileSync(join(dir, "readme.txt"), "hello again\n");
      commitAll(dir, "second");

      const explicit = runCli([base, "HEAD"], dir);
      const implicit = runCli([base], dir);
      expect(implicit.status).toBe(explicit.status);
      expect(implicit.stdout).toBe(explicit.stdout);
    });
  });

  it("includes harness/ tests in the corpus (issue #442) — all three dirs contribute non-zero diffs", () => {
    // Anchor the corpus against a known answer: verify that all three
    // directories (src/, e2e/, harness/) contribute assertion-line diffs
    // when test files change in each (incident 0020).
    withTempRepo((dir) => {
      // Create test files in src/, e2e/, and harness/ directories.
      const srcTest = join(dir, "src", "example.test.ts");
      const e2eTest = join(dir, "e2e", "example.spec.ts");
      const harnessTest = join(dir, "harness", "example.test.ts");

      mkdirSync(join(dir, "src"), { recursive: true });
      mkdirSync(join(dir, "e2e"), { recursive: true });
      mkdirSync(join(dir, "harness"), { recursive: true });

      writeFileSync(srcTest, "it('test', () => { expect(1).toBe(1); });\n");
      writeFileSync(e2eTest, "test('example', () => { expect(true).toBe(true); });\n");
      writeFileSync(harnessTest, "it('harness test', () => { expect(0).toBeGreaterThan(-1); });\n");

      const base = commitAll(dir, "initial");

      // Modify each file to add assertion lines.
      writeFileSync(srcTest, "it('test', () => { expect(1).toBe(1); });\nit('new', () => { expect(2).toBe(2); });\n");
      writeFileSync(e2eTest, "test('example', () => { expect(true).toBe(true); });\ntest('another', () => { expect(false).toBe(false); });\n");
      writeFileSync(harnessTest, "it('harness test', () => { expect(0).toBeGreaterThan(-1); });\nit('new', () => { expect(5).toBeLessThan(10); });\n");
      commitAll(dir, "modify tests");

      const result = runCli([base], dir);

      // The corpus should be listed unconditionally.
      expect(result.stdout).toContain("scanning corpus:");
      expect(result.stdout).toContain("src/**/*.test.ts");
      expect(result.stdout).toContain("e2e/**/*.spec.ts");
      expect(result.stdout).toContain("harness/**/*.test.ts");

      // All three test files should appear in the assertion diffs (proves each dir contributes non-zero).
      expect(result.stdout).toContain("src/example.test.ts:");
      expect(result.stdout).toContain("e2e/example.spec.ts:");
      expect(result.stdout).toContain("harness/example.test.ts:");

      // Each file should have assertion-line diffs in the output (proves non-zero for each).
      // The assertions appear on the added lines (marked with +):
      expect(result.stdout).toMatch(/expect\(2\)\.toBe/); // src
      expect(result.stdout).toMatch(/expect\(false\)\.toBe/); // e2e
      expect(result.stdout).toMatch(/expect\(5\)\.toBeLessThan/); // harness

      expect(result.status).toBe(2); // Review needed: assertion diffs found in all dirs.
    });
  });
});
