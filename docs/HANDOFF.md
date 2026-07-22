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

_Last update: 2026-07-23 s24 (owner-requested) — **E16 (Workbench) implementation opened.** Enabler
#392 (market-quality signal selector + read-only RouteRibbon) and core #394 (port-centric board
authoring — the #376 heart) both shipped, tier-2 Sonnet coders, clean waves. #376 is fulfilled
(→ E16 spec). New gate: **#404 blocks #393** — board authoring is buy/sell-only, so deliver/store/
withdraw lose their authoring home the moment #393 removes the RoutesTab editor; parked for a grill.
Process: the worktree-isolation mystery is **root-caused** (incident 0025) — `isolation: "worktree"`
provisions only for **background** coders; CLAUDE.md gained the §Session-start hat/casting cue and the
§Git background rule._

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

1. **E11 v1** (#232 → #233 → #234): harness skeleton → batch runner → runtime assertions/anomaly list.
2. Then **E15 — Processing** (#281 → #284; its spec depends on E13.0 + E13, both now closed).

In flight (owner ran it this session, ahead of the E11/E15 order above): **E16 — Workbench**
(#376 fulfilled). Enabler #392 + core #394 merged; fan-out remaining — **#393 gated by the #404
decision**, plus #395/#396/#227/#398 (independent). E11 v1 → E15 stay the standing order for the
non-E16 track. Small non-blocking tails: #374 (multi-seed storehouse guardrail), #384 (full
markdown-normalizer sweep, one pass).

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
- **E16's real test is the M4 success measure, and it is still owed** (spec §Testing).
  The gate is behavioral, not green tests: does authoring *on the board* feel faster than the old
  Trasy editor, and does a master stop opening Trasy? Cut small, playtest, iterate. Also eyeball the
  intensity-only signal against the existing color load, and the refit-violet/mining-violet proximity
  below. No amount of passing E2E substitutes for the owner playing it.
- **The advisor layer looks like a real differentiator, not a nicety** (owner observation across
  eval-2, s23): it reliably surfaces omitted or merely-implied issues before they crystallize —
  Opus↔Opus included. Owner interest in formalizing it as its *own* eval variable (arm-with-advisor
  vs. without, same ticket) rather than leaving it an anecdote. A candidate next eval — **not yet
  agreed**, so it lives here as a framing, not in §Queue.
