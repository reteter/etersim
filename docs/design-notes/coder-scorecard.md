# Coder scorecard

Per-PR quality metrics for coder-delivered work under the model ladder
(session driver orchestrates / strong tier reviews / cheap tier codes —
WORKFLOW.md §Verification gates). Purpose: a durable sample for judging coder
quality per model release and for the deferred Opus vs Sonnet 5 A/B — wave
reports die with their sessions, this table does not.

**How to fill (Orchestrator, part of closing each wave check):** one row per
coder PR, appended when the wave check closes. Three numbers matter:

- **Findings** — review findings count, worst severity in parentheses
  (`0`, `2 (minor)`, `1 (major)`). Micro-fixes applied by the session driver
  count as findings.
- **Fix loop** — rounds back to the coder before the check closed (0 = clean).
- **Cert** — did the wave's certification run (affected e2e coder-side + full
  Playwright on main post-merge) pass without returning this PR to the fix
  loop? `pass` / `returned (reason)`.

Notes carry anything a number hides: incident links, weak-test smells
(incident 0005 pattern), package-side (not coder-side) causes.

## E3 waves 1–2 (retro, 2026-07-13/14)

Backfilled after the fact — findings/fix-loop counts were not recorded at the
time (`n/r`). Coder model: Sonnet 5 throughout; reviews pre-#163 ran the
two-subagent `/code-review`, post-#163 the tiered wave check.

| Date | PR | Issue(s) | Tier | Findings | Fix loop | Cert | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 07-13 | #155 | #56 | 2 | n/r | n/r | pass | Hotkeys + Keybinds tab; pre-#163 review. |
| 07-14 | #159 | #157 | 2 | n/r | n/r | pass | Founding progress bar; pre-#163 review. |
| 07-14 | #164 | #130 | 2 | n/r | n/r | pass | Pause-cause note. |
| 07-14 | #165 | #161 | 2 | n/r | n/r | pass | Skiffs; secured as wip at session limit — squash-message lesson in incident 0008 (orchestrator-side, not coder). |
| 07-14 | #169 | — | 3 | n/r | n/r | pass | dayBoundary seam + deriveSubstream (E3 wave 1 prep). |
| 07-14 | #170 | #92, #168 | 3 | n/r | n/r | pass | guild.ts: enrollment, ranks. |
| 07-14 | #172 | #95 | 3 | n/r | n/r | returned (fixture) | Upkeep. Coder's correct `SAVE_VERSION` bump broke an e2e fixture the package said to skip — package-side (incident 0009). Coder-side lesson same round: golden test pinned engine-dependent bytes; pin behavior contracts instead. |
| 07-14 | #180 | #93 | 3 | 0 | 0 | pass | Contract offer generator + causal expiry + substream migration — clean review on the wave's hardest task. |

## E3 wave 3 (#94+#98 → #181 → #96/#97)

First wave recorded live (not retro). Coder model: Sonnet 5; review: one two-axis
Opus subagent over all three diffs in one context, resumed for the fix-diff re-check.

| Date | PR | Issue(s) | Tier | Findings | Fix loop | Cert | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 07-14 | #188 | #181 (+#176) | 3 | 0 | 0 | pass | OverlayShell + Tabs; coder proved the #176 fix load-bearing (test red pre-fix); Tabs unit test deliberately deferred → #187. |
| 07-14 | #189 | #94 | 3 | 2 (minor) | 1 | pass | Breach parity + termination Ledger trace — both surfaced by review, both owner-decided, fixed in one round; re-check verified incl. the clamped-fold case; 2 cosmetic notes deferred to the #96/#97 wave (stale settleOne docstring, spec fold-seed wording). |
| 07-14 | #190 | #98 | 3 | 2 (note) | 0 | pass | Loss-leader guardrail honestly scoped (proves the weaker still-profitable claim, disclosed in-file); feasibility bound self-referential but #93 owns the independent geometry recomputation. Byte-identical through the post-fix rebase. |

Certified 2026-07-14 post-merge: full Playwright on main 64/64, unit/typecheck/lint
clean (main @ a08bcd3). Merge-side note, not a coder metric: #190's squash landed on
its stale base instead of main (incident 0010) — relanded via #192, prevention now in
WORKFLOW §Batching.
Coder advisor usage this wave: 3a consulted twice (caught two AC6 gaps pre-review),
3b twice (design + test-must-fail trap) — zero overlap with review findings, so the
advisor/review layers are complementary so far, not duplicative.

## Reading the sample

Judge on trend, not single rows: findings-per-PR and fix-loop rounds at
comparable tiers. One weak-test finding (engine-byte golden, #172 round)
against the incident 0005 pattern — watch for repeats. Sample becomes
A/B-worthy at ~12 comparable tier-3 rows.
