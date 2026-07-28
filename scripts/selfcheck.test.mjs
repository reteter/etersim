// Tests for scripts/selfcheck.mjs (s29 — the mechanical half of the retired SELFCHECK.md).
//
// Following check-glossary-anchoring.test.mjs: unit tests against the exported pure
// functions, plus one CLI test for the exit-code contract. The functions under test are the
// two that carry a scar apiece — countViolations (0020, anchored counts) and verdict (the
// postmerge.ps1 refusal to report clean for something unverified) — so they are worth exact
// coverage rather than an end-to-end smoke test.

import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { countViolations, verdict } from "./selfcheck.mjs";

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "selfcheck.mjs");

describe("countViolations — anchored counts (incident 0020)", () => {
  it("reads an explicit violation count", () => {
    expect(countViolations("found 27 violations across 13 files")).toBe(27);
  });

  it("reads a singular count", () => {
    expect(countViolations("1 violation")).toBe(1);
  });

  it("falls back to counting file:line lines when no total is printed", () => {
    const out = ["docs/design-notes/a.md:3 parked", "docs/design-notes/b.md:9 unpark when"].join("\n");
    expect(countViolations(out)).toBe(2);
  });

  it("counts bulleted findings when the reporter uses a list", () => {
    expect(countViolations("- first\n- second\n- third")).toBe(3);
  });

  it("returns null rather than 0 when nothing parseable came back", () => {
    // The 0020 lesson: a crashed or reworded reporter must never read as "no violations".
    expect(countViolations("Segmentation fault")).toBeNull();
    expect(countViolations("")).toBeNull();
  });
});

describe("verdict", () => {
  const row = (status) => ({ status });

  it("is READY when every check passed", () => {
    expect(verdict([row("pass"), row("pass")])).toMatchObject({ code: 0, label: "READY" });
  });

  it("treats a known inherited baseline as acceptable", () => {
    expect(verdict([row("pass"), row("known")])).toMatchObject({ code: 0, label: "READY" });
  });

  it("still exits 0 on warnings, but flags them for a human read", () => {
    const v = verdict([row("pass"), row("warn")]);
    expect(v.code).toBe(0);
    expect(v.label).toBe("READY, with notes");
  });

  it("is NOT READY on any failure", () => {
    expect(verdict([row("pass"), row("fail")])).toMatchObject({ code: 1, label: "NOT READY" });
  });

  it("withholds READY when a required check could not run", () => {
    // postmerge.ps1's discipline: not-verified is never reported as clean.
    const v = verdict([row("pass"), row("skip")]);
    expect(v.code).toBe(1);
    expect(v.label).toBe("UNVERIFIED");
  });

  it("reports failure ahead of unverified when both are present", () => {
    expect(verdict([row("skip"), row("fail")]).label).toBe("NOT READY");
  });
});

describe("CLI contract", () => {
  const run = (args) => {
    try {
      const stdout = execFileSync(process.execPath, [SCRIPT, ...args], { encoding: "utf8" });
      return { code: 0, stdout, stderr: "" };
    } catch (e) {
      return { code: e.status, stdout: e.stdout ?? "", stderr: e.stderr ?? "" };
    }
  };

  it("refuses to run without --kind and says why (incident 0022)", () => {
    const r = run([]);
    expect(r.code).toBe(2);
    expect(r.stderr).toMatch(/--kind is required/);
    expect(r.stderr).toMatch(/0022/);
  });

  it("rejects an unknown kind", () => {
    expect(run(["--kind=whatever"]).code).toBe(2);
  });

  it("lists the available kinds in its usage text", () => {
    const { stderr } = run([]);
    for (const kind of ["docs", "impl", "design", "analysis"]) {
      expect(stderr).toContain(kind);
    }
  });
});
