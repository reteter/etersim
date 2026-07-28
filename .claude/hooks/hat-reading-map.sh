#!/usr/bin/env bash
# Injects docs/HATS.md into context at session start (#410, option (a)).
#
# Why a hook at all: no harness event fires when a model *declares* a hat — that is
# assistant prose, not a tool call. SessionStart is the closest reliable primitive, so
# the map lands in context BEFORE any hat is announced rather than being fetched after
# the fact (which is what failed in s25).
#
# Why the content is not in this file: the repo is model-agnostic (WORKFLOW / PROCESS /
# HANDOFF are read by any harness). A hook is Claude-Code-specific, so it may only
# *surface* the map, never own it — one source, per the decisions-propagate law.
#
# Resolves docs/HATS.md relative to this script (repo root = ../..), so it works from a
# worktree or a clone at any path. Never blocks: a missing or unreadable file exits 0
# with no context injected.
set -u

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
hats="$repo_root/docs/HATS.md"

[ -r "$hats" ] || exit 0

# No jq dependency (parity with the other hooks in this directory) — JSON out via node.
HATS_PATH="$hats" node -e '
  const fs = require("fs");
  let body;
  try { body = fs.readFileSync(process.env.HATS_PATH, "utf8"); } catch { process.exit(0); }
  process.stdout.write(JSON.stringify({
    suppressOutput: true,
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext:
        "Repo law (docs/HATS.md) — donning a hat obliges you to have read that row " +
        "BEFORE your first action under it:\n\n" + body
    }
  }));
'
