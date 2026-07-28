# etersim — agent entry point (any model, any harness)

This is the vendor-neutral bootstrap: a pointer file, nothing more. Whether your harness
auto-loaded it (AGENTS.md is the emerging cross-vendor convention) or the owner opened the
session with *"Read AGENTS.md and follow it"* — read these, in order:

1. **`CLAUDE.md`** — the project rules: source-of-truth map, laws, git/worktree rules,
   commands. The filename is historical (this repo was built with Claude Code); treat it as
   PROJECT.md — nothing in it is Claude-specific.
2. **The issue tracker** — `gh issue list` for open work, `gh issue list --label
   needs:owner-decision` for what is blocked on an owner call, and the milestone descriptions
   (`gh api repos/:owner/:repo/milestones`) for the owner-agreed order. There is no handoff
   document: cross-session state lives where it is swept every session (owner decision
   2026-07-28).
3. **`npm run selfcheck -- --kind=<docs|impl|design|analysis>`** — the pre-work check. Run
   it and post the one-line report it prints before touching anything. It works for any
   model in any harness; the rules around it are `CLAUDE.md` §Before you start.

**This file states no rules of its own, deliberately** (owner decision, 2026-07-28). It
used to repeat a "hard floor" — never commit to `main`, determinism, glossary-first — and
that copy drifted against `CLAUDE.md` until the two contradicted each other on committing to
`main`, so two harnesses could behave oppositely and both be right. A second copy of a law
is a second thing to keep true. **`CLAUDE.md` is the authority; if this file ever seems to
say otherwise, `CLAUDE.md` wins — and the fix is to delete the copy here, not to reconcile
it.** Resist the urge to be helpful by restating the laws below step 1.
