// Tests for .claude/hooks/constitution-guard.sh (owner decision 2026-07-28, s29).
//
// The guard is a gate, and a gate without a test regresses silently — the exact shape of
// incident 0030. What must hold: every constitution path asks for consent, every work
// document passes untouched, and a malformed payload never blocks work.
//
// Windows paths are built here rather than in a shell string because bash mangles
// backslashes before node ever parses the JSON.

import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const HOOK = resolve(REPO, ".claude/hooks/constitution-guard.sh");

/** @returns "ask" | "allow" | "deny" */
function decide(payload) {
  const r = spawnSync("bash", [HOOK], { input: JSON.stringify(payload), encoding: "utf8" });
  if (r.status !== 0) throw new Error(`hook exited ${r.status}: ${r.stderr}`);
  const out = JSON.parse(r.stdout);
  return out.hookSpecificOutput?.permissionDecision ?? "allow";
}

const win = (rel) => `D:\\code\\claudeapp\\etersim\\${rel.replace(/\//g, "\\")}`;
const posix = (rel) => `D:/code/claudeapp/etersim/${rel}`;

const PROTECTED = [
  "CLAUDE.md",
  "AGENTS.md",
  "docs/PROCESS.md",
  "docs/workflows/verification.md",
  "docs/workflows/documentation.md",
  "docs/personas/CODER.md",
  ".claude/agents/coder.md",
  ".claude/hooks/constitution-guard.sh",
  ".claude/settings.json",
];

const FREE = [
  "CONTEXT.md",
  "docs/HANDOFF.md",
  "docs/PRD.md",
  "docs/adr/0007-routes-may-wait-margin-gate.md",
  "docs/specs/E11-proving-grounds.md",
  "docs/design-notes/README.md",
  "docs/incidents/0031-tier1-declared-with-half-the-check-run.md",
  "src/sim/ledger.ts",
  "package.json",
  "scripts/selfcheck.mjs",
];

describe("constitution paths require owner consent", () => {
  for (const rel of PROTECTED) {
    it(`asks for ${rel} (windows path)`, () => {
      expect(decide({ tool_input: { file_path: win(rel) } })).toBe("ask");
    });
    it(`asks for ${rel} (posix path)`, () => {
      expect(decide({ tool_input: { file_path: posix(rel) } })).toBe("ask");
    });
  }

  it("explains itself, naming the decision and the ungated categories", () => {
    const r = spawnSync("bash", [HOOK], {
      input: JSON.stringify({ tool_input: { file_path: win("CLAUDE.md") } }),
      encoding: "utf8",
    });
    const reason = JSON.parse(r.stdout).hookSpecificOutput.permissionDecisionReason;
    expect(reason).toMatch(/2026-07-28/);
    expect(reason).toMatch(/CONTEXT\.md/);
    expect(reason).toMatch(/HANDOFF\.md/);
  });
});

describe("work documents are never gated", () => {
  for (const rel of FREE) {
    it(`allows ${rel}`, () => {
      expect(decide({ tool_input: { file_path: win(rel) } })).toBe("allow");
    });
  }

  it("allows docs/incidents/ — gating an incident report would be actively harmful", () => {
    expect(decide({ tool_input: { file_path: posix("docs/incidents/0032-new.md") } })).toBe("allow");
  });

  it("allows a new ADR, since the hook cannot tell creation from edit", () => {
    expect(decide({ tool_input: { file_path: posix("docs/adr/0010-something.md") } })).toBe("allow");
  });
});

describe("never blocks on a payload it cannot read", () => {
  it("allows when file_path is absent", () => {
    expect(decide({ tool_input: { command: "ls" } })).toBe("allow");
  });

  it("allows when tool_input is absent", () => {
    expect(decide({})).toBe("allow");
  });

  it("allows on malformed JSON", () => {
    const r = spawnSync("bash", [HOOK], { input: "{not json", encoding: "utf8" });
    expect(r.status).toBe(0);
    expect(JSON.parse(r.stdout)).toEqual({ continue: true });
  });

  it("reads notebook_path as well as file_path", () => {
    expect(decide({ tool_input: { notebook_path: win("CLAUDE.md") } })).toBe("ask");
  });
});

describe("path matching is not fooled by case or separator", () => {
  it("matches a lowercased drive letter", () => {
    expect(decide({ tool_input: { file_path: "d:/code/claudeapp/etersim/CLAUDE.md" } })).toBe("ask");
  });

  it("does not gate a lookalike outside the protected trees", () => {
    expect(decide({ tool_input: { file_path: posix("docs/workflows-notes.md") } })).toBe("allow");
    expect(decide({ tool_input: { file_path: posix("docs/personas-old/CODER.md") } })).toBe("allow");
  });
});
