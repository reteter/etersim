#!/usr/bin/env bash
# Reminds the session driver, at session start, that a hat carries a read-obligation.
#
# History: #410 (s25) answered the "how does a model learn what donning a hat entails"
# question with option (a) — a repo doc (docs/HATS.md) injected wholesale by this hook. The
# owner reversed that on 2026-07-28 (s29): the doc was a fourth copy of the same rule and
# spent 40% of itself justifying its own existence, so the map moved into CLAUDE.md §Hats.
#
# Why the hook survived the doc: no harness event fires when a model *declares* a hat — that
# is assistant prose, not a tool call — so SessionStart is still the only primitive that puts
# the obligation in context BEFORE any hat is announced, which is what failed in s25.
#
# What changed is that this hook no longer carries content. It injects a pointer, never a
# copy: CLAUDE.md is auto-loaded anyway, so duplicating its text here would create exactly
# the drift #410 was trying to prevent (and a copy inside a Claude-Code-specific hook is
# invisible to every other harness). A pointer cannot disagree with its target.
set -u

node -e '
  process.stdout.write(JSON.stringify({
    suppressOutput: true,
    hookEventName: "SessionStart",
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext:
        "Repo law reminder — a hat is a read-obligation, not a mood, and it is per TASK, " +
        "not per session. Before your first action under a hat, read its row in CLAUDE.md " +
        "§Hats and the files that row names. Announce the hat, and announce it again " +
        "when the work changes kind. Before touching anything, run " +
        "`npm run selfcheck -- --kind=<docs|impl|design|analysis>` and post the one-line " +
        "report it prints — required especially when it feels unnecessary (incident 0022)."
    }
  }));
'
