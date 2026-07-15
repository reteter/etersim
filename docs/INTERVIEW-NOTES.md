# Interview / CV notes — etersim as an Evals & AI-Quality portfolio

Owner's career pivot: ~20 years in law → Evals / AI Quality / context
engineering. This file collects **interview-ready claims** mined from the
project as they emerge — each entry: the claim, the evidence in this repo,
and the story hook. Append-only in spirit; newest at the bottom.

The repo itself is the meta-artifact: a single-player game built by a
multi-model AI team (frontier model orchestrates & designs / strong tier
reviews / cheap tier codes) under an explicit process (grill → spec →
issues → coder waves → tiered review → owner merge), with instrumentation
that would let an evals team audit any claim below.

---

## 1. Persona engineering is altitude control

**Claim:** a persona is an abstraction-level contract, not flavor. The same
model family reviewing the same subsystem through two persona contracts
produced fully disjoint finding classes: three consecutive diff-scoped
reviews passed code whose offer generator was structurally blind to active
contracts (each diff locally correct), while an architecture-persona pass
("Professor") caught it in one sweep by reading signatures across modules —
~62k tokens → 1 HIGH finding, vs 90–160k per diff review doing different,
also-necessary work.

**Artifacts:** `docs/design-notes/professor-review-sim-guilds-contracts-2026-07-14.md`,
issue #200, `docs/personas/`.

**Hook:** "You don't ask the model to be smarter — you ask it to look at a
different layer, and the catch classes stop overlapping."

## 2. Instrument before you need the experiment

**Claim:** the coder scorecard records findings-per-PR, fix-loop rounds, and
advisor catches for every coder PR — designed as cheap-to-collect columns
before any experiment needed them. When the question "should the advisor
run on a stronger model?" arrived, the baseline (7 advisor catches / 0
overlap with review / 1 documented miss) already existed.

**Artifacts:** `docs/design-notes/coder-scorecard.md` (15+ live rows);
the documented advisor miss (PR #214: a `dispatchEvent` test smell the same
advisor class had caught one wave earlier) is a ready-made benchmark case.

**Hook:** "The difference between doing evals and talking about them is
that the metric column exists before the A/B question does."

## 3. Token burn is a cost, not a KPI (Goodhart in the wild)

**Claim:** measuring AI-team productivity by tokens consumed fails Goodhart
immediately — value-per-token varied by an order of magnitude in this repo
on the same day, same model family, and the only predictors were persona
and scope, not budget. The scorecard measures outcomes (findings, fix
loops, escapes-to-main); token counts appear only as context.

**Artifacts:** the §1 numbers (62k vs 90–160k for disjoint value); scorecard.

**Hook:** "Judging a carpenter by lumber consumed. If token burn becomes
the target, the best coder is the one who fails three fix loops."

## 4. Deterministic sim as an eval harness

**Claim:** the game's pure, seeded, tick-based simulation doubles as an
eval harness: balance claims are proven by folding `tick()` in tests
(guardrail suites), failing scenarios become permanent regression tests,
and a planned multi-seed sweep (issue #202) turns balance questions into
distribution assertions instead of anecdotes.

**Field proof (2026-07-15):** a rank/tier progression deadlock shipped and
was found only by human playtest — yet "for each seed × guild: does at
least one rank-1-acceptable offer ever exist?" is a one-line invariant over
a sweep. The gap between those two detection costs is the business case
for the harness.

**Artifacts:** `src/sim/e3-guardrails.test.ts`, issues #202/#226,
`docs/design-notes/playtest-2026-07-15-contractor.md`.

## 5. Baseline-first tooling decisions (RAG parked with triggers)

**Claim:** a RAG/vector-index proposal was parked *with measurable unpark
triggers* (retrieval-miss incidents logged as issue comments; corpus-size
threshold; second knowledge consumer) against an explicit baseline: the
hand-curated lexical index (glossary + memory index + incident digest).
"Too early" without criteria is procrastination; with criteria it's a
decision.

**Artifacts:** issue #212 (triggers + baseline written in the body).

**Hook:** "The eval-shaped version of adopting a tool: name the baseline,
name the metric, name the threshold — then wait for the data."

## 6. Blameless incident log as an eval dataset

**Claim:** 10 incident reports (report → fix → don't repeat; outcome rated
separately from failure-mode class) function as a labeled dataset of
process failures: each has detection method, structural driver, and a
landed prevention. New sessions absorb the one-line digest instead of
re-learning; several preventions later fired in the field (e.g. a coder
unprompted widened its affected-e2e net per incident 0009's lesson).

**Artifacts:** `docs/incidents/README.md` §Log + reports 0001–0010.

## 7. Model-class routing as a first-class roadmap dimension

**Claim:** tasks are explicitly routed by problem class to model class:
frontier model does design/grills/orchestration; strong tier does two-axis
review and architecture passes; cheap tier implements from self-contained
task packages. Wave quality held across four consecutive zero-fix-loop
waves under this ladder. Shipped 2026-07-15: roadmap items carry explicit
`procedural` / `design-frontier` labels (PRD §Roadmap labels) so the team
keeps velocity when frontier access lapses — and notices when it crosses
into design.

**Artifacts:** `docs/WORKFLOW.md` §Verification gates, scorecard trends,
`docs/personas/`.

**Hook:** "Capability allocation is an eval question: you can't route
problems to model classes until you've measured where each class stops
being sufficient."

## 8. Test honesty as a reviewable property (incident 0005 discipline)

**Claim:** "green" is treated as a claim requiring evidence, not a result:
coders must show tests failing without their fix (red-evidence), reviewers
explicitly judge test honesty (a `dispatchEvent('click')` standing in for a
reachable real interaction was rejected twice as dishonest — once even
though the coder's "unreachable" justification was *pointer*-true but
*keyboard*-false), and a DOM restructure that kept the existing test suite
at zero diff was recorded as the exemplary outcome.

**Artifacts:** incident 0005; PR #206/#214 review notes in the scorecard;
PR #224 ("zero-diff test suite through a restructure").

**Hook:** "Self-authored green is the weakest signal in the pipeline —
we made 'does this test have teeth' a named, per-PR review axis."

## 9. Vendor-agnostic process: swap the model, keep the gates

**Claim:** the workflow survives frontier-vendor churn by design. Roles are
capability-tier contracts (process docs name *cheap/strong/frontier* tiers,
never models — the current casting is one replaceable line), roadmap items
carry `procedural` vs `design-frontier` labels (so an executor *notices*
when work crosses from implementation into design), and every quality claim
rests on evidence gates — tiered wave check, scorecard, red-evidence,
harness assertions — rather than on any model's reputation. Swapping the
frontier partner is a casting change, not a re-org. Designed under real
conditions: intermittent frontier access with no guarantee of renewal.

**Artifacts:** `docs/WORKFLOW.md` §Casting is model-agnostic, PRD §Roadmap
labels, `docs/design-notes/farewell-roadmap-grill-2026-07-15.md`.

**Hook:** "When the vendor landscape shifts under you, the process
shouldn't notice. Evidence gates make models replaceable — trust in a
specific model makes it load-bearing."
