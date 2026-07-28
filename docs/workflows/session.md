# Session rituals (start / close)

Lightweight by design (ceremony slim, owner decision 2026-07-16).

- **Start:** read [HANDOFF.md](../HANDOFF.md) → `gh issue list` → prune merged branches →
  `npm run selfcheck -- --kind=<docs|impl|design|analysis>` → post the one-line report it
  prints (`CLAUDE.md` §Before you start) → recap locked decisions in one line → declare the
  hat. Once the work is named, **rewrite HANDOFF with this session's intent** before acting.
- **During grills:** label branches ("**Branch 2.3 — …**"), one focused question at a time,
  consistent decision language ("Locked:" / "Open branch:" / "Extracting to issue #NN"). After
  each decision, update spec / `CONTEXT.md` / issues immediately.
- **Close:** 2–3-sentence retro, then **rewrite HANDOFF** — where the work stopped, what the
  next session must know. The session-close docs batch commits straight to `main`
  ([documentation.md](documentation.md) §Session-boundary docs exception).

## HANDOFF's rewrite contract

Owner decision 2026-07-28, replacing the 2026-07-16 owner-request rule.

Written and overwritten by the **session-driving model only** — never a coder, never a
subagent — at both boundaries, and kept to **~15 lines**.

**Admission rule:** *if `git log` or `gh issue list` answers a sentence, that sentence does not
belong there.* What does: the owner-agreed order of work, why the last session stopped where it
did, and **promises that are not tasks** — a bet with a falsifier, a decision waiting on the
owner. An obligation that *is* a task goes to the issue tracker instead
([documentation.md](documentation.md)); owner rulings that outlive a session are not state and
live outside the file. History needs no section: `git log -p docs/HANDOFF.md`.

**Project notes do not live in per-machine auto-memory** (same decision) — that channel carries
only what is true of this machine and this owner.

## How the rewrites reach `main`

The `main`-commit exception covers **`docs/HANDOFF.md` alone, at either session boundary** —
one file, one commit, so `git show --stat` naming anything else is the violation.

Commit the start-of-session rewrite rather than leaving it in the working tree: an uncommitted
HANDOFF dirties the baseline `npm run selfcheck` reports for every later task in the session.
