# etersim — agent entry point (any model, any harness)

This is the vendor-neutral bootstrap. Whether your harness auto-loaded this file
(AGENTS.md is the emerging cross-vendor convention) or the owner opened the session
with *"Read AGENTS.md and follow it"* — do this, in order:

1. **Read `CLAUDE.md`** — the project rules. The filename is historical (this repo
   was built with Claude Code); treat it as PROJECT.md — nothing in it is
   Claude-specific: source-of-truth map, laws, git/worktree rules, commands.
2. **Read `docs/HANDOFF.md`** — the cross-harness export: only what `git log` / `gh`
   cannot derive — owner-agreed order, owner framings, resumable-state pointers.
   Since 2026-07-16 it updates only on owner request — read `git log` / `gh issue
   list` directly for the current commit and open work; this file no longer claims them.
3. **Before any task**: run the checklist in `docs/SELFCHECK.md` (§1–§5) and post
   its report before touching anything. It is explicitly written for any model.

Hard floor, valid even before you read anything else:

- Work on feature branches; **never commit to `main`**. The owner merges every PR.
- `src/sim` is pure and deterministic: no `Math.random`, no `Date.now`, no
  React/DOM imports there, ever. TDD for `src/sim`.
- English in code/docs/commits/issues; **Polish in conversation with the owner**;
  player-facing UI strings in Polish.
- New domain concept ⇒ `CONTEXT.md` glossary entry first; identifiers use its terms.
- Roadmap items labeled `design-frontier` (docs/PRD.md §Roadmap labels) are not
  task-queue work — they wait for an owner-led design conversation.
