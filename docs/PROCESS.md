# How this repo runs a multi-model AI team

A 10-minute tour for the outside reader.
etersim is a browser trading simulation built by **one human product owner and a team of LLM agents**
under a hard budget (subscription usage windows).
Nothing here assumes you know the game;
this document is about the *system* —
how design intent survives delegation, how quality is enforced without a human reviewer in the loop,
and how the whole thing is measured.

Everything below is practiced, not aspirational:
every rule links to the artifact that enforces it, and most rules exist because a logged failure
demanded them.

## The cast

| Role | Who fills it | What it owns |
| --- | --- | --- |
| **Owner** | the human | product vision, every design decision, every merge |
| **Designer / Engineer / Analyst** | session-driving model, as declared "hats" ([personas](personas/)) | the *what* (design grills), the *how* (tech specs), playtest diagnosis |
| **Orchestrator** | session-driving model during implementation | task packages, wave verification, integration — never writes feature code itself |
| **Coder subagents** | cheap-tier models in isolated git worktrees ([CODER.md](personas/CODER.md)) | implementation on feature branches, evidence-based completion reports |
| **Reviewers** | one subagent per wave, tier-matched (see gates) | Standards + Spec review of the whole wave's diff |
| **The advisor** | a stronger model the executor can consult mid-task | second opinions at decision points — a *pre-review* safety layer |
| **The Professor** | read-only architecture reviewer ([PROFESSOR.md](personas/PROFESSOR.md)) | subsystem design health at epic boundaries, never diff review |

A hat is a read-obligation, not a label, and it is per *task* rather than per session:
[`CLAUDE.md`](../CLAUDE.md) §Hats maps each one to the documents that must have been read *before*
the first action taken under it, and a session-start hook injects a pointer to it so the obligation
lands before any hat is declared.
The rule exists because the passive version of it failed —
a model announced the Orchestrator hat without having read the workflow it governs.
The map briefly lived in its own file (`docs/HATS.md`, #410);
that copy was retired on 2026-07-28 because a rule written in four places drifts, and the hook now
points rather than duplicates.

Design is never delegated:
grills (structured interrogation of a feature idea, one question at a time) run in dialogue with the
owner, and a spec is approved before any issue exists.
Implementation is never done by the most expensive model:
it composes packages and reads reports.

## The model ladder — casting is model-agnostic

Process docs name **capability tiers, not vendors**:
*cheap* codes, *strong* reviews, *frontier* designs and orchestrates.
The current casting (Opus 5 on both the frontier and strong rungs, Sonnet coding, as of 2026-07-28;
Fable 5 held the frontier rung until its access lapsed) lives in one replaceable line of
[WORKFLOW.md](WORKFLOW.md) §Casting —
the repo survived a frontier-access lapse and an external (non-Claude) agent build precisely because
the contracts don't name models.
The safety net is designed to **distrust coder green regardless of model**:
a cheaper coder shifts load onto review and gates, not onto hope.

## The pipeline

```
idea → grill → feature spec → owner approval → GitHub issues (milestone = epic)
     → coder waves → tiered wave check → driver merges (ADR-0010) → spec sync
```

Two structural rules do a lot of work here:

- **A self-contained task package per coder** — verbatim acceptance criteria, named
  files, scope walls, relevant scars. The better the package, the cheaper the coder
  can safely be.
- **PRs open only after the wave check closes** — an open PR invites a premature
  merge, so the gate order is protected by timing, not discipline.

## Risk-scaled verification (the wave check)

Verification cost follows the diff's **risk surface**, mechanically:

| Tier | Wave touches | Check |
| --- | --- | --- |
| 1 | docs/infra only | session driver inline: diff vs acceptance criteria |
| 2 | UI only | one cheap-tier review subagent, distilled package |
| 3 | `src/sim` (the deterministic economy core) / multi-file | one strong-tier, two-axis (Standards + Spec) review subagent over the whole wave |

Escalation is free, downgrading below what the paths dictate is forbidden —
with one documented exemption:
a **pure rename or move** through `src/sim`, changing no logic, no constant and no public shape,
drops to tier 1, and only while the existing suite passes with no assertion changed.
The condition is the detector:
an edited expectation means it was not a pure rename, and the exemption lapses.
On top:
TDD is law for the sim core, full Playwright certification on `main` after every wave merge, and **no milestone closes on green metrics alone**
—
an owner playtest is part of every close, because *fun* is the one signal no metric replaces.

## The evidence base

Three durable datasets outlive the sessions that produced them:

**[The coder scorecard](design-notes/coder-scorecard.md)** —
one row per coder PR:
review findings (count + worst severity), fix-loop rounds, certification outcome.
As of 2026-07-16: **16 rows**
across ~9 waves.
Headlines:
exactly **one major finding** in the sample (a dishonest e2e interaction pattern — caught by a
tier-2 review);
recent waves run 0-findings/0-fix-loops; **no coder-side correctness defect has reached `main`**
(the one content escape was a merge-procedure error, incident 0010, relanded the same day).
The scorecard is the substrate for model A/B decisions —
which model codes, which reviews —
made on data, not vibes.

When a *whole loop* is delegated to a foreign model and measured (the GPT-5.6 solo-driver evals),
the method itself is codified:
the **[delegation-eval playbook](design-notes/delegation-eval-playbook.md)** —
pre-registration, isolation, a byte-identical ruler prompt reused per arm, and a strict
ruler-measures / orchestrator-adjudicates split whose one law is
*a ruler finding is an input to verify, not a verdict, and skepticism must be symmetric.*

**[The incident log](incidents/)** —
a blameless register of process failures and near-misses;
`docs/incidents/README.md` §Log has the current count, one line each.
Its key design choice:
every incident is rated twice, **outcome** (what actually happened) *separately from* **failure-mode class**
(how bad the same slip could have been).
Outcomes have stayed Low —
nothing shipped broken, no work lost —
while several classes rated Medium or higher:
the log exists to catch dangerous *classes* while they are still cheap.
Recurring families:
false-signal certifications (stale environment, contended runs), dispatch defects (worktree
provisioning), merge-procedure traps (stacked PRs), and **laws that were written but never wired to anything that runs**
(0030, 0031).
Each incident ends in a prevention that lands in the docs the same session.

**The advisor experiment** —
an A/B on where a second-opinion layer pays off.
Running tally: **7 coder-side advisor catches with zero overlap**
with what review later found (the layers are complementary, not duplicative), plus two catches at
the *orchestration* seat (a stale-closure trap and a false premise in an issue, both pre-dispatch),
and **one recorded miss** —
an advisor model passed a test pattern that a review had caught one wave earlier.
The miss is kept deliberately:
it's the benchmark case for comparing advisor models.

## The memory architecture

Session context dies;
five channels with different guarantees carry knowledge forward:

1. **`CLAUDE.md`** — guaranteed delivery: auto-loaded into every session on every
   machine. Reserved for always-relevant operational law, and since 2026-07-28 it is
   the **single home** for the numbered §Laws, the hat→reading map and the pre-work
   rules — those had accumulated second copies in `docs/SELFCHECK.md` and
   `docs/HATS.md`, both now retired. It grew to do that and the four files together
   shrank by ~180 lines: consolidation, not bloat. The test for what belongs here is
   unchanged — must it be true in *every* session, before anything is read?
2. **[`incidents/README.md`](incidents/README.md) §Log** — the canonical scar
   archive, one line per lesson.
3. **[`agent-memory.md`](agent-memory.md)** — machine-independent lessons exported
   from per-machine memory; travels with the repo to any harness.
4. **Per-machine auto-memory** (Claude Code) — only what is true of *this machine and
   this owner*: environment quirks, owner preferences, harness mechanics. Probabilistic
   recall, local. **Project notes were removed from this channel on 2026-07-28** — it is
   invisible to any other harness, which is exactly where project state must not sit.
5. **The issue tracker** (`gh`) — carries everything that crosses a session boundary: open
   work, the `needs:owner-decision` label for what is blocked on an owner call, and the
   agreed order of work in milestone descriptions. There is no handoff document. One was
   tried in three shapes and each failed the same way — nothing obliged it to stay true —
   while an issue has an open/closed state nobody maintains by hand and a list that is
   swept at every session start (owner decision 2026-07-28).

The rule of thumb:
a lesson is born in the incident log, gets promoted to `CLAUDE.md` only if it must be present in
every session, and lives in `agent-memory.md` otherwise.
Memory holds pointers, not copies.

## The ceremony budget

Process is treated like code:
it accumulates, so it gets refactored.
A 2026-07-16 review ranked every ritual by *documented catch-rate per token* and cut the ones that
were liturgy:
per-issue PRs became batched PRs, session-close docs commit straight to `main`, incident reports got
a 25-line cap, the session handoff file became on-request.
What survived untouched is exactly what the data defended:
the tiered review (it caught the sample's only major), the advisor layer (best catch-to-cost ratio
in the system), and the certification gates.

## What transfers

Lessons here that generalize beyond this repo:

- **Package quality buys coder cheapness.** The dispatch package, not the coder
  model, is the main quality lever.
- **Distrust self-authored green.** Tests written by the same agent that wrote the
  code need review for *honesty* (assertion strength, real interactions), not just
  coverage — the sample's only major finding was a dishonest test.
- **Rate outcome and failure-class separately.** Most process failures are benign
  *this time*; the class is what you're actually managing.
- **False signals are the expensive failures.** Both cert-gate incidents were false
  *reds* from stale environments — noise at a gate erodes the gate.
- **Complementary safety layers beat redundant ones.** Advisor-at-decision-time and
  review-after-the-fact caught disjoint defect sets (7 + N catches, zero overlap).
- **Name tiers, not models.** Every model in the casting has already been swapped
  at least once; the process didn't notice.
