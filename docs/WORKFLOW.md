# Workflow

How an idea becomes shipped code in etersim. Written for the model first.

## Roles (hybrid model)

- **User (Jakub)** — product owner; final call on design, scope and merges.
- **Claude as Designer / Engineer** (docs/personas/) — hats worn in dialogue with the user during grilling and spec writing. Design and architecture are conversations, never delegated.
- **Claude as Analyst** (docs/personas/ANALYST.md) — after owner playtests: verifies each observation against the codebase (root cause, classification), produces the playtest design note and routes items to the Designer grill, straight Engineer issues, or the parking lot. Diagnoses, never decides.
- **Claude as Orchestrator** — during implementation: breaks the approved spec into issues, delegates self-contained tasks to coder subagents (parallel where independent), closes the tiered wave check (§Verification gates) and integrates.
- **Coder subagents** (docs/personas/CODER.md; harness def `.claude/agents/coder.md`) — implementation specialists dispatched by the Orchestrator with a self-contained task package; deliver PR-ready feature branches and evidence-based completion reports, never merge.
- **The Professor** (docs/personas/PROFESSOR.md; harness def `.claude/agents/professor.md`) — read-only architecture reviewer of one named subsystem, invoked by the owner or proposed by the Orchestrator at epic/milestone boundaries; complements the diff-scoped wave check (§Verification gates), findings route to grill/issues/design-notes, never straight into code.

### Casting is model-agnostic (owner lock, 2026-07-15)

The roles above are **contracts defined by function and capability tier**, not by
vendor or model name. Process docs name tiers — *cheap* (coders), *strong* (two-axis
review, architecture passes, orchestration fallback), *frontier* (design/grill
partner, orchestration) — never models; the advisor pairing rule is advisor tier ≥
executor tier. The current casting lives in this one replaceable line and may change
without touching anything else in the process:

> **Current casting:** frontier = Claude Fable 5 (access intermittent); strong =
> Claude Opus; cheap = Claude Sonnet. Any comparable model may fill a slot — the
> gates below, not the vendor, carry the quality claim.

When frontier access lapses: `procedural` roadmap items (PRD §Roadmap labels) keep
full velocity under the standing gates; `design-frontier` items wait for an owner-led
grill — running that grill with a strong-tier model is a deliberate, named choice,
not a drift. The labels exist so an orchestrator *notices* the moment work crosses
from execution into design.

## Pipeline

```
idea → grill → feature spec → user approval → GH issues → implementation → PR + review → merge → spec sync
```

1. **Grill** — every epic starts with a grilling session (grilling skill). No spec before the questions are answered.
2. **Feature spec** — one file per epic: `docs/specs/E<n>-<slug>.md`, started from [specs/TEMPLATE.md](specs/TEMPLATE.md), with a **Design** section (Designer hat: mechanics, UX flows, formulas) and a **Tech** section (Engineer hat: data structures, module APIs, file layout). Terms must come from CONTEXT.md.
3. **Approval** — user signs off on the spec before any issue is created.
4. **Issues** — via `gh`. One GitHub **milestone per epic** (`E1 — Foundation`, …). Issue title: imperative English. Body: context, acceptance criteria, link to spec section. Labels: `type:feat|bug|infra|spec|docs` + `area:sim|ui|docs`. When criteria are refined after filing (a later grill, re-scoping), post the final version as an issue **comment** — the newest acceptance-criteria comment supersedes the body. Coders and reviewers read the newest criteria comment first, then the body.
5. **Implementation** — branch `feat/<issue>-<slug>` (or `fix/`, `chore/`). Conventional commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`). Sim code (`src/sim`) grows test-first (TDD, Vitest).
6. **PR** — body links `Closes #<n>`. Before merge: tests green, typecheck + lint clean, and the wave check for the change's tier closed (§Verification gates below). The user merges — final call on every PR.
   - **Independent PRs** (disjoint files) merge in any order, no rebase. **Stacked PRs** (a chain where each branches off the previous) need care: `gh pr merge N --squash` **without** `--delete-branch` on the base (deleting it *closes* the children — GitHub won't retarget a closed PR), then `gh pr edit CHILD --base main` to retarget, then delete the base branch. After the first squash-merge, cascade-rebase the rest locally (`git rebase --onto <new-parent> <old-parent-head> <branch>`, then `--force-with-lease`); GitHub reports children as CONFLICTING until rebased because their branches still carry the pre-squash commits.
7. **Spec sync** — if implementation drifted from the spec, updating the spec is part of the task, not optional cleanup.

## Verification gates (tiered) — the wave check

Verification cost scales with a change's **risk surface**, not flat ceremony (#162
grill, [design-notes/tiered-verification-gates-2026-07-14.md](design-notes/tiered-verification-gates-2026-07-14.md)).
The Orchestrator dispatches coders with self-contained packages, then closes the
repo-level gates **once per wave** — not once per issue.

**Coder minimum** (the coder's entire checklist; receiving side in personas/CODER.md):

1. Baseline green in the assigned worktree before the first change.
2. Hard laws (SELFCHECK §4) + own green: tests/typecheck/lint observed, TDD for `src/sim`.
3. Affected Playwright specs keyed on the **whole diff**, not just UI paths: UI
   changes, but also anything e2e artifacts depend on — `src/store/persistence.ts`,
   save/`World` shape changes, `e2e/fixtures/*` (grep the diff's selectors/routes
   *and* fixture fields across `e2e/`; doubt resolves toward "include the spec";
   incident 0009).
4. Evidence report mapping each acceptance criterion to its deliverable.

No repo read-set, no SELFCHECK §5 stop-and-wait, no §6 gates — those move up.

**Wave check** (Orchestrator, after coder reports, before merges). The tier follows
mechanically from the wave's combined `git diff --stat`; escalate up freely, never
downgrade below what the paths dictate:

| Tier | Wave touches | Check |
| --- | --- | --- |
| 1 | docs/infra only | Session driver inline: diff vs ACs + docs-sweep greps. No subagents. |
| 2 | UI only (no `src/sim`) | **One** review subagent on the cheap model tier, given a distilled package (ACs, ADR-0006, area scars) — it never re-derives repo context. Affected e2e specs already ran coder-side. |
| 3 | `src/sim` / economy / multi-file wave | **One** two-axis (Standards + Spec) review subagent on the strong model tier, reading the whole wave's diffs in one context, package supplied. |

Closing a wave check includes appending one row per coder PR to
[design-notes/coder-scorecard.md](design-notes/coder-scorecard.md) (findings,
fix-loop rounds, cert outcome) — the durable sample behind coder-model decisions.

**Model ladder.** The session driver (most expensive rung) composes packages, reads
reports, and decides — it does not read whole diffs, write code, or run line-by-line
review. Reviews run one rung down; coding two rungs down. Implementing directly
in-session is allowed only when the delegation overhead exceeds the task *and* the
session driver is not the most expensive rung.

**Fix loop.** Findings return to the *same* coder via resume (full transcript, zero
re-orientation); a fresh coder only when that context is bloated or stale.
Micro-exception: the session driver may apply a purely mechanical one-liner (typo,
missing `aria-label`) directly — every such fix is **logged in the wave report**;
anything behavioral goes back to the coder. The re-check scales to the fix, not the
wave (a fix touching `src/sim` → tier 3 on the fix's diff).

**E2E certification points.** Affected specs per PR (coder-side). One full Playwright
run on `main` after all of a wave's PRs merge — red returns the wave to the fix loop,
never "merged, fix later". Full run + baseline (tests, typecheck, lint) at
epic/milestone close. Every certification run starts by printing `pwd` +
`git branch --show-current` and stops on a mismatch — a persistent shell may still
sit in a coder worktree (incident 0008).

**Milestone playtest law (owner lock, 2026-07-15).** No milestone closes on green
metrics alone: an owner playtest is part of every milestone's close. The harness
(E11) screens balance and solvency so the playtest is spent judging *fun* — the one
signal no model or metric replaces.

**Batching.** 2–4 small same-area issues per coder package. **Prefer one PR for the
batch** (owner rule 2026-07-16): issues here are small and concrete, so when they touch
the same files/feature — or are simply cheap to review together — a single branch that
`Closes` each beats per-issue ceremony (which was splitting hairs). The PR body lists
`Closes #n` for **every** issue it lands, and the wave check still verifies each issue's
acceptance criteria **separately**. Split into separate PRs only when issues are genuinely
independent *and* each earns its own review/closeability, or when combining would bloat one
diff past comfortable review. A single batched PR also sidesteps stacks; when a hard
dependency still forces one, the child's PR opens only **after** its base has merged,
already retargeted to `main` — a child PR based on a feature branch invites the batch-merge
trap of incident 0010. After any merge batch, verify each PR's content is reachable from
`origin/main` before deleting branches.

**PR timing.** Coders push branches and report; **PRs open only after the wave check
closes** (Orchestrator opens them, or explicitly instructs the coder to). An open PR
invites a pre-review merge — the owner merges on sight of green CI, and the gate
order inverts (owner decision, 2026-07-14; it happened in E3 wave 2).

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

### Docs sync sweep (before committing a spec or decision batch)

A spec is never the only file that changes. Before committing an approved spec (or any
decision session's output), sweep:

- **CONTEXT.md** — terms locked during the grill: new entries with PL names, updated implementation notes.
- **docs/PRD.md** — milestone/epic notes, sequencing changes, spec links.
- **Older specs** — sections the new spec supersedes get a pointer to it, never a silent contradiction; factual corrections are recorded where the wrong claim lives.
- **docs/design-notes/** — parked items the spec resolves get a "Resolved → spec" blockquote at the top of the item (keep the original text for history).
- **Issues** — retarget/retitle moved issues; post final acceptance criteria as comments (step 4).

The spec's own §Docs sync section lists the expected targets; the sweep verifies
nothing else drifted. (Codified 2026-07-07 — the E10 sweep touched six files.)

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
   - Before starting any task: run the pre-work checklist (`docs/SELFCHECK.md` §1–§5) and post its report before the first edit; before declaring a task done, walk the post-work gates (SELFCHECK §6) and report each gate closed or OPEN.

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
   - **Write the forward pointer into `docs/HANDOFF.md`** (overwrite — git keeps
     history). That file is the canonical session state for any model in any
     harness; per-machine auto-memory is a mirror of it, never the source
     (owner lock, 2026-07-15).

These rituals are meant to be lightweight. The goal is predictability and a shared vocabulary so both sides know what to expect and how to respond.
