# HANDOFF — orientation for the next session

**Written and overwritten by the session-driving model only** (never a coder, never a
subagent), at session start and at session close. Kept to ~15 lines: it is the shortest
thing that lets the next session start without re-deriving. Previous versions:
`git log -p docs/HANDOFF.md`.

**Admission rule:** if `git log` or `gh issue list` answers a sentence, that sentence does
not belong here. What belongs: the owner-agreed *order* of work, why we stopped where we
stopped, and **promises that are not tasks** (a bet with a falsifier, a decision waiting on
the owner) — the issue tracker rightly rejects those, so this is their only home. Owner
rulings that outlive a session are not state and live outside this file.

_Rewritten 2026-07-28, s29 start. Supersedes the owner's 2026-07-16 owner-request rule:
that rule treated a symptom (the file drifted, so updates were closed) while this one binds
the cause (length budget + admission rule)._

## State

E16 Workbench is in flight; **#393 is its last fan-out item** and its gate cleared when #419
merged. Outside E16 the owner-agreed order stands: **E11 v1** (#232 → #233 → #234), then
**E15**. This session is docs reorganization, not code.

## For the next session

- **E11's spec §Ledger schema contradicts `src/sim/ledger.ts`** (unitPrice/thalersAfter,
  departure events, 2-part net worth — none current). #233 says "emit JSONL per spec", so a
  coder would get a conflicting contract. Refresh the spec **before #232**.
- **E15's spec says SAVE_VERSION v14, which E13 already consumed** — grill OQ8 settled v15.
  A spec instructing a broken migration, not merely a stale line (ADR-0007 territory).
- **Left from s29's docs untangling:** promote WORKFLOW's cited-but-not-heading paragraphs
  (`§Batching`, `§Model ladder`, `§PR timing`, `§E2E certification points`, `§Fix loop`) to
  `###` **under** `§Verification gates`, so its 23 citations survive while ~35 dangling ones
  start resolving. That is the precondition for reading WORKFLOW **by section per hat**
  instead of in full — the owner's goal, not yet delivered.
- **`docs/owner-framings-PARKED.md` needs a permanent home** for three owner framings, and
  its seven watch items need sorting into promise / issue / observation. Owner call pending.
- **Owner framings are parked in `docs/owner-framings-PARKED.md`** — they need a permanent
  home (PRD / WORKFLOW / own file). Owner decision pending.
- **Bet to settle at E13 close:** did #100 visibly shrink? If not, "running-in" is a feeling,
  not a thesis.
- **Waiting on the owner since s12:** make the spec-vs-code skim a standing first step of an
  epic's implementation phase (paid off twice, still only a proposal).
