#!/usr/bin/env bash
# Denies model access to the owner's private paths — read as well as write.
#
# docs/souvenirs/ is the owner's own material (session keepsakes), gitignored and never
# pushed. It is not documentation and is not evidence: no model reads it, greps it, or
# edits it (owner ruling 2026-07-28, s29).
#
# `deny`, not `ask`: unlike the constitution, there is no legitimate case for a model to
# open these. The constitution guard asks because the owner does authorize those edits;
# here the answer is always no.
#
# Note for anyone extending this: `.gitignore` does NOT protect these. The Grep tool
# (ripgrep) skips ignored paths by default, but a `grep -r` run through Bash reads them
# happily — which is how they were read in s29 before this hook existed. Bash is not
# covered here; the rule in CLAUDE.md §Rules is what binds that path.
set -u

input="$(cat)"

path="$(printf '%s' "$input" | node -e '
  let d = "";
  process.stdin.on("data", c => d += c);
  process.stdin.on("end", () => {
    try {
      const t = JSON.parse(d).tool_input ?? {};
      process.stdout.write(t.file_path ?? t.notebook_path ?? t.path ?? "");
    } catch { process.stdout.write(""); }
  });
')"

allow() { echo '{"continue": true}'; exit 0; }

[ -z "$path" ] && allow

rel="$(printf '%s' "$path" | tr '\\' '/' | tr '[:upper:]' '[:lower:]')"
rel="${rel#*/etersim/}"

case "$rel" in
  docs/souvenirs|docs/souvenirs/*) ;;
  *) allow ;;
esac

reason="docs/souvenirs/ is the owner's private material -- gitignored, never pushed, and out of bounds for models to read or edit (owner ruling 2026-07-28). It is not documentation and not evidence for any decision. If you believe something in there matters, ask the owner rather than opening it."

REASON="$reason" node -e '
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: process.env.REASON
    }
  }));
'
