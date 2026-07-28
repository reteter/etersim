// Tests for .claude/hooks/private-paths-guard.sh (owner ruling 2026-07-28, s29).
//
// docs/souvenirs/ is the owner's private material. A gate without a test regresses
// silently (incident 0030), and this one guards privacy rather than process, so the
// failure mode is worse than a stale rule.

import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const HOOK = resolve(REPO, ".claude/hooks/private-paths-guard.sh");

function decide(payload) {
  const r = spawnSync("bash", [HOOK], { input: JSON.stringify(payload), encoding: "utf8" });
  if (r.status !== 0) throw new Error(`hook exited ${r.status}: ${r.stderr}`);
  return JSON.parse(r.stdout).hookSpecificOutput?.permissionDecision ?? "allow";
}

const win = (rel) => `D:\\code\\claudeapp\\etersim\\${rel.replace(/\//g, "\\")}`;
const posix = (rel) => `D:/code/claudeapp/etersim/${rel}`;

describe("docs/souvenirs is denied outright", () => {
  const paths = [
    "docs/souvenirs/fable-farawell-session.md",
    "docs/souvenirs/opus48-coder-dump.md",
    "docs/souvenirs",
  ];
  for (const rel of paths) {
    it(`denies ${rel} (posix)`, () => expect(decide({ tool_input: { file_path: posix(rel) } })).toBe("deny"));
    it(`denies ${rel} (windows)`, () => expect(decide({ tool_input: { file_path: win(rel) } })).toBe("deny"));
  }

  it("denies when the path arrives as `path` (Glob/Grep shape)", () => {
    expect(decide({ tool_input: { path: posix("docs/souvenirs") } })).toBe("deny");
  });

  it("denies rather than asks — there is no legitimate read", () => {
    expect(decide({ tool_input: { file_path: posix("docs/souvenirs/x.md") } })).toBe("deny");
  });

  it("says why, and points at asking the owner instead", () => {
    const r = spawnSync("bash", [HOOK], {
      input: JSON.stringify({ tool_input: { file_path: posix("docs/souvenirs/x.md") } }),
      encoding: "utf8",
    });
    const reason = JSON.parse(r.stdout).hookSpecificOutput.permissionDecisionReason;
    expect(reason).toMatch(/private/i);
    expect(reason).toMatch(/ask the owner/i);
  });
});

describe("everything else passes", () => {
  for (const rel of ["docs/incidents/README.md", "docs/design-notes/README.md", "CONTEXT.md",
                     "docs/souvenirs-notes.md", "src/sim/ledger.ts"]) {
    it(`allows ${rel}`, () => expect(decide({ tool_input: { file_path: posix(rel) } })).toBe("allow"));
  }

  it("never blocks on an unreadable payload", () => {
    expect(decide({})).toBe("allow");
    const r = spawnSync("bash", [HOOK], { input: "{broken", encoding: "utf8" });
    expect(r.status).toBe(0);
    expect(JSON.parse(r.stdout)).toEqual({ continue: true });
  });
});
