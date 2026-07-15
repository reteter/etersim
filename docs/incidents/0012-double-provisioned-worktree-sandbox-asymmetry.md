# 0012 — Double-provisioned worktree + sandbox asymmetry (coder wave #218 ‖ #154)

- **Date:** 2026-07-15
- **Detected by:** both coders self-reported the tool lock in their completion reports; Orchestrator confirmed against `git worktree list`.
- **Status:** Closed (work recovered intact on both branches; prevention below).

## What happened

The Orchestrator dispatched two parallel coders (#218 UI, #154 sim) and provisioned each worktree **twice**:

1. Manual `git worktree add` → `.claude/worktrees/agent-218`, `.claude/worktrees/agent-154`, with those paths **hardcoded in the task prompts**.
2. `isolation: "worktree"` passed to the Agent tool.

The `isolation: "worktree"` flag makes the **harness cut its own per-agent worktree** (`.claude/worktrees/agent-<agentId>` on branch `worktree-agent-<agentId>`) and **sandbox the agent's Edit/Write tools to that directory**. Each coder's prompt pointed it at the *manual* worktree, which the sandbox refused for Edit/Write ("This agent is isolated in the worktree agent-<id>"). The agent-id-named worktrees appearing in `git worktree list` — which the Orchestrator never created — were the proof.

The two coders diverged in their workaround:

- **#154** used **Bash (`node -e` + heredocs)** to write into the prompt-named `agent-154` worktree — Bash was **not** subject to the same sandbox — landing `fbace89` on `refactor/154-...`, pushed. The harness worktree was transient and auto-cleaned.
- **#218** accepted the harness worktree, committed there (`worktree-agent-a48967...`), and pushed by refspec `git push HEAD:feat/218-...`. The manual `agent-218` worktree stayed empty at the base SHA.

Recovery: both branches carried the correct work on origin. The Orchestrator reset the stale local `agent-218` to origin, removed the orphaned harness worktree + branch, and verified both diffs (including #154's Bash-heredoc-written files for escaping corruption — none found) before opening PRs #248 / #249.

## Impact

- **Outcome:** Low — no work lost; both deliverables recovered and verified. Cost: coder time spent diagnosing + improvising, and a fragile dependence on the coders noticing before writing to the wrong place.
- **Failure-mode class:** Medium — a coder that *didn't* verify the target before falling back could have committed to the wrong branch (`worktree-agent-<id>`) and reported success, leaving the Orchestrator to hunt for work that never reached the expected branch. The asymmetry (below) is the sharper hazard.
- **Rules broken/skipped:** none hard-broken — determinism, sim purity, TDD all held. Process defect in dispatch setup.

## Two lessons

1. **Double-provisioning collision.** `isolation: "worktree"` and manual `git worktree add` are two mechanisms for the same job; using both makes the harness sandbox one worktree while the prompt names another. Pick one.
2. **The sandbox is asymmetric — Bash is outside it.** Edit/Write were confined to the harness worktree, but Bash read/wrote the "forbidden" path freely (this is the entire basis of #154's workaround). **`isolation: "worktree"` is not a containment boundary for Bash.** Anyone reasoning about worktree isolation as a safety guarantee must not assume a sandboxed Edit/Write implies a sandboxed shell.

## Bonus lesson — resume-after-crash can silently drop an in-flight advisor call

Coder #154's advisor call was **in flight** when an API error killed the turn ("Advising using Opus 4.8" → "Connection closed mid-response"). On resume, the coder continued straight into the work ("Step 1: write the failing test") **without re-invoking the advisor** — not a conscious decision to skip it, but a consequence of resuming into a transcript whose advisor result never arrived. The resumed agent had no signal that the consult had been lost. (A separate advisor call near completion did land — but the mid-work consult was gone.)

**Watch:** when resuming a subagent after a mid-response API error, the resume message should name any tool call that was in flight and instruct the agent to redo it. A dropped advisor call is a silently skipped gate.

## Recurrence

Medium — structural. The double-provisioning is easy to repeat because pre-creating worktrees *feels* like the careful thing to do, and `isolation: "worktree"` is the documented requirement for parallel coders — the two look complementary until they collide. The resume-drops-advisor hazard recurs whenever a subagent crashes mid-advisor.

## Recommendation

- **Prevent (dispatch):** For parallel coders, keep `isolation: "worktree"` and **drop** the manual `git worktree add` + hardcoded path. In the prompt, say "work in your assigned worktree" and "push `HEAD:<target-branch>`" (the refspec move #218 improvised). Verify this convention against `docs/personas/CODER.md` before the next wave. Dropping isolation instead is **not** the fix — it drops each coder into the main checkout (the cd-into-main hazard of incident 0001).
- **Prevent (resume):** When resuming after a mid-response crash, explicitly re-issue any in-flight tool call (especially advisor) in the resume message.
- **Detect:** A coder that finds Edit/Write locked to an unexpected path should stop and flag *before* improvising (both did flag, in-report — earlier is better). Orchestrator verifies each branch's HEAD is reachable and diffs are in-scope + free of shell-write corruption before opening PRs.
- **Contain:** Bash-as-Edit workaround is acceptable as a last resort **only** with a post-hoc diff audit for escaping artifacts (done here).

## Follow-up

- Prevention (a) applied to the dispatch playbook this session; to be reflected in `docs/personas/CODER.md` / dispatch notes on the next wave.
- Incident logged in README §Log.
