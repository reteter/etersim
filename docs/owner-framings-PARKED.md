# Owner framings — PARKED, awaiting a permanent home

**This file is temporary scaffolding, not a source of truth.** It holds the durable owner
framings and the unresolved watch items that lived in `docs/HANDOFF.md` until 2026-07-28,
when that file was retired entirely and cross-session state moved to the issue tracker.
Deleting them along with it would have lost owner rulings that carry falsifiers.

**Tracked by #427**, which is what actually obliges this file to be emptied — a parked
document with no issue behind it is the failure this repo has logged twice.

**Open decision:** where each block below belongs permanently — `docs/PRD.md`,
`docs/WORKFLOW.md`, or a short standing-rulings file of its own. Until that is decided,
nothing cites this file as law; it exists so nothing is lost in transit.

Text is preserved verbatim from the retired HANDOFF. Dates are the owner's original ones.

---

## Durable framings (owner rulings)

### Design sessions are the work (owner framing, 2026-07-19)

The owner's ruling after a session with no code in it:
**coders write code — our job is organizing and designing whole processes.**
Better to spend several sessions writing nothing than to work *po łebkach*
and ship code already doomed to refactor.
Do not treat a code-free session as a loss; treat a spec built on an outgrown model as one.

The unfalsified half of this bet: E13.0 is supposed to make #100 *smaller*.
**Measure it at E13 close** — if #100 did not visibly shrink,
the running-in framing is a feeling rather than a thesis.

### Running-in, not sanding down (owner framing, 2026-07-19)

We are **breaking the process in with fresh oil, not sandpaper.**
Instructions should be clear, consistent,
and **not collide with the driving model's trained nature** —
where a rule fights the model's grain, the rule gets reshaped, not the model.
The owner runs an extended retro at session end
and ranks process tension alongside shipped code.

### Casting across a non-Anthropic pool (durable, model-agnostic)

This file, `docs/PROCESS.md` and `docs/WORKFLOW.md` are model-agnostic on purpose.
The casting ladder names Anthropic tiers (frontier / strong / cheap);
for any other driver pool, **translate tiers, not names** —
the durable shape is *frontier orchestrates and grills, strong reviews,
cheap codes pre-resolved packages.*
The volatile side (which specific model is available, at what price) belongs to
auto-memory and `git log`, not here.

---

## Watch items in transit

These were HANDOFF §Watch. Each is one of three things, and the sorting is the pending work
(#427): an **obligation** (gets an issue — including the ones that are not tasks, which now
carry the `needs:owner-decision` label), an **observation with no commitment** (goes to
`docs/design-notes/`), or something already discharged. None have been sorted yet.

- **Spec-vs-code skim is still not written into WORKFLOW.**
  Proposed in the s12 retro as a standing first step of any epic's implementation phase;
  it has paid off twice (`e3-spec-refresh-grill-2026-07-14`, and s12's entire outcome)
  but exists only as a proposal. An owner call away from becoming a rule or an issue.
- **Grill format** (owner, s12 retro):
  a turn may pair analysis with a question, but on **one thread only** —
  four threads in a turn overloads the owner and degrades the answers.
- **Refit-status violet `#a373d6` vs mining `#7e55ab`** proximity —
  eyeball at the next playtest; may collide under the one-color-one-meaning law.
- **Recurring e2e smell:** `dispatchEvent` standing in for real interaction.
- **E16's real test is the M4 success measure, and it is still owed** (spec §Testing).
  The gate is behavioral, not green tests: does authoring *on the board* feel faster than the old
  Trasy editor, and does a master stop opening Trasy? Cut small, playtest, iterate. Also eyeball the
  intensity-only signal against the existing color load, and the refit-violet/mining-violet proximity
  below. No amount of passing E2E substitutes for the owner playing it.
- **The advisor layer looks like a real differentiator, not a nicety** (owner observation across
  eval-2, s23): it reliably surfaces omitted or merely-implied issues before they crystallize —
  Opus↔Opus included. Owner interest in formalizing it as its *own* eval variable (arm-with-advisor
  vs. without, same ticket) rather than leaving it an anecdote. A candidate next eval — **not yet
  agreed**, so it lives here as a framing, not in the queue.
