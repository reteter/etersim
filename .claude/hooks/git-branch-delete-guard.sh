#!/usr/bin/env bash
# Surfaces destructive branch deletions to the owner before they run (incident 0027).
# Two cases git itself does NOT protect you from:
#   - `git branch -D` (force) deletes an UNMERGED local branch — git's own `-d`
#     refuses exactly this, so `-D` is the override that loses quarantined work.
#   - `git push --delete` / `push <remote> :<ref>` deletes a REMOTE branch — no
#     native safety at all, effectively irreversible.
# Routine merged-branch cleanup (`git branch -d`, and postmerge.ps1's deletes which
# run through the PowerShell tool, not Bash) is unaffected. This hook returns "ask",
# not "deny", so the owner decides in the moment — no marker/override needed.
#
# No jq dependency (parity with git-worktree-guard.sh) — JSON in/out via node.
set -u

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
printf '%s' "$cmd" | grep -Eq '(^|[;&|]|[[:space:]])git([[:space:]]|$)' || allow

# Local force-delete: `git branch -D` (or the explicit --delete --force pair).
local_force=false
printf '%s' "$cmd" | grep -Eq '\bbranch\b[^;&|]*(-[a-zA-Z]*D|--delete[[:space:]]+--force|--force[[:space:]]+--delete)' && local_force=true

# Remote branch delete: `git push ... --delete/-d`, or a colon refspec `push origin :ref`.
remote_del=false
printf '%s' "$cmd" | grep -Eq '\bpush\b[^;&|]*(--delete\b|[[:space:]]-d\b|[[:space:]]:[A-Za-z0-9._/-]+)' && remote_del=true

[ "$local_force" = false ] && [ "$remote_del" = false ] && allow

if [ "$local_force" = true ]; then
  reason="Force branch delete (git branch -D) removes an UNMERGED local branch — git's own -d refuses this, so -D is how quarantined/eval work gets lost (incident 0027). Confirm the branch is truly disposable (or preserved on a remote) before approving. Use -d for merged branches to keep git's native safety."
else
  reason="Remote branch delete (git push --delete / :ref) is effectively irreversible and has no native safety (incident 0027). Confirm the branch is disposable before approving."
fi

REASON="$reason" node -e '
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "ask",
      permissionDecisionReason: process.env.REASON
    }
  }));
'
