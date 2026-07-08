# 0001 — Coder subagent `cd`'d into main repo and switched `main`'s branch

- **Date:** 2026-07-08
- **Detected by:** The coder subagent self-reported it in its completion summary;
  the orchestrator then verified the main repo was clean and on the expected tip.
- **Status:** Closed — corrected in-session by the coder, before any commit.

## What happened

During E8 issue #58 (price-elastic flows), a coder subagent was running in its own
git worktree at `.claude/worktrees/agent-a0af333b41eeff5c6`. Early in the task it
issued a Bash `cd` that landed in the **main repository root**
(`D:\code\claudeapp\etersim`) instead of its worktree. It then ran
`git checkout -b feat/58-elastic-flows` — but because the shell was now in the main
checkout, this moved the **main repo's HEAD** from `main` onto the new branch.

No files were modified (working tree was clean) and no commits were made. The agent
noticed, ran `git checkout main` + `git branch -d feat/58-elastic-flows` in the main
repo to restore HEAD to `main`, and did the actual feature work correctly in its
worktree. The delivered branch (`feat/58-elastic-flows`, PR #65) is unaffected.

## Impact

- **Outcome:** Low — fully reverted, zero data loss, zero commits on `main`, tip
  unchanged (`0273377`). Blast radius was the main repo's HEAD ref for a short window.
- **Failure-mode class:** Medium — the same wrong-directory slip, had it been followed
  by `git commit`, `git reset --hard`, or `git add -A`, could have written to `main`
  or clobbered the working tree. The benign outcome was luck of timing, not design.
- **Rules broken/skipped:** `CLAUDE.md` §"Git & worktrees" — *"Check `git worktree
  list` before trusting `pwd` … use absolute paths (or `git -C <toplevel>`)"*. Also the
  Bash-tool guidance that `cd` in compound commands is fragile. Determinism and spec
  rules were not involved.

## Recurrence

**Medium** — structural driver: the worktrees are **nested inside the main repo**
(`.claude/worktrees/agent-*`) and the subagent's environment names the main repo as
its primary working directory, so an agent naturally gravitates to that absolute path.
Every coder-in-worktree spawn carries this latent hazard; it is not a one-off slip.

## Recommendation

- **Prevent:** coder prompts and the `coder` agent definition carry a standing rule —
  never `cd` to an absolute repo path; run git as `git -C <assigned-worktree>`; never
  `checkout`/`commit`/`reset` on `main`. Cheap, addresses the driver directly.
- **Detect:** after each coder wave the orchestrator verifies the main repo is clean
  and on the expected SHA (`git -C <main> status --short` + `log -1`). Already done
  this wave; keep it as a standing gate.
- **Contain:** a pre-commit / pre-checkout guardrail hook (the `git-guardrails`
  skill) is deliberately **not** adopted yet — the outcome is benign, self-correcting,
  and cheap to prevent. Revisit only if this recurs with an actual bad commit on `main`.

## Follow-up

Landed (owner sign-off 2026-07-08): prevention line added to `CLAUDE.md` §"Git &
worktrees" and to the `coder` agent definition (never `cd` to an absolute repo path,
never act on `main`, address git as `git -C <worktree>`). Detection gate (verify main
clean + SHA after each coder wave) kept as standing orchestrator practice.
