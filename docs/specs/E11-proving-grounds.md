# E11 — Proving grounds

Feature spec for epic E11 (tooling track, [PRD](../PRD.md)). Terms per
[CONTEXT.md](../../CONTEXT.md) §Harness & evaluation. Grilled and decided with the owner
on 2026-07-09.
Status: **v1 approved (2026-07-15, farewell-roadmap grill)** — the re-review condition
("E9 ships first") was satisfied with room to spare: E9, E12 *and* E3 shipped before
this spec was picked back up. §Re-review below records the deltas. **v1 scope = the
Batch core + the `run` CLI**; `play` and `replay` are deferred to v2 (owner lock —
direct play is the most complex piece and the least needed for balance work; Runs stay
replayable by construction, Policy + seed). This session also served as the grill that
unparks #202 (its trigger named the cluster-B grill; the harness slice was grilled
here, the UI slices of cluster B stay parked for M4).

Grill inputs: session 2026-07-09 (seven-question grill, all decisions owner-confirmed);
[playtest-2026-07-09-living.md](../design-notes/playtest-2026-07-09-living.md) §New owner
inputs (performance board shares the Ledger); the #60 dominance-suite bots
(`src/sim/economy.test.ts` — the proven per-tick policy pattern this generalizes).

Scope in one line: a headless evaluation harness that lets an AI agent test game
versions — play batches of games via deterministic policies, analyze aggregated
telemetry, hunt bugs with perverse strategies — with every game replayable.

## Design

### Purpose (owner, 2026-07-09)

The primary user is an agent testing a build. Three canonical uses:

1. **Tactic optimization** — "play 100 games and derive the optimal tactic under the
   current balance."
2. **Run characterization** — "play 500 games and describe how a typical playthrough
   unfolds."
3. **Adversarial exploration** — "play X games trying unusual strategies to find bugs
   and unintended strategies/effects."

Companion play (agent playing live alongside the owner in the browser) is explicitly
out of scope; the harness's telemetry may later feed such an experience cheaply.

### The two-layer loop (decision: hybrid, policy-first)

An LLM cannot sit in the per-move loop of 500 games (cost, latency, and — decisively —
non-reproducibility). The architecture separates:

- **Policy layer (the core):** strategies are deterministic, parameterized TS functions
  (Policy). The agent's loop is *write/modify a policy → run a Batch → read the report →
  conclude → iterate*. Policy + seed = identical game, always; found bugs replay
  tick-for-tick.
- **Direct play (thin overlay):** the agent plays a single game move-by-move (state JSON
  out, commands JSON in) to explore ideas no script would produce. Every session logs
  its command script and thereby *becomes* a deterministic Run.

### Evaluation model

- **Metrics per Run:** profit/day, net-worth curve, voyages, hold utilization, per-good
  P&L, **strategy churn** (count of carried-good switches + distribution of consecutive
  same-good hauls — separates pendulum policies from opportunists), violation flags.
- **Batch reports:** per-seed aggregates (median/spread), head-to-head policy
  comparisons (the #60 dominance guardrail generalized into a reusable comparison), and
  an anomaly list with seeds for replay.
- **Runtime invariant assertions (toggleable):** the invariant-suite properties checked
  live inside every Run of a Batch. Bug-hunt mode = perverse policies + assertions on +
  large N.
- **Experiments:** question + Batches + written conclusions land as dated files in
  `docs/experiments/` (new convention, sibling of design-notes) — findings become grill
  inputs for balance and epics.

## Tech

### Placement & dependency rule (locked in the grill)

Top-level `harness/` directory, **outside the Vite bundle**; run with `tsx`. The harness
imports `src/sim` as a plain consumer (ADR-0002); the sim never imports the harness.
Policies live in `harness/policies/`. The #60 bots stay where they are (tests remain
self-contained); their pattern is generalized, not moved.

### Policy contract (decision: per-tick pure function)

```ts
type Policy<M> = {
  name: string;
  diagnostic?: boolean; // may read sim internals (drift, RNG) — bug-hunt only
  init(world: World): M;
  act(world: World, memory: M): { commands: Command[]; memory: M };
};
```

Polled every tick (the sim is fast; "decide only when docked" is just returning `[]`
underway). Full `World` in, player-visible reads by convention; `diagnostic` marks
policies allowed super-player knowledge. A formal Observation layer is deliberately
deferred until information fog gives it meaning (an Events-gradient candidate,
post-1.0 — PRD §Long-term fantasy; formerly "E6").

### CLI (decision: direct sim import, no MCP, no browser)

- `harness run --policy <name> [--params …] --seeds <n|list> --days <d> --out <dir>` —
  Batch: runs, Ledgers, aggregate report (JSON + Markdown summary).
- `harness play --seed <s>` — Direct play: emits player-visible state JSON per step,
  accepts command JSON; logs the session script. **(v2 — deferred 2026-07-15.)**
- `harness replay --script <file>` — deterministic re-execution of a Run / session.
  **(v2 — deferred 2026-07-15; batch Runs reproduce from Policy + seed without it.)**

An MCP adapter over the same core is a parked idea (portfolio demo), not first scope.

### Ledger schema (shared with the future performance board)

JSONL per Run: transaction events (`tick, port, good, qty, unitPrice, side,
thalersAfter`), docking/departure events, daily net-worth snapshots (thalers + cargo at
mid price). The in-game performance board (playtest 2026-07-09 input, E9-adjacent)
consumes the same schema conceptually — one vocabulary, two consumers. Schema drift
between them is spec drift.

## Testing

- Determinism: same policy + seed + days ⇒ deep-equal outcome and byte-equal Ledger;
  replay of a Direct-play script reproduces its Run exactly.
- Policy contract: a trivial do-nothing policy and a gradient-loop policy run a full
  Batch without violations; churn metric counts switches correctly on a scripted case.
- Runtime assertions: a deliberately broken world state (test fixture) trips the
  invariant checks and lands in the anomaly list with its seed.
- CLI smoke: `run`/`play`/`replay` round-trip on a small Batch in CI time budget.

## Re-review 2026-07-15 — the E9/E12/E3 delta

What changed in the world since the 2026-07-09 draft, and what it means for v1:

- **Policies get fleet, construction and guild play for free.** The policy contract
  emits `Command[]`, and the command union now includes routes (create/assign/
  suspend/resume), construction (found Headquarters, place Build Order, rush) and
  guilds (enroll, acceptContract, resignContract). No interface change — the 2026-07-09
  per-tick contract absorbed three epics without edits, which is the argument for it.
- **Metrics must be net of the new money sinks.** Profit/day and the net-worth curve
  already flow from the Ledger; per-kind aggregation is mechanical thanks to the
  grammar law (#203: every thaler-moving kind carries `thalers`) — report docking
  fees, upkeep, labor/enrollment fees and rush premiums as named cost lines.
- **New metric columns (E3):** rank/points trajectory per guild, settlement outcome
  counts (met/missed/breached/resigned), active-contract load over time. The
  loss-leader question ("does reputation investment pay?") becomes a policy
  comparison.
- **Runtime assertions inherit the E3 guardrails**, and the Desperation-clause
  invariant (every guild with open offers has a rank-1-acceptable one) is the
  canonical example of the harness's value: the #226 deadlock shipped and was caught
  only by human playtest, yet it is a one-line assertion over a seed sweep
  (INTERVIEW-NOTES §4 tells this story).
- **#202 folds in.** The `advanceDays(world, n)` / scenario-runner helper is the
  shared seam: Vitest guardrail suites and the CLI runner both consume it (DRYing the
  ad-hoc tick loops in `e3-guardrails.test.ts`). #115's seed-sensitive guardrail
  becomes a distribution assertion over a sweep instead of a point assert.
- **Fleet-aware reporting:** per-ship metric rows + company rollup; hold utilization
  across the fleet.

**v1 cut (approved):** `harness/` skeleton + policy contract + `advanceDays` seam,
Batch runner + metrics + report (JSON + Markdown), runtime assertions + anomaly list,
`docs/experiments/` convention. **Deferred to v2:** `harness play` (interactive
protocol), `harness replay --script` (session replay — batch Runs need no script to
reproduce), the MCP adapter (parked).

## Issue cut

v1 approved 2026-07-15; issues are cut once the approving PR merges, per WORKFLOW.
Suggested slices (each `procedural`): (1) skeleton + policy contract + `advanceDays`
seam + do-nothing/gradient policies, with guardrail suites refactored onto the seam;
(2) Batch runner + metrics + reports; (3) runtime assertions + anomaly list +
`docs/experiments/` convention + closing #202/#115 into their new homes.

## Portfolio note

This epic doubles as an evals/AI-quality portfolio artifact: deterministic sim as
substrate, policies as the unit of comparison, dominance comparisons as encoded design
goals, adversarial batches with replayable anomalies, and experiments documented with
their conclusions. The README/report formats should stay legible to a reader who has
never seen the game.
