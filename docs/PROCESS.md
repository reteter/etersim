# How this repo runs a multi-model AI team

A 10-minute tour for the outside reader. etersim is a browser trading simulation
built by **one human product owner and a team of LLM agents** under a hard budget
(subscription usage windows). Nothing here assumes you know the game; this document
is about the *system* — how design intent survives delegation, how quality is
enforced without a human reviewer in the loop, and how the whole thing is measured.

Everything below is practiced, not aspirational: every rule links to the artifact
that enforces it, and most rules exist because a logged failure demanded them.

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

Design is never delegated: grills (structured interrogation of a feature idea,
one question at a time) run in dialogue with the owner, and a spec is approved
before any issue exists. Implementation is never done by the most expensive model:
it composes packages and reads reports.

## The model ladder — casting is model-agnostic

Process docs name **capability tiers, not vendors**: *cheap* codes, *strong*
reviews, *frontier* designs and orchestrates. The current casting (Fable /
Opus / Sonnet as of July 2026) lives in one replaceable line of
[WORKFLOW.md](WORKFLOW.md) §Casting — the repo survived a frontier-access lapse
and an external (non-Claude) agent build precisely because the contracts don't
name models. The safety net is designed to **distrust coder green regardless of
model**: a cheaper coder shifts load onto review and gates, not onto hope.

## The pipeline

```
idea → grill → feature spec → owner approval → GitHub issues (milestone = epic)
     → coder waves → tiered wave check → owner merges → spec sync
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

Escalation is free, downgrading below what the paths dictate is forbidden. On top:
TDD is law for the sim core, full Playwright certification on `main` after every
wave merge, and **no milestone closes on green metrics alone** — an owner playtest
is part of every close, because *fun* is the one signal no metric replaces.

## The evidence base

Three durable datasets outlive the sessions that produced them:

**[The coder scorecard](design-notes/coder-scorecard.md)** — one row per coder PR:
review findings (count + worst severity), fix-loop rounds, certification outcome.
As of 2026-07-16: **16 rows** across ~9 waves. Headlines: exactly **one major
finding** in the sample (a dishonest e2e interaction pattern — caught by a tier-2
review); recent waves run 0-findings/0-fix-loops; **no coder-side correctness
defect has reached `main`** (the one content escape was a merge-procedure error,
incident 0010, relanded the same day). The scorecard is the substrate for model
A/B decisions — which model codes, which reviews — made on data, not vibes.

**[The incident log](incidents/)** — a blameless register of 13 process failures
and near-misses. Its key design choice: every incident is rated twice, **outcome**
(what actually happened) *separately from* **failure-mode class** (how bad the same
slip could have been). All 13 outcomes rated Low — nothing shipped broken, no work
lost — while several failure-mode classes rated Medium+: the log exists to catch
dangerous *classes* while they're still cheap. Recurring families so far:
false-signal certifications (stale environment, contended runs), dispatch defects
(worktree provisioning), merge-procedure traps (stacked PRs). Each incident ends in
a prevention that lands in the docs the same session.

**The advisor experiment** — an A/B on where a second-opinion layer pays off.
Running tally: **7 coder-side advisor catches with zero overlap** with what review
later found (the layers are complementary, not duplicative), plus two catches at
the *orchestration* seat (a stale-closure trap and a false premise in an issue,
both pre-dispatch), and **one recorded miss** — an advisor model passed a test
pattern that a review had caught one wave earlier. The miss is kept deliberately:
it's the benchmark case for comparing advisor models.

## The memory architecture

Session context dies; five channels with different guarantees carry knowledge
forward:

1. **`CLAUDE.md`** — guaranteed delivery: auto-loaded into every session on every
   machine. Reserved for always-relevant operational law (a handful of lines).
2. **[`incidents/README.md`](incidents/README.md) §Log** — the canonical scar
   archive, one line per lesson.
3. **[`agent-memory.md`](agent-memory.md)** — machine-independent lessons exported
   from per-machine memory; travels with the repo to any harness.
4. **Per-machine auto-memory** (Claude Code) — the day-to-day working channel:
   session state, owner preferences, machine quirks. Probabilistic recall, local.
5. **[`HANDOFF.md`](HANDOFF.md)** — an exportable session-state snapshot for *any*
   model in *any* harness, updated on owner request; its date stamp is the
   freshness contract.

The rule of thumb: a lesson is born in the incident log, gets promoted to
`CLAUDE.md` only if it must be present in every session, and lives in
`agent-memory.md` otherwise. Memory holds pointers, not copies.

## The ceremony budget

Process is treated like code: it accumulates, so it gets refactored. A 2026-07-16
review ranked every ritual by *documented catch-rate per token* and cut the ones
that were liturgy: per-issue PRs became batched PRs, session-close docs commit
straight to `main`, incident reports got a 25-line cap, the session handoff file
became on-request. What survived untouched is exactly what the data defended: the
tiered review (it caught the sample's only major), the advisor layer (best
catch-to-cost ratio in the system), and the certification gates.

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
