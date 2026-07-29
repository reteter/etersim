# The driver merges its own PRs

From the first epic until 2026-07-29, `§Laws 5` ended with a bright line: **"The owner merges —
never merge your own PR without explicit owner consent."** It was a real gate, not decoration:
incident 0022 records a session that crossed it under budget pressure, and the crossing was
classified High precisely because that line was the last one standing when everything softer
had already dissolved.

The owner retired it on 2026-07-29 (s30), after a milestone's worth of evidence that the tiered
wave check catches what the manual read was there to catch. This ADR records the decision, and —
more importantly — records **what each of the retired gate's two jobs was replaced by**, so that
a later reader finding a thin rule where a thick one used to be can see that the thickness moved
rather than evaporated.

## What the gate actually did

Two jobs, and they have different successors:

1. **Undo.** A human stood between a bad squash-merge and history. Once a squash lands on
   `main`, the pre-merge state is recoverable only if it exists somewhere else.
2. **A second pair of eyes reading the diff** before it became history — one human read that
   no amount of green could substitute for.

The operational cost was concentrated on the owner: merge gates are *sequential and blocking*.
Three of them in one session meant the driver idled between waves while the owner was the
critical path — at 4:35 AM, in the session that prompted this decision.

## Decision

- **The driver merges its own PRs**, once every gate on the PR checklist is closed. No separate
  owner approval step per PR. Squash-merge, as before.
- **The owner keeps the final call on design and scope** — grills, spec approval, milestone
  order, `needs:owner-decision`. What changed is *who presses the button on verified work*, not
  who decides what the work is.
- **Coder subagents still never merge, and never open a PR on their own initiative.** This ADR
  moves one power to the driver/Orchestrator and touches the coder contract not at all
  (`docs/personas/CODER.md`, `.claude/agents/coder.md`, `docs/workflows/casting.md` roles list).
- **Job 1 (undo) is replaced by a verified off-GitHub mirror.** `codeberg/main` exists, and the
  owner confirmed a working push on 2026-07-29 — the mirror is *tested*, not assumed. On top of
  it, an **epic-start snapshot**: before the first coder dispatch of an epic, `main` is pushed
  to the mirror and tagged `snapshot/E<n>-start`, mechanized in `scripts/mirror-snapshot.ps1`.
  The granularity is the owner's call: an epic, not a wave.
- **Job 2 (the human read) is replaced by the gates that already existed** and are now
  load-bearing rather than advisory: the tiered wave check (`docs/workflows/verification.md`),
  the green trio (tests, typecheck, lint), the PR-template checklist walked before "done", the
  full Playwright run after a wave's PRs land, and the post-merge certification
  (`scripts/postmerge.ps1`). The standing rule that **a strong-tier reviewer never reviews a
  wave it drove** (`casting.md` §Casting) is what keeps the review from collapsing into the
  driver reviewing itself.

## The residual risk, named

The owner's own session review of 2026-07-29 put it plainly: **the driver is the one actor in
this process nobody reviews.** It authors the task package, it dispatches, it closes the wave
check, and now it merges. Every other role has a gate above it; the driver has an advisor it
chooses to call.

This ADR does not pretend otherwise. It records the risk as accepted with two named
counterweights and one falsifier:

- **Counterweight A — the mirror.** A bad merge is recoverable, so the failure mode is cost,
  not loss.
- **Counterweight B — the reviewer is never the driver of the wave under review.** Where that
  is structurally impossible (one model on two rungs), the tier table, not the driver's
  judgment, picks the check.
- **Falsifier.** If a defect reaches `main` that a manual owner read would plausibly have
  caught, it is filed as an incident citing this ADR. Two such incidents reopen the decision.
  Absent that evidence, the gate stays retired — the point of writing a falsifier down is that
  "it feels riskier now" is not, by itself, grounds to reinstate it.

## Considered options

- **Keep the manual gate (status quo).** Rejected by the owner: after a milestone of evidence,
  its remaining yield did not justify making a human the blocking step of every wave, at every
  hour.
- **Auto-merge on green CI.** Rejected — and it is the option this ADR is most careful to
  exclude. CI green is not this repo's gate; the wave check is, and it is a judgment step that
  no status check represents. Auto-merge would be a textbook hollow gate: a mechanism that looks
  like verification while being unable to fail for the reasons that matter.
- **Driver merges, no mirror.** Rejected: it retires job 1 (undo) with nothing in its place.
  The owner made the mirror the precondition of the change, and the mirror's credentials were
  verified before this ADR was written rather than after.
- **Driver merges, with a pre-merge snapshot per wave.** Rejected as over-fitted: per-wave
  pushes buy little over per-epic snapshots given that every branch tip also lives on `origin`
  until it is pruned, and a ritual paid many times per session is the kind that gets skipped
  under budget pressure (incident 0022).
- **Driver merges, with a verified mirror and an epic-start snapshot (chosen).**

## Consequences

- `§Laws 5` is reworded; **its number does not move** — the numbering is cited across the repo
  and is deliberately stable.
- The PR-template checkbox flips from "the owner merges — do not self-merge" to a
  driver-merges line that names what must be closed first.
- `docs/workflows/pipeline.md` step 7, `docs/workflows/casting.md` (the roles line and the LCM
  no-touch list, which named "the owner-merge law" as untouchable), and the pipeline diagram in
  `docs/PROCESS.md` are retargeted in the same commit as this ADR
  (`docs/workflows/documentation.md` — decisions propagate at the moment they change).
- **Incident reports 0011 and 0022 are deliberately left unedited.** They record what happened
  under the rule in force at the time. Rewriting an incident to match a later decision would
  falsify provenance; the propagation law covers documents recording the *decision*, not the
  log of times it was broken.
- Merge batching becomes a driver concern rather than an owner-scheduling one: disjoint waves
  no longer wait on an owner session, so the "three sequential merge gates in one session"
  shape disappears on its own.
- The mirror stops being a habit and becomes a script that exits non-zero when it cannot verify
  that `codeberg/main` matches local `main`. That is the whole point of mechanizing it: the
  question asked of any safeguard here is **"can it fail?"**, not "does it pass?".
