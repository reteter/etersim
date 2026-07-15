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

## E3 wave 3c (#96 + #97 — epic close)

One Sonnet coder, two branches from main (no stack), Opus reviewer resumed across
three passes. The coder survived a double infrastructure kill (API stall + session
limit) AND its assigned worktree being wiped by the reset — it rebuilt two fresh
worktrees, re-verified baseline, and continued; zero content lost.

| Date | PR | Issue(s) | Tier | Findings | Fix loop | Cert | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 07-14 | #194 | #96 | 3 | 2 (note) | 1 | pass | Kontrakty tab. Findings: Polish wording/declension + overclaiming test title; fixed in one round with a proper `pluralPl` helper and an honest hotkey press. |
| 07-14 | #198 | #97 | 3 | 4 (minor) | 2 | pass | Guildhouse + notice strip. Round 1: aria-label language; round 2: planned integration pass (guildDisplay extraction, CSS dedup, initialTab wiring, lastSeenTick owner decision). Final re-check verified timing arithmetic of the coder's self-caught e2e race fix (700→300ms, period math). 2 edge notes left open in the PR body (tab-switch on open board, import re-seed) → nit pass with #195. |

Epic-close certification 2026-07-14: 431 unit, typecheck, lint, full Playwright
73/73 on main @ 527edbe. E3 sample complete: 5 live tier-3 rows, findings all
minor/note, no coder-side correctness escape reached main; the one content escape
(incident 0010) was merge-procedure-side.
Coder advisor usage this wave: 3a consulted twice (caught two AC6 gaps pre-review),
3b twice (design + test-must-fail trap) — zero overlap with review findings, so the
advisor/review layers are complementary so far, not duplicative.

## Post-E3 chore wave 1 (#200 + #174)

Two Sonnet coders in parallel worktrees (sim + UI, disjoint files), one two-axis
Opus reviewer over both diffs in one context. First wave with zero fix loops.

| Date | PR | Issue(s) | Tier | Findings | Fix loop | Cert | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 07-15 | #205 | #200 | 3 | 1 (note) | 0 | pass | Offer-gen exclusion of active contracts. Coder self-reported a TDD-order violation (impl before tests; advisor-prompted) and compensated empirically — all 3 tests verified red without the fix; reviewer judged them discriminating. Note: guild-agnostic heldKeys safe only via the port.archetype partition — comment suggested. |
| 07-15 | #206 | #174 | 3 | 1 (note) | 0 | pass | Fleet rendering on RegionMap. Advisor caught a dishonest `dispatchEvent` test masking a real hit-testing bug; coder fixed the component (hit-target circle preserving #28 click-through) and restored a real `.click()`. Full local Playwright 76/76. Note: pre-existing cosmetic cursor on docked ships. |

Advisor layer again complementary: two coder-side catches (TDD-order gap, buried
AC failure), zero overlap with the reviewer's findings.

## Post-E3 grill wave (#203 + #204 — Ledger grammar, dayBoundary phases)

Two Sonnet coders in parallel worktrees from the same base (disjoint-files
agreement held — reviewer verified zero overlap), one two-axis Opus reviewer.
Second consecutive zero-fix-loop wave; both minors/notes folded as Orchestrator
micro-fixes on the branches (counted as findings per scorecard rules).

| Date | PR | Issue(s) | Tier | Findings | Fix loop | Cert | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 07-15 | #208 | #203 | 3 | 1 (minor) | 0 | pass | Ledger grammar law + first REAL save migration (v8→v9; v2–v8 all hard-rejected). Compile-time exhaustiveness + vacuous-truth-guarded runtime test judged honest. Minor: sim-subpath import, micro-fixed. Second self-reported TDD-order deviation in two waves (compensated revert-and-watch-red both times) — pattern to watch, maybe a coder-contract line. |
| 07-15 | #209 | #204 | 3 | 1 (note) | 0 | pass | dayBoundary phase list + direct settle→netWorth test; discrimination proven by reorder experiment. Advisor forced drift/priceSnapshot split to match spec order verbatim (third advisor catch in three waves). Note: implicit tick-invariance, micro-fixed with a pinning comment. |

Advisor layer: complementary again (spec-verbatim catch pre-review; zero overlap
with reviewer findings). Running advisor tally across E3+post-E3: 7 coder-side
catches, 0 overlaps with review.

## Post-E3 chore wave 2 (#195 + #196 — TopBar nit-pass, ShipPanel links)

Two Sonnet coders in parallel worktrees (both UI; TopBar vs ShipPanel disjoint,
shared additive hunks in ui.spec/index.css only), one two-axis Opus reviewer.
Wave straddled a session-limit reset: the #195 coder was killed mid-fix-loop and
resumed cleanly next window (branch state was the durable evidence).

| Date | PR | Issue(s) | Tier | Findings | Fix loop | Cert | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 07-15 | #213 | #196 | 2 | 0 | 0 | pass | Port links in ShipPanel via existing `select` action; honest keyboard e2e (focus+Enter). Coder correctly overrode wrong issue prose ("Harbor list uses it") by the operative AC. |
| 07-15 | #214 | #195 (+#198 riders) | 2 | 1 (major) | 1 | pass | Height fix (absolute positioning), controlled tab, lastSeenTick→store. **First major in the sample**: AC3 e2e used `dispatchEvent` on an "unreachable" claim the reviewer disproved for the keyboard path (no focus trap; aria-modal is a hint) — the honest focus+Enter pattern existed in-repo (sibling PR). Fixup verified in re-check; wiring itself was sound. Same dispatchEvent shape as the #174 wave catch — recurring smell, watch. |

Advisor note: the #195 coder consulted the advisor twice and it did NOT catch the
dispatchEvent issue this time (it had caught the same shape in the #174 wave) —
first data point where the advisor layer missed something review caught.

## Reading the sample

Judge on trend, not single rows: findings-per-PR and fix-loop rounds at
comparable tiers. One weak-test finding (engine-byte golden, #172 round)
against the incident 0005 pattern — watch for repeats. Sample becomes
A/B-worthy at ~12 comparable tier-3 rows.
