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

_Last update: 2026-07-28 s28 (owner-requested) — **the #404 fan-out queue is clear.** A pure
LCM implementation session (no design calls, no grill): #397 (offer labels), the batched
#413+#414 (board polish), and #419 (the #404 decision's deliverable — market-free order kinds on
the board, drawer-only kind picker, click-inert market-free cells, Storehouse port-row marker,
legality shared between the board and `RoutesTab.tsx` via `routeAuthoring.ts`) shipped as three
sequential tier-2 waves (PRs #421/#422/#423), each coder dispatched only after the prior wave's
PR merged (all three touch `PriceBoardOverlay.tsx`, so overlap risk ruled out parallelizing).
Every wave's review routed its docs-sync findings back as follow-up commits on the same branch
rather than silent gaps — the spec and CONTEXT.md now record the as-built `rzadkie`/`pilne`
label semantics, a flagged (unresolved) "pilne" naming collision with #226's unrelated
desperation-clause label, and #413/#414's resolution. Full cert after all three merged: 842
vitest / 133 e2e / typecheck / lint clean, `postmerge.ps1` CLEAN, main @ `df6820f`.
**#393's hard gate (#419 merged) is now satisfied — it is the only remaining E16 fan-out item.**
~~New gate: **#404 blocks #393** — board authoring is buy/sell-only, so deliver/store/
withdraw lose their authoring home the moment #393 removes the RoutesTab editor; parked for a grill.~~
**Struck 2026-07-28 (s27): #404 is decided** — the kinds are authored on the board via the "więcej"
drawer; ~~#393 is now gated on the **merge** of #419, not on a decision~~ (struck 2026-07-28 s28:
#419 merged, gate cleared)
([grill record](design-notes/nonmarket-order-authoring-grill-2026-07-28.md)).
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
(#376 fulfilled). Enabler #392 + core #394 merged; ~~fan-out remaining — **#393 gated by the #404
decision**~~ (struck 2026-07-28 s27: #404 decided, #393 now gated on **#419's merge**), plus
~~#395/#396/#227/#398 (independent)~~ — struck 2026-07-28: #396 and #398 shipped
in s25, #227 is superseded by #397 and closed; ~~what remains is #395+#405 (batched), #397 (solo) and
#393~~ — struck 2026-07-28 s28: #395+#405 (s26), #397, #413+#414, and #419 all shipped.
**#393 (Trasy tab → read-only roster) is now the only E16 fan-out item left**, its hard gate
(#419 merged) satisfied. Run `gh issue list` for the live set. E11 v1 → E15 stay the standing
order for the non-E16 track. Small non-blocking tails: #374 (multi-seed storehouse guardrail),
#384 (full markdown-normalizer sweep, one pass).

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
