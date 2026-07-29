# Roles and casting

## Roles (hybrid model)

- **User (Jakub)** — product owner; final call on design and scope. Merging moved to the driver
  on 2026-07-29 ([ADR-0010](../adr/0010-the-driver-merges.md)).
- **Designer / Engineer** ([personas/](../personas/)) — hats worn in dialogue with the user
  during grilling and spec writing. Design and architecture are conversations, never delegated.
- **Analyst** ([ANALYST.md](../personas/ANALYST.md)) — after owner playtests: verifies each
  observation against the codebase, produces the playtest design note, routes items to the
  Designer grill, straight Engineer issues, or the parking lot — where a parked item carrying
  an unpark trigger also gets its issue ([documentation.md](documentation.md)). Diagnoses,
  never decides.
- **Orchestrator** ([ORCHESTRATOR.md](../personas/ORCHESTRATOR.md)) — breaks the approved spec
  into issues, delegates self-contained packages to coder subagents (parallel where
  independent), closes the tiered wave check ([verification.md](verification.md)), integrates.
- **Coder subagents** ([CODER.md](../personas/CODER.md); harness def `.claude/agents/coder.md`)
  — deliver PR-ready feature branches and evidence-based completion reports. Never merge.
- **The Professor** ([PROFESSOR.md](../personas/PROFESSOR.md); harness def
  `.claude/agents/professor.md`) — read-only architecture review of one named subsystem at
  epic/milestone boundaries, never diff review. Findings route to grill/issues/design-notes,
  never straight into code.

Which hat to wear and what it obliges you to read first:
`CLAUDE.md` §Hats.

## Casting (model-agnostic — owner lock, 2026-07-15)

The roles above are **contracts defined by function and capability tier**, not by vendor or model
name.
Process docs name tiers —
*cheap* (coders), *strong* (two-axis review, architecture passes, orchestration fallback),
*frontier* (design/grill partner, orchestration) —
never models.
The advisor pairing rule is **advisor tier ≥ executor tier**.

The current casting lives in this one replaceable line and may change without touching anything else
in the process:

> **Current casting** (owner call, 2026-07-28): frontier = **Claude Opus 5**;
> strong = **Claude Opus 5**; cheap = **Claude Sonnet**. Any comparable model may fill a slot —
> the gates, not the vendor, carry the quality claim.

**One model currently occupies two rungs.** That is legal —
the ladder ranks *capability tiers*, not headcount —
but the frontier/strong distinction is then enforced only by **what each rung may do**:
frontier orchestrates and grills;
strong reviews, and never reviews a wave it drove.
Watch for the failure that shape invites:
a session driver reviewing its own wave because the reviewer would be the same model anyway.

**A casting decision edits the def** (incident 0017):
a role's model override is real only when the harness def (`.claude/agents/*.md` frontmatter) or the
dispatch's explicit `model:` carries it.
Prose records are pointers, not sources.
Standing defaults:
coder on the cheap tier, the in-flight advisor on the strong tier.
Architecture-heavy packages (seam extraction, new-module design) may name a strong-tier coder —
a deliberate, named choice per dispatch.

**When frontier access lapses** (recurring; not in force as of 2026-07-28):
`procedural` roadmap items ([PRD](../PRD.md) §Roadmap labels) keep full velocity under the standing
gates;
`design-frontier` items wait for an owner-led grill.
Running that grill with a strong-tier model is a deliberate, named choice.
The labels exist so an orchestrator *notices* when work crosses from execution into design.

## Low-cost mode — "sesja LCM" (owner decision, 2026-07-16)

A declared session stance for **procedural** work (queue items with an approved spec).
The owner names it at session start;
the driver may propose it when the queue is purely procedural.
Levers, in order of impact:

- **Driver effort medium**, or a cheaper driver model per §Casting. Frontier reasoning is
  reserved for where decisions compound: grills, package design, post-wave integration calls.
- **Fewer checkpoints:** one decision packet up front ("on these N open points I pick X — veto
  now"), then run the queue to completion; one report at the end, not one per wave.
- **Thicker waves:** batch more small issues per package
  ([verification.md](verification.md) §Batching) so a wave's fixed cost amortizes further.
- **Resume over fresh** for reviewers and fix-loop coders — a hard rule in LCM.
- **Long runs in the background** (full Playwright, builds) — never spend a driver turn waiting.

LCM must **not** touch verification tiers, TDD, cert points or the merge preconditions of
[ADR-0010](../adr/0010-the-driver-merges.md) —
the gates that now carry what the manual owner-merge read used to carry, and are therefore the last
thing a cheap session may thin:
cut coordination and cold starts, never gates.
And no budget-triggered automatics —
LCM is declared, never silently inferred mid-wave (incident 0022).
