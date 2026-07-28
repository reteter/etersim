# Session rituals (start / close)

Lightweight by design (ceremony slim, owner decision 2026-07-16).

- **Start:** read [HANDOFF.md](../HANDOFF.md), check `gh issue list`, prune merged branches,
  then run `npm run selfcheck -- --kind=<docs|impl|design|analysis>` and post the one-line
  report it prints (`CLAUDE.md` §Before you start). Recap locked decisions in one line and
  declare the working hat. Once the work is named, **rewrite HANDOFF with this session's
  intent** before acting.
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
belong there.* What does belong: the owner-agreed order of work, why the last session stopped
where it did, and **promises that are not tasks** — a bet with a falsifier, a decision waiting
on the owner. An obligation that *is* a task still goes to the issue tracker
([documentation.md](documentation.md): a trigger is a promise), and owner rulings that outlive a
session are not state and live outside the file. History needs no section:
`git log -p docs/HANDOFF.md`.

Why this replaced the owner-request rule rather than reviving what preceded it: HANDOFF *was* a
per-session note before 2026-07-16, it swelled, and the remedy taken then — closing updates —
treated the symptom. The length budget and the admission rule bind the cause.

**Project notes no longer live in per-machine auto-memory** (same decision) — that channel is
only for what is true of this machine and this owner.

## How the rewrites reach `main`

Owner decision 2026-07-28. The `main`-commit exception covers **`docs/HANDOFF.md` alone, at
either session boundary** — one file, one commit, so `git show --stat` naming anything else is
the violation.

The start-of-session rewrite is committed rather than left in the working tree: an uncommitted
HANDOFF dirties the baseline `npm run selfcheck` reports for every later task in the session,
and invites the file into an unrelated feature commit.
