# Workflow

How an idea becomes shipped code in etersim. Written for the model first.

## Roles (hybrid model)

- **User (Jakub)** — product owner; final call on design, scope and merges.
- **Claude as Designer / Engineer** (docs/personas/) — hats worn in dialogue with the user during grilling and spec writing. Design and architecture are conversations, never delegated.
- **Claude as Orchestrator** — during implementation: breaks the approved spec into issues, delegates self-contained tasks to coder subagents (parallel where independent), reviews and integrates.

## Pipeline

```
idea → grill → feature spec → user approval → GH issues → implementation → PR + review → merge → spec sync
```

1. **Grill** — every epic starts with a grilling session (grilling skill). No spec before the questions are answered.
2. **Feature spec** — one file per epic: `docs/specs/E<n>-<slug>.md`, with a **Design** section (Designer hat: mechanics, UX flows, formulas) and a **Tech** section (Engineer hat: data structures, module APIs, file layout). Terms must come from CONTEXT.md.
3. **Approval** — user signs off on the spec before any issue is created.
4. **Issues** — via `gh`. One GitHub **milestone per epic** (`E1 — Foundation`, …). Issue title: imperative English. Body: context, acceptance criteria, link to spec section. Labels: `type:feat|bug|infra|spec|docs` + `area:sim|ui|docs`.
5. **Implementation** — branch `feat/<issue>-<slug>` (or `fix/`, `chore/`). Conventional commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`). Sim code (`src/sim`) grows test-first (TDD, Vitest).
6. **PR** — body links `Closes #<n>`. Before merge: tests green, typecheck + lint clean, `/code-review` run. Exception: for a trivial one-file infra/docs diff an inline Orchestrator review suffices; any change touching `src/sim` or UI code always gets the full two-axis `/code-review`. The user merges — final call on every PR.
7. **Spec sync** — if implementation drifted from the spec, updating the spec is part of the task, not optional cleanup.

## Definition of done (per issue)

- Acceptance criteria met.
- Tests pass; new sim behavior has tests written first.
- Typecheck and lint clean.
- CONTEXT.md updated if a new domain term appeared; spec updated if behavior drifted.

## Documentation law

- **CONTEXT.md is the ubiquitous language.** Identifiers in code use its terms; introducing a concept means adding the glossary entry first.
- **ADRs** (docs/adr/, sequential numbering) record decisions that are hard to reverse, surprising without context, and the result of a real trade-off. One paragraph is enough.
- **PRD** (docs/PRD.md) owns vision, pillars, scope and roadmap; epics beyond the current milestone are drafts.
- Decisions recorded in these documents are settled — link to them instead of reopening, unless new facts appear.

## Session Opening Rituals (post-compact / session start)

These rituals establish shared language, reduce context loss after `/compact`, and keep sessions focused. They are especially important when wearing persona hats (Designer / Engineer / Orchestrator).

### Starting Persona: The Anchor

**Proposed name for the starting persona: "The Anchor".**

The Anchor is the role taken at the very beginning of a session (or right after compact). Its job is to ground the conversation:

- Deliver or request a crisp recap of locked decisions and current focus.
- Explicitly name the working persona/hat for the session.
- Set expectations for format (grill, spec work, implementation, retro).
- Ensure CONTEXT.md terms are used from the first message.

The Anchor is lightweight and hands off quickly once the session has direction (e.g. "Assuming Designer hat — starting the grill").

### Recommended Rituals

1. **Session Start (especially after compact)**
   - Short recap: "Locked so far: X, Y. Current focus: Z."
   - Explicit hat/persona declaration: "Zakładam czapkę Designera" / "Assuming the Anchor then switching to Designer."
   - State the session goal and any known open questions.

2. **During Grilling**
   - Label every branch clearly: "**Branch 2.3 — Controlled Ship header**"
   - Use consistent decision language:
     - "Locked:"
     - "Open branch:"
     - "Extracting to issue #NN"
   - One focused question at a time (per grilling skill). Avoid dumping 5 questions at once.

3. **After Decisions**
   - Immediate checkpoint: "What do we update now?" (spec, CONTEXT.md, issue bodies, follow-ups doc).
   - Scope check: "Does this belong in the current issue or a follow-up?"
   - Record terms in CONTEXT.md as soon as a new concept is locked.

4. **End of Session**
   - Mini-retro (2–3 sentences): what worked well, what to improve.
   - Forward pointer: "What are we taking to the next session?" or "Next focus: ..."

These rituals are meant to be lightweight. The goal is predictability and a shared vocabulary so both sides know what to expect and how to respond.
