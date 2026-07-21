# HANDOFF — the cross-harness export

**This file carries only what `git log` and `gh` cannot derive:**
the owner-agreed ordering of work,
the owner's framings,
and pointers to resumable state.
Nothing else — everything derivable was removed in the #331 tsunami,
because a duplicated snapshot drifts against its source and misleads
(five documented times; the seam is derivability, not section names).

**Updated only when the owner asks** (ceremony decision, 2026-07-16).
The date below is the freshness marker for the *non-derivable* content;
for anything about the current commit, tests, or which issues are open,
read `git log` and `gh issue list` directly — this file no longer claims them.
Written for any model in any harness;
Claude Code's per-machine auto-memory is the day-to-day working channel.

_Last update: 2026-07-21 s18 (owner-requested) — E13.0 close: §Queue cut to the
go-forward order (the E13.0, OQ8, and docs-vs-docs-sweep items retired as done),
§Pointers to resumable state removed (the design-surface sweep it pointed at closed s16)._

## Design sessions are the work (owner framing, 2026-07-19)

The owner's ruling after a session with no code in it:
**coders write code — our job is organizing and designing whole processes.**
Better to spend several sessions writing nothing than to work *po łebkach*
and ship code already doomed to refactor.
Do not treat a code-free session as a loss; treat a spec built on an outgrown model as one.

The unfalsified half of this bet: E13.0 is supposed to make #100 *smaller*.
**Measure it at E13 close** — if #100 did not visibly shrink,
the running-in framing is a feeling rather than a thesis.

## Running-in, not sanding down (owner framing, 2026-07-19)

We are **breaking the process in with fresh oil, not sandpaper.**
Instructions should be clear, consistent,
and **not collide with the driving model's trained nature** —
where a rule fights the model's grain, the rule gets reshaped, not the model.
The owner runs an extended retro at session end
and ranks process tension alongside shipped code.

## Casting across a non-Anthropic pool (durable, model-agnostic)

This file, `docs/PROCESS.md` and `docs/WORKFLOW.md` are model-agnostic on purpose.
The casting ladder names Anthropic tiers (frontier / strong / cheap);
for any other driver pool, **translate tiers, not names** —
the durable shape is *frontier orchestrates and grills, strong reviews,
cheap codes pre-resolved packages.*
The volatile side (which specific model is available, at what price) belongs to
auto-memory and `git log`, not here.

## Queue — the owner-agreed order

The *order* is the standing owner agreement, not a re-planning.
Statuses are **not** listed here — run `gh issue list` for what is open.

1. **E13 implementation:** #100 → #101 → #102
   (#100 should be visibly smaller after E13.0 — the interim scope-delta measure is
   `design-notes/e13-0-shrink-measurement-2026-07-21.md`; the definitive LOC measure is
   still due at E13 close, per the bet above).
2. **Cheap tails:** #302, #303.
3. Then **E11 v1** (#232 → #234) → **E15** (#281 → #284;
   its spec depends on E13.0 + E13).

## Watch — non-derivable only

These are live observations and owner preferences held by **nothing else**.
Anything that became a filed issue, an incident, or a WORKFLOW rule
has been removed — find it at its real home.

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
