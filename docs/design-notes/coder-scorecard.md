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

## Playtest wave 1 (#216 + #219 — enroll button, contract cards)

Two Sonnet coders in parallel worktrees (PortPanel vs KontraktyTab; shared
index.css additive-only, physically adjacent hunks — reviewer verified clean
merge-tree between the branches), one two-axis Opus reviewer. Third
zero-fix-loop wave.

| Date | PR | Issue(s) | Tier | Findings | Fix loop | Cert | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 07-15 | #223 | #216 | 2 | 0 | 0 | pass | Enroll button base style + visible disabled reason. Assertions strengthened, not weakened. Advisor catch pre-commit: affected-e2e widened to every PortPanel consumer (headquarters+market collateral run) — incident-0009 discipline applied unprompted. |
| 07-15 | #224 | #219 | 2 | 1 (note) | 0 | pass | Offers/contracts as cards, two-column grid. Test-honesty highlight: kontrakty.spec.ts has ZERO diff — restructure built to keep selectors valid instead of rewriting tests to survive (incident-0005 clear). Note: rank-badge ramp now on two semantic axes (required tier vs achieved rank) — judged defensible, self-reported by the coder. |

## Playtest wave 2 (#226 — desperation clause, deadlock fix)

One Sonnet coder, the day's heaviest package (sim + persistence migration +
UI + spec/CONTEXT sync in one task). Reviewer independently reproduced the
gates in an isolated worktree — first wave where the check re-ran the suite
rather than trusting coder-attested numbers.

| Date | PR | Issue(s) | Tier | Findings | Fix loop | Cert | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 07-15 | #229 | #226 | 3 | 3 (note) | 0 | pass | requiredRank decoupled from tier + stamp pass + SAVE_VERSION 9→10 + "Pilne" label + spec/CONTEXT sync. Red-evidence adapted to a type-forced field (stamp bypass → 8 red; gate revert → 2 red) — judged genuinely discriminating. Advisor corrected the invariant wording pre-review (min===1, not exactly-one). Owner-accepted tradeoff flagged prominently: v8 saves unreadable. Full e2e 80/80 run unprompted (whole-diff heuristic). |

## Drobiazgi wave — first under the Opus Orchestrator (#217 + #221)

Two Sonnet coders in parallel worktrees (fully disjoint file sets — TopBar/PortBar/
OptionsOverlay/new sailability.ts vs gameStore/GameMenu/worldDate), one two-axis Opus
reviewer over both diffs. First wave orchestrated by Opus 4.8 (not Fable), so the
Orchestrator had advisor() available — used pre-dispatch on the #217 plan.

| Date | PR | Issue(s) | Tier | Findings | Fix loop | Cert | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 07-15 | #244 | #217 | 2 | 0 | 0 | pass | Keybind `<g>` sails Controlled Ship to selected port. **Advisor caught the load-bearing trap pre-dispatch** (Orchestrator's plan review): reading reactive selectors inside the once-registered keydown listener would freeze on first-render `controlledShipId: null`; fix pinned to `getState()` inside the handler, dep array untouched — reviewer verified honored. `sailability` lifted to `sailability.ts` byte-for-byte (react-refresh). Honest TDD flag: 3 of 4 e2e are no-op regression guards (green at red), only the positive is true fail-first — stated plainly; positive test asserts arrival at the *selected* port, real key press (no dispatchEvent). |
| 07-15 | #245 | #221 | 2 | 0 | 0 | pass | Seed name in export filename, store-only. **Premise correction caught pre-dispatch** (Orchestrator premise-check): issue claimed "seed lives in the world" — it does not (`createWorld` hashes+discards); routed to owner → store-only decision, no save migration. Robust sanitizer (all-hostile → seedless fallback). Blank-seed timestamp gap surfaced honestly and correctly NOT re-scoped → follow-up #243. No `src/sim`/`SAVE_VERSION` change. |

Advisor layer, this wave: available to the Opus Orchestrator (correction 2026-07-15 — it
does work from a non-Fable main agent; the harness "check your network" retry message is
misleading, not a failure). Two pre-dispatch catches this time land at the Orchestrator's
planning altitude (stale-closure trap, wrong-premise scope) rather than inside a coder —
a new column of value from having advisor at the orchestration seat. Reviewer found zero
blocking issues on either branch; one optional cosmetic (worldDate.ts naming) left as-is.

## Drobiazgi wave 2 — #218 + #154 (under the Opus Orchestrator)

Two Sonnet coders in parallel worktrees (disjoint file sets — `src/ui/Tabs.tsx` +
`OptionsOverlay` + e2e vs `src/sim/ship.ts`/`index.ts`/`commands.ts` + `gameStore`).
Second wave orchestrated by Opus 4.8. Both diffs reviewed two-axis by the Orchestrator
(clean, in-scope). **The wave is memorialized by incident 0012** — a dispatch defect
(double-provisioned worktrees) forced both coders to work around a sandbox lock; work
recovered intact on both branches after Orchestrator verification.

| Date | PR | Issue(s) | Tier | Findings | Fix loop | Cert | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 07-15 | #249 | #218 | 2 | 0 | 0 | pass | `,`/`.` cycle overlay tabs, document-level `keydown` in the shared `Tabs.tsx` seam; typing-guard (`isTypingTarget`) verified by an e2e that asserts the route-name field receives `,`/`.` literally. 66/66 Playwright incl. 2 new. No double-fire (overlays modal, one `Tabs` at a time). **Delivered under sandbox lock (incident 0012)** — committed in the harness worktree, pushed by refspec. Advisor consulted once at the sandbox-conflict point → "relocate-and-flag over stop-and-report"; also flagged the harmless per-render `useEffect` re-subscribe. |
| 07-15 | #248 | #154 | 3 | 0 | 0 | pass | Pure refactor: `isRouteActive` unifies the route-active predicate (gameStore + commands.ts `sailTo`); `tick.ts` intentionally untouched. TDD honored (3 cases red→green). 474 unit. **Delivered under sandbox lock (incident 0012)** — Edit/Write locked to the harness worktree, so files written via **Bash `node -e`/heredocs** into the correct worktree; Orchestrator diff-audited all 5 files for escaping corruption (none). Advisor consulted once near completion (equivalence reasoning + prominent worktree-mismatch flag). |

Advisor layer, this wave: one coder-side consult each, both **process/dispatch-facing**
rather than code-defect catches (relocate-vs-stop under the sandbox lock; equivalence +
flag). New negative data point on resume mechanics: **#154's in-flight advisor call was
dropped by a mid-response API crash and NOT re-issued on resume** — not a conscious skip,
a silent gate loss (incident 0012 bonus lesson). Reviewer (Orchestrator two-axis) found
zero blocking issues on either branch.

## Drobiazgi wave 3 — #220 + #187 (first under the corrected dispatch convention)

Two Sonnet coders in parallel worktrees (disjoint: `HeadquartersPanel.tsx` + `index.css`
vs `vite.config.ts` + `package.json` + new test files). **First wave dispatched under the
incident-0012 fix** (PR #251): `isolation: "worktree"` only, no manual `git worktree add`,
prompt says "work in your assigned worktree" + push `HEAD:<target-branch>`. **Both coders
delivered with zero sandbox lock** — the fix is validated. Two-axis review by the
Orchestrator; owner routed both #220 flags to follow-ups.

| Date | PR | Issue(s) | Tier | Findings | Fix loop | Cert | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 07-15 | #252 | #220 | 2 | 2 (note) | 0 | pass | Route editor → goods × Kup/Sprzedaj/Dostarcz table; aria-labels byte-identical (e2e selectors untouched, no spec edits), `.chip--active` blue (ADR-0006, no gold). Two flags, both owner-routed to follow-ups: **issue↔model gap — #220 said "with qty" but `StopOrder` has no quantity** → grill issue #254; empty inactive cells lack a click affordance → mini-PR issue #255. Advisor consulted once in-flight (confirmed the qty read + the aria-label-vs-visible-text e2e risk before coding). HQ 12/12 + fleet 8/8. |
| 07-15 | #253 | #187 | 2 | 3 (note) | 0 | pass | React component test infra: default env stays `node` (ADR-0002 sim purity), jsdom opt-in per-file via `// @vitest-environment jsdom`; `include` widened `*.test.ts`→`*.test.{ts,tsx}`; guarded global `afterEach(cleanup)`. Proving test on `Tabs`. Three in-scope flags: global `setupFiles` (RTL imported into all 34 node files, empirically inert), extra deps (`user-event`/`dom`), and **`environmentMatchGlobs` removed in vitest 4** (real finding — the recommended glob-split isn't available, pragma is the path). 477 unit. Advisor consulted once (tightened the "didn't slow node suite" evidence). |

Advisor layer, this wave: one coder-side consult each, both **caught real risks pre-code**
(the qty issue↔model gap for #220; the node-env evidence tightening for #187) — back to
implementation-facing catches after the process-facing pair last wave. Cert caught its own
false-red: post-merge `npm test`/`tsc` failed on stale `node_modules` (incident 0013),
green after `npm install` (477 unit + 86/86 e2e). **Dispatch note: the incident-0012 fix
held on its first live wave — no coder hit a worktree/tool mismatch.**

## Reading the sample

Judge on trend, not single rows: findings-per-PR and fix-loop rounds at
comparable tiers. One weak-test finding (engine-byte golden, #172 round)
against the incident 0005 pattern — watch for repeats. Sample becomes
A/B-worthy at ~12 comparable tier-3 rows.
