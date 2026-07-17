# 0016 — generic /code-review skill fan-out overrode the tiered review gate

- **Date:** 2026-07-17
- **Detected by:** owner — asked mid-review "was the skill worth it over the agreed single agent?"
- **Status:** Closed (both reviews completed and were used; deference clause added to the skill, gate-shape line added to CLAUDE.md)

## What happened

The #288 (`src/sim`) wave check should have run as **one** two-axis packaged subagent
(WORKFLOW §Verification gates, tier 3). The Orchestrator instead invoked the generic
`/code-review` skill, which by design fans out **two** parallel subagents — doubling
the review cost (~61k + ~65k subagent tokens, each re-deriving repo context).

## Impact

- **Outcome:** Low — both axes returned valid findings; cost roughly 2× the gate's shape.
- **Failure-mode class:** Med — systemic: skill descriptions live in every session's
  context while the tier table lives in a file, so the nearer rule wins by salience;
  repo docs even used "/code-review" as shorthand for the gate, legitimizing the reach.
- **Rules broken/skipped:** WORKFLOW §Verification gates tier 3 (one subagent, not two).

## Recurrence

Four-layer fix: (1) CLAUDE.md now states the gate shape wins and the skill runs only on
explicit owner request; (2) the global skill gained a step-0 repo-deference clause;
(3) SELFCHECK/professor no longer name the skill where they mean the gate; (4) this log
line. General lesson: an always-in-context skill description outshouts a rule that
lives in a file — counter it with a rule at the same salience (CLAUDE.md).
