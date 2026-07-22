#!/usr/bin/env bash
# Blocks bare (no -C) state-mutating `git` commands whenever the Bash tool's
# cwd has silently drifted away from the main repo root — the failure class
# behind incidents 0008, 0021, 0026 (a `cd` into a worktree from an earlier,
# unrelated command persists, and a later bare `git commit`/`checkout -b`/
# `push` lands in the stale worktree instead of main).
#
# No jq dependency (not installed in this repo's Git Bash) — JSON in/out via node.
set -u

MAIN_ROOT="D:/code/claudeapp/etersim"

input="$(cat)"
cmd="$(printf '%s' "$input" | node -e '
  let d = "";
  process.stdin.on("data", c => d += c);
  process.stdin.on("end", () => {
    try { process.stdout.write(JSON.parse(d).tool_input?.command ?? ""); }
    catch { process.stdout.write(""); }
  });
')"

allow() { echo '{"continue": true}'; exit 0; }

[ -z "$cmd" ] && allow

# Only commands that actually invoke `git` are in scope.
printf '%s' "$cmd" | grep -Eq '(^|[;&|]|[[:space:]])git([[:space:]]|$)' || allow

# Only state-mutating subcommands are risky; read-only ones are always safe.
printf '%s' "$cmd" | grep -Eq '\bgit[[:space:]]+(checkout|commit|push|merge|reset|rebase|add|restore|clean|cherry-pick|stash[[:space:]]+(apply|pop|drop)|branch[[:space:]]+-[dDm])\b' || allow

# Already explicit about location: safe by construction.
printf '%s' "$cmd" | grep -Eq -- '(^|[[:space:]])-C([[:space:]]|$)' && allow

# Self-contained `cd <abs-path> && ...` in the SAME command: not ambient state.
printf '%s' "$cmd" | grep -Eq '(^|;|&&)[[:space:]]*cd[[:space:]]+["'"'"']?(/|[A-Za-z]:)' && allow

# Resolve where this bare command would actually run.
toplevel="$(git rev-parse --show-toplevel 2>/dev/null)"
[ -z "$toplevel" ] && allow

norm_toplevel="$(printf '%s' "$toplevel" | tr '[:upper:]' '[:lower:]' | tr '\\' '/')"
norm_main="$(printf '%s' "$MAIN_ROOT" | tr '[:upper:]' '[:lower:]' | tr '\\' '/')"

[ "$norm_toplevel" = "$norm_main" ] && allow

reason="This bare git command would run inside $toplevel, not the main repo root ($MAIN_ROOT) -- likely stale cwd from an earlier cd (incidents 0008/0021/0026). Either add -C \"$MAIN_ROOT\" (or the specific worktree path if this IS intended), or cd back to the main repo root first."

TOPLEVEL="$toplevel" REASON="$reason" node -e '
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: process.env.REASON
    }
  }));
'
