# Agent memory — cross-machine export

Claude Code's file-based memory lives per machine (`~/.claude/projects/<project>/memory/`),
so lessons learned on one machine don't travel with the repo. This file is the
repo-versioned export of the entries worth carrying anywhere. Machine-local entries
(quirks of a specific checkout) stay in the per-machine index and are deliberately not
exported. Update this file when a durable, machine-independent lesson lands; delete
entries when they expire.

Last export: 2026-07-15. Session-state notes (queue, watch items) do NOT live here —
they live in [HANDOFF.md](HANDOFF.md), the canonical per-session note.

## Windows gh/git encoding pitfall (feedback)

Piping `gh`/`git` text through python or PowerShell on Windows garbles UTF-8 (locale
cp1250 re-decodes it: ₸ → "â‚¸", — → "â€""). Never edit PR/issue bodies through a pipe:
Write the full text to a file (UTF-8) and use `gh pr edit --body-file` /
`gh issue edit --body-file` / `git commit -F`. Trace: PR #135's body was garbled this
way; tracked as issue #136 → docs/incidents/0007. Related PowerShell quirk
(2026-07-15): `gh api repos/{owner}/{repo}/...` placeholder syntax fails
("command parameter was already specified") — use the explicit `owner/repo` path.

## Model ladder for orchestration (feedback, owner-confirmed 2026-07-13)

> **Superseded 2026-07-15** by [WORKFLOW.md](WORKFLOW.md) §Casting is model-agnostic:
> roles are capability-tier contracts (cheap/strong/frontier) with a one-line
> replaceable current casting; PRD roadmap items carry `procedural` /
> `design-frontier` labels. The section below stays as the historical rationale —
> its dispatch principles (package quality buys coder cheapness; gates distrust
> coder green regardless of model) still hold.

- **Main session (Orchestrator): Fable** (effort xhigh while available) — reasoning
  concentrated where decisions compound: task packages, file-collision analysis, review
  aggregation.
- **Two-axis reviewers / in-flight advisor: Opus** (`model: "opus"`) — strong enough to
  catch Sonnet's bugs, avoids Sonnet-reviewing-Sonnet blindspots, far cheaper than Fable
  (reviewing on Fable would exhaust the owner's subscription).
- **Coder subagents: Sonnet** (`model: "sonnet"`) for small/medium tasks with
  pre-resolved packages (verbatim ACs, named files, hard scope walls). Fable/Opus coder
  only for deep sim work (tick-integration class, incident-0005 risk).

The safety net (two-axis review + owner merge) is designed to distrust coder green
regardless of model, so a cheaper coder shifts load onto review rather than weakening
gates. The better the dispatch package, the cheaper the coder can safely be. Practical:
pass `model:` explicitly per Agent call; `subagent_type: "coder"` registers only at
session start — in a session older than the agent def, fall back to `general-purpose`
with the persona files named in the prompt. Watch-out observed 2026-07-13: a Sonnet
coder spontaneously ran a self `/code-review` (incident-0005 pattern, budget burn) —
coder packages should explicitly forbid spawning subagents.

## GitHub Actions minutes near-exhausted (project; expires with the billing cycle)

The repo is private, so CI consumes the `reteter` account's Actions minutes; as of
2026-07-13 the budget is nearly gone (odd ~$1.49 spending limit, no funds to add).
Observed: runs can sit `queued` ~10 minutes before a runner appears — slow, not dead;
don't panic-cancel (GitHub auto-cancels after 24 h). If Actions stops entirely, the
owner accepts merging on local gates — CLAUDE.md's documented merge gates (tests,
typecheck, lint, `/code-review`) are all local; CI was never a documented gate.
Compensate locally: `npm run build` (not in the routine trio) and Playwright E2E for UI
changes; watch for Linux-only breakage invisible on Windows (import-path casing, CRLF).

## Frontier access is intermittent (user context, updated 2026-07-15)

Fable access runs through **2026-07-19** with no renewal promised; the next frontier
partner may be a non-Claude model in a non-Claude harness. That is why the process is
model-agnostic (WORKFLOW §Casting) and why everything a session needs lives in the
repo: HANDOFF.md (state), agent-memory.md (durable lessons), PRD/specs (direction),
incidents (scars). The owner works from the terminal CLI; `gh` is the sync mechanism
between machines. Don't assume frontier-tier capacity when planning scope —
`design-frontier` items wait for an owner-led grill.
