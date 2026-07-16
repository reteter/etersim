# 0014 — Fix-loop dispatched a fresh coder without worktree isolation (near-miss)

**Date:** 2026-07-16 · **Severity:** process 2/5, impact 0/5 (caught before any effect)

## What happened

Closing the E9.1 wave-1 review, the Orchestrator dispatched the fix package as a
**new** coder Agent call instead of resuming the original coder — violating the LCM
"resume over fresh" rule — and the new call omitted `isolation: "worktree"`, so the
fresh agent had no assigned worktree while its prompt said "work in your assigned
worktree" (incident 0012's double-provision cousin: zero-provision). A fresh coder
without isolation can act on the main checkout (incident 0001 territory). The owner's
question about reviewer count moments earlier had primed a rules re-read; the mistake
was spotted immediately, the agent stopped before it touched anything, and main was
verified clean (SHA + status). The fix package then went to the original coder via
resume, correctly.

## Impact

None materialized. Cost: one wasted agent spawn (~seconds of runtime).

## Recommendation

Fix-loop dispatches are **resumes by definition** — the reviewer's findings go back to
the coder that owns the branch and the context. If a genuinely new agent is ever needed
mid-wave (original unrecoverable), it needs the full dispatch discipline:
`isolation: "worktree"`, refspec push, no absolute paths. Watch for the pattern:
"small follow-up task" is exactly when dispatch discipline silently drops.

## Follow-up

§Log line added. No code/doc changes needed — the rule already existed (WORKFLOW §LCM,
CLAUDE.md §Git & worktrees); this is a compliance scar, not a gap.
