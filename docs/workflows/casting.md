# Roles and casting

## Roles (hybrid model)

- **User (Jakub)** — product owner; final call on design, scope and merges.
- **Designer / Engineer** ([personas/](../personas/)) — hats worn in dialogue with the user
  during grilling and spec writing. Design and architecture are conversations, never delegated.
- **Analyst** ([ANALYST.md](../personas/ANALYST.md)) — after owner playtests: verifies each
  observation against the codebase (root cause, classification), produces the playtest design
  note and routes items to the Designer grill, straight Engineer issues, or the parking lot —
  where a parked item carrying an unpark trigger also gets its issue
  ([documentation.md](documentation.md): a trigger is a promise). Diagnoses, never decides.
- **Orchestrator** ([ORCHESTRATOR.md](../personas/ORCHESTRATOR.md)) — during implementation:
  breaks the approved spec into issues, delegates self-contained tasks to coder subagents
  (parallel where independent), closes the tiered wave check
  ([verification.md](verification.md)) and integrates.
- **Coder subagents** ([CODER.md](../personas/CODER.md); harness def
  `.claude/agents/coder.md`) — implementation specialists dispatched with a self-contained task
  package; deliver PR-ready feature branches and evidence-based completion reports, never merge.
- **The Professor** ([PROFESSOR.md](../personas/PROFESSOR.md); harness def
  `.claude/agents/professor.md`) — read-only architecture reviewer of one named subsystem,
  invoked by the owner or proposed by the Orchestrator at epic/milestone boundaries; complements
  the diff-scoped wave check, findings route to grill/issues/design-notes, never straight into
  code.

Which hat to wear, and what each obliges you to read first: `CLAUDE.md` §Hats.

## Casting (model-agnostic — owner lock, 2026-07-15)

The roles above are **contracts defined by function and capability tier**, not by vendor or
model name. Process docs name tiers — *cheap* (coders), *strong* (two-axis review, architecture
passes, orchestration fallback), *frontier* (design/grill partner, orchestration) — never
models; the advisor pairing rule is advisor tier ≥ executor tier. The current casting lives in
this one replaceable line and may change without touching anything else in the process:

> **Current casting** (owner call, 2026-07-28): frontier = **Claude Opus 5** — the rung is
> filled again, ending the lapse that began when Fable 5 access expired on 2026-07-19.
> strong = **Claude Opus 5**; cheap = **Claude Sonnet**. Any comparable model may fill a slot —
> the gates, not the vendor, carry the quality claim.
>
> **One model now occupies two rungs.** That is legal — the ladder ranks *capability tiers*,
> not headcount — but the frontier/strong distinction is then enforced only by **what each rung
> is allowed to do**: frontier orchestrates and grills; strong reviews and never reviews a wave
> it drove. Watch for the failure that shape invites: a session driver "reviewing" its own wave
> because the reviewer would be the same model anyway. Splitting the rungs again is a one-line
> edit here.

**Casting decisions edit the def** (incident 0017): a role's model override is real only when
the harness def (`.claude/agents/*.md` frontmatter) or the dispatch's explicit `model:` carries
it — prose records (HANDOFF, memory) are pointers, not sources. Since 2026-07-17 (A/B read-out,
series closed 2/2) coder returns to the cheap tier as the standing default, and the in-flight
advisor is cast on the strong tier (satisfying advisor tier ≥ executor tier).
Architecture-heavy packages (seam extraction, new-module design) may name a strong-tier coder
explicitly — a deliberate, named choice per dispatch.

**When frontier access lapses** (*not in force as of 2026-07-28* — the rung is filled; kept
because the lapse recurs): `procedural` roadmap items ([PRD](../PRD.md) §Roadmap labels) keep
full velocity under the standing gates; `design-frontier` items wait for an owner-led grill.
Running that grill with a strong-tier model is a deliberate, named choice, not a drift. The
labels exist so an orchestrator *notices* the moment work crosses from execution into design.

## Low-cost mode — "sesja LCM" (owner decision, 2026-07-16)

A declared session stance for **procedural** work (queue items with an approved spec). The
owner names it at session start; the driver may propose it when the queue is purely procedural.
Levers, in order of impact:

- **Driver effort medium** (or a cheaper driver model per §Casting). Frontier reasoning is
  reserved for where decisions compound: grills, package design, post-wave integration calls.
- **Fewer checkpoints:** one decision packet to the owner up front ("on these N open points I
  pick X — veto now"), then run the queue to completion; one report at the end, not one per wave.
- **Thicker waves:** batch more small issues per package
  ([verification.md](verification.md) §Batching) so a wave's fixed cost amortizes over more work.
- **Resume over fresh** for reviewers and fix-loop coders — a hard rule in LCM.
- **Long runs in the background** (full Playwright, builds) — never spend a driver turn waiting.

What LCM must **not** touch: verification tiers, TDD, cert points, the owner-merge law — the
scorecard sample says gates are cheap relative to what they catch. Cut coordination and cold
starts, never gates. And no budget-triggered automatics: LCM is declared, never silently
inferred mid-wave.
