# Design-surface sweep — method and ledger

A standing, multi-session pass that reads the project's documents **against each other**.
Opened 2026-07-19 (s13) at the owner's call, with the corpus set to the **whole design
surface** rather than the load-bearing path.

## Why this exists

Neither of s12's two decisive findings was catchable by any gate we run. Both were
documents that were individually coherent and jointly false:

- **#304's re-evaluation trigger** named a premise that the E15 spec contradicts — the
  trigger was void from the day it was written.
- A **chain recipe collided with a building's goods filter** across two specs.

Every gate we own reads a *diff*: review, tests, E2E, the docs sync sweep. A contradiction
between two documents that nobody is currently editing has no diff to appear in, so it is
invisible to all of them. It surfaces only when someone reads both — which, before s12,
happened by luck.

**Note the difference from `WORKFLOW.md` §Docs sync sweep, which has a confusingly similar
name.** That one is narrow and one-directional: it starts from a freshly approved spec and
asks "did anything else drift?", against a target list the spec itself supplies. Both s12
findings passed through it unharmed, because neither was drift from a spec. This sweep has
no privileged starting document.

## Corpus

98 files, ~8.5k lines, plus the issue tracker.

| Segment | Files | Lines |
| --- | --- | --- |
| `docs/specs` | 13 | 2796 |
| `docs/design-notes` | 38 | 2540 |
| `docs/*` (PRD, WORKFLOW, HANDOFF, PROCESS, SELFCHECK, agent-memory, INTERVIEW-NOTES) | 7 | 1068 |
| `docs/incidents` | 19 | 784 |
| root (AGENTS.md, CLAUDE.md, CONTEXT.md, README.md) | 4 | 742 |
| `docs/personas` | 6 | 242 |
| `docs/adr` | 8 | 236 |
| `.claude/agents` (coder, professor — cited by CLAUDE.md as contracts) | 2 | 107 |
| `.github/pull_request_template.md` (the gate list) | 1 | 12 |
| **GitHub issues** — 29 open + 112 closed; **196 unique numbers cited** by the docs | — | — |

**Out of corpus:** `.claude/skills/**` (~1.9k lines) — harness tooling, not project design.

Issues are corpus, not an appendix: #304's void trigger lived in an acceptance-criteria
comment, not in the repo.

## Method: subject-keyed, not pairwise

Pairwise is not an option — 98 documents is 4 753 pairs. Instead:

**Extract nothing; key on subjects and let contradictions collide.** For each subject, grep
the corpus, read the hits together, adjudicate. This is O(N) reading instead of O(N²)
comparisons, and it works *here specifically* because `CONTEXT.md` is enforced law: the same
concept carries the same name everywhere, so a grep on the term genuinely gathers everything
that speaks about it. In a repo without an enforced ubiquitous language this method would
leak badly — the same idea would hide under five names and never collide.

The subject list is therefore closed and known: **81 glossary terms**, plus the process
subjects below that have no glossary entry.

### Pass A — referential integrity (mechanical, enumerable)

Every claim of the form *"X lives in / is decided by / is triggered by Y"*, checked against Y.
This is the class that produced #304.

| Class | Count | Check | Status |
| --- | --- | --- | --- |
| Relative `.md` links | 208 | target file exists | **CLEAN** (2026-07-19, scripted) |
| ADR references | 117 | citing text matches the ADR's actual decision | pending |
| Issue references | 196 unique | citing text matches the issue's current state + newest AC comment | pending |
| Bare `see <doc>` refs | 10 | resolves and says what the citer claims | pending |
| **Cross-epic triggers** | — | a re-evaluation trigger naming another epic is verified against that epic's spec | pending — **highest priority, this is the #304 class** |

### Pass B — subject adjudication

Per `CONTEXT.md` section; each term greped across the corpus and its claims read together.

| Section | Terms | Status |
| --- | --- | --- |
| World & setting | 17 | pending |
| Trade & economy | 16 | pending |
| Player & ships | 11 | pending |
| Buildings & construction | 11 | pending |
| Guilds & contracts | 12 | pending |
| Harness & evaluation | 8 | pending |
| Simulation | 6 | pending |
| **Process subjects** (no glossary entry): verification gates, merge/wave ritual, session ritual, model ladder, review depth, documentation law | — | pending — **F1 came from here** |

## Binding rules

Without these the archive drowns the signal:

1. **HIST does not bind.** A HIST design note disagreeing with a LIVE document is
   provenance, not a finding — that is what HIST *means*.
2. **But a LIVE document citing a HIST one as current IS a finding.** Same for a doc citing
   a closed issue as open work.
3. **Newest acceptance-criteria comment wins** for issue scope (WORKFLOW §4); a doc quoting
   a superseded AC is a finding against the doc.
4. **Tuning constants are exempt** — they may drift from specs by design (SELFCHECK §4.7).

## Finding policy (owner decision, s13)

**Read-only plus routing.** A finding is recorded here and routed; it is *not* fixed in the
same pass. Rationale: s12 showed one finding can escalate into a sub-epic, an ADR and rewritten
acceptance criteria. Fixing in flight means the sweep gets swallowed by its first serious
finding and never completes.

**One exception:** a finding that blocks the next queued work (#306 → #307) is fixed
immediately.

Findings needing work get issues; the rest stay as rows below until routed.

## Findings

| # | Class | Subject | Finding | Routing |
| --- | --- | --- | --- | --- |
| F1 | process | selfcheck obligation | `CLAUDE.md` §Rules makes the selfcheck **unconditional** ("Before starting any task, run the pre-work checklist … and post its report"); `docs/SELFCHECK.md` line 3 makes it **on request** ("Run this before starting work **when the owner says so**", with a sample owner prompt). A model reading only SELFCHECK skips it by default; a model reading CLAUDE.md never skips. Both were followed at s13 open — by reading both. | open — owner decides which is law, then one of the two changes |
| F3 | form | glossary convention | `CONTEXT.md` entries are headed `**Term** (PL: …):` at line start, but wrapped prose inside an entry can land a bold phrase at line start and imitate a header. Three do: `eterowy` (L148, inside *Aether ice*), `Margin Gate` (L335, inside *Stop*), `only by Company deliveries` (L417, inside *Processing*). Enumerating terms by the documented convention yields 84 where the truth is 81 — and `Margin Gate` looks like a duplicate entry, since a real one exists at L348. Not a contradiction; a legibility defect in the one document the whole sweep keys on. | open — cheap fix (reflow three lines); no behavior depends on it |
| F2 | status | machine handoff | `docs/HANDOFF.md` §Watch items states "s12 was the last session on the brother's PC. From s13 the owner is back on their own machine — the `gh` switch dance no longer applies." s13 ran on the brother's PC and the dance applied. A **prediction** was written as settled state, and HANDOFF went misleading for the second consecutive session. | open — feeds the standing proposal that a falsified HANDOFF line gets an immediate strike-through |

## Stop rule

The sweep is done when every Pass A row and every Pass B row reads CLEAN or carries findings.
It is explicitly **resumable**: this table is the state. A session picks the topmost pending
row, works it, updates the row, and stops wherever it stops.
