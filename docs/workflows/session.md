# Session rituals (start / close)

Lightweight by design (ceremony slim, owner decision 2026-07-16).

- **Start:** `gh issue list` → `gh issue list --label needs:owner-decision` (what is blocked on
  an owner call) → the milestone descriptions, `gh api repos/:owner/:repo/milestones` (the
  owner-agreed order) → prune merged branches → `npm run selfcheck -- --kind=<docs|impl|design|analysis>`
  and post the one-line report it prints (`CLAUDE.md` §Before you start). Recap locked decisions
  in one line and declare the hat.
- **During grills:** label branches ("**Branch 2.3 — …**"), one focused question at a time,
  consistent decision language ("Locked:" / "Open branch:" / "Extracting to issue #NN"). After
  each decision, update spec / `CONTEXT.md` / issues immediately.
- **Close:** 2–3-sentence retro, then **leave the carry-over in the tracker**: file what was
  learned, close what was discharged, post the newest acceptance criteria as a comment on
  anything re-scoped, and set `needs:owner-decision` on anything now waiting on the owner. The
  session-close docs batch (scorecard rows, incident reports, memory exports) commits straight
  to `main` ([documentation.md](documentation.md) §Session-boundary docs exception).

## Cross-session state lives in the tracker

Owner decision 2026-07-28. There is no handoff document.

**The rule:** a thing worth telling the next session is worth an issue. If it does not deserve
one, it does not deserve to be written down.

**Where each kind goes:**

| Carry-over | Home |
| --- | --- |
| Work to do | an issue, milestoned |
| Blocked on an owner call | an issue labelled `needs:owner-decision` |
| The agreed order of work | milestone descriptions |
| Why a spec cannot be trusted yet | an issue, plus a warning in that spec's row in [specs/README.md](../specs/README.md) |
| A bet with a falsifier | an issue that closes when it is measured |
| Reasoning behind a parked idea | a design note — with an issue carrying the obligation ([documentation.md](documentation.md)) |

**Why the document went away.** `docs/HANDOFF.md` was tried in three shapes: a per-session
note (swelled), an owner-request export (went stale between asks, and its own §Watch outlived
promises that had already been discharged), and a ~15-line budgeted note — which broke its own
budget within a single session, reaching 52 lines and logging what that session had *done*.
Each shape failed the same way: **nothing obliged the document to stay true.** `gh issue list`
is swept at every session start, an issue has an open/closed state nobody has to maintain by
hand, and a milestone description is read by whoever picks up the milestone. The tracker has
the obligation the document never had.

**Project notes do not live in per-machine auto-memory either** (same decision) — that channel
carries only what is true of this machine and this owner.
