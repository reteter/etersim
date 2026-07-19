# 0018 — `gh auth switch` leaves git's credentials on the old account (known lesson that didn't travel)

- **Date:** 2026-07-19
- **Detected by:** Coder subagent self-report — `git push` failed 403 mid-wave (#299).
- **Status:** Closed (push unblocked; config side effect reverted at session close; prevention below).

## What happened

The session ran on a shared machine with two GitHub accounts authenticated (the
machine owner's and the repo owner's). At session start the driver ran
`gh auth switch --user <repo-owner>`; `gh auth status` confirmed it and kept showing
the correct active account all session.

A coder subagent then pushed and got `403: Permission to <owner>/etersim.git denied to
<machine-owner>`. `gh auth switch` moves gh's own active account but **not** git's
credential-helper cache, which still handed git the other account's token. The coder
resolved it with `gh auth setup-git` and pushed successfully.

Two things surfaced only when the driver wrote this report:

1. **This was already known.** The previous session (2026-07-18) hit the identical
   403 and recorded it in per-machine auto-memory, together with a deliberately
   non-invasive fix. That lesson never reached this session's coder — **auto-memory is
   per-machine and is not part of a subagent's context.**
2. **The coder's fix mutated the machine owner's global config.** `gh auth setup-git`
   wrote `credential.https://github.com.helper` (and the gist equivalent) into the
   global `.gitconfig`, routing *all* of that machine's GitHub git auth through gh's
   active account — precisely what the 07-18 session had avoided on purpose.

## Impact

- **Outcome:** Low — a loud 403, one retry, work unaffected. The global-config change
  was caught the same session and reverted; no wrong-identity commit or push landed.
- **Failure-mode class:** Medium — the same token divergence in the other direction
  fails *silently*: pushes land under an identity the session never chose, and where
  both accounts have write access nothing errors at all. Commit authorship
  (`git config user.*`) is a third, independently-set piece of state.
- **Rules broken/skipped:** none by the letter. `gh auth status` was checked and was
  accurate about what it reports. The config mutation was outside the task package's
  scope but was self-reported, which is the contract working.

## Recurrence

**High** — two structural drivers, and the second is the interesting one:

- `gh auth status` is not a statement about git's push identity. Two tools, two
  caches, one plausible-looking confirmation.
- **A lesson stored only in per-machine auto-memory does not travel.** It reaches the
  next session on that machine and nothing else — not subagents, not other machines,
  not other harnesses. This project explicitly expects work on borrowed machines, so
  machine-shaped lessons belong in repo docs, which every dispatch can be pointed at.

**Third time in this family** (owner observation at filing). Same failure shape as
[0017](0017-casting-override-lived-only-in-prose.md) — an authoritative fact living in
prose/memory while the operative source was elsewhere — and as
[0016](0016-skill-fanout-overrode-tiered-review-gate.md) — a rule in a file outshouted
by something with higher salience. The generalization worth carrying forward:

> **Auto-memory is a working channel, not a home for gotchas.** It is per-machine,
> invisible to subagents, and unversioned. A gotcha earns its place in repo docs —
> `CLAUDE.md`, an incident, or a persona/task-package — the moment anyone other than
> the next session on this exact machine could hit it. Memory may *point* at the
> durable record; it must not *be* the record.

## Recommendation

- **Prevent:** use the **non-invasive per-push override**, not `gh auth setup-git`,
  on a machine you do not own:
  `git -c credential.helper= -c credential.helper='!gh auth git-credential' push`
  (first `-c` clears the default helper list, second routes auth through gh's active
  account). Leaves no config behind. `gh auth setup-git` is fine on your own machine.
- **Detect:** `git ls-remote origin` right after switching accounts — cheapest early
  tell, before a coder's first push finds it the hard way.
- **Contain:** nothing enforces identity at commit time; the account switch/restore
  at session close stays a human ritual step.

## Follow-up

- Landed in `CLAUDE.md` §Git & worktrees (so it reaches task packages and other
  machines, not just this machine's auto-memory).
- Global `credential.https://github.com.helper` / gist entries written by
  `gh auth setup-git` removed at session close, restoring the machine as found.
