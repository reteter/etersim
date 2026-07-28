#!/usr/bin/env bash
# Requires explicit owner consent before a model edits the process constitution.
#
# Why (owner decision 2026-07-28, s29): these files are read by every session and
# rewritten by none of them in passing. Their protection used to be *prose* — a rule
# carried its own history so a later model would not "tidy away" something whose point
# it could not see. The owner's call replaces that with a gate: block the edit, and the
# rule no longer needs to argue for its own existence in every session's context. This
# is what let the constitution shed its narrative (incident 0030's lesson applied to
# documents instead of detectors: a law nothing enforces is not enforced).
#
# `ask`, not `deny`: the owner does authorize these edits — a session like s29 is
# nothing but constitution edits. What must not happen is an *incidental* rewrite
# during unrelated work.
#
# Deliberately NOT protected — documents whose editing IS the normal work, where a
# gate would fight a law we already have: CONTEXT.md (glossary-first requires the entry
# before the identifier),
# docs/specs/* (spec sync ships with the task), docs/PRD.md, docs/adr/*,
# docs/design-notes/*, docs/incidents/* (never gate filing an incident).
#
# A hook is Claude-Code-specific, so CLAUDE.md §Rules states the same rule for any
# other harness. This file is the enforcement, not the source.
#
# JSON in/out via node, not jq: node is guaranteed wherever this repo builds, while jq is a
# per-machine install (present on the owner's machine since 2026-07-28, absent when these
# hooks were written — the earlier "jq is not installed" note is no longer the reason).
set -u

input="$(cat)"

path="$(printf '%s' "$input" | node -e '
  let d = "";
  process.stdin.on("data", c => d += c);
  process.stdin.on("end", () => {
    try {
      const t = JSON.parse(d).tool_input ?? {};
      process.stdout.write(t.file_path ?? t.notebook_path ?? "");
    } catch { process.stdout.write(""); }
  });
')"

allow() { echo '{"continue": true}'; exit 0; }

[ -z "$path" ] && allow

# Normalise to a repo-relative, forward-slashed, lowercase path.
rel="$(printf '%s' "$path" | tr '\\' '/' | tr '[:upper:]' '[:lower:]')"
rel="${rel#*/etersim/}"

case "$rel" in
  claude.md|agents.md) ;;
  docs/workflows/*|docs/personas/*|docs/process.md) ;;
  .claude/agents/*|.claude/hooks/*|.claude/settings.json) ;;
  *) allow ;;
esac

reason="\"$rel\" is part of the process constitution: it is read by every session, and editing it is a decision rather than a task (owner decision 2026-07-28). Confirm only if the owner asked for this change in THIS session; otherwise report what you would change and let them decide. Work documents are not gated -- CONTEXT.md, docs/specs/, docs/PRD.md, docs/adr/, docs/design-notes/ and docs/incidents/ stay freely editable."

REASON="$reason" node -e '
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "ask",
      permissionDecisionReason: process.env.REASON
    }
  }));
'
