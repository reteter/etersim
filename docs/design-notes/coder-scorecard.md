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

## Market panel refresh — #73/#74/#127 (2026-07-16, first single-PR batch)

First wave under the 2026-07-16 batching rule (#264): three coupled same-file issues
landed as **one PR** (`Closes` each), one Sonnet coder in one worktree, one Sonnet
tier-2 review over the whole diff.

| Date | PR | Issue(s) | Tier | Findings | Fix loop | Cert | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 07-16 | #265 | #73, #74, #127 | 2 | 0 | 0 | pass (coder-side) | Good icons + qty-defaults-max row + trend legend, one branch. Clean review — all 3 AC met, `maxQty=0` edge safe, e2e honest (no `dispatchEvent`). **Self-caught real regression the report models well**: added `display:flex` to the shared `.side-panel__subtitle`, corrupting `innerText()` assertions in ShipPanel; coder *disproved* the "parallel-worker contention" hypothesis (stash → baseline green; re-run same tests in isolation → still red = real regression), root-caused, and moved layout onto the icon element. New scar class (shared-CSS-class layout change breaks unrelated `innerText()` tests) → agent-memory. Two deferred notes: no reset-to-max chip (playtest watch); aria-labels stay EN by design (visible text PL) → #184. |

Cert note: coder ran full Playwright 92/92 + 477 unit in-worktree; post-merge full run
on main pending the owner's squash-merge of #265.

## E9.1 + E14 waves 1–2 (retro backfill from the 2026-07-16 LCM session)

Backfilled the same evening: the LCM session closed without appending rows (wave
reports died with it; PR bodies remain — findings/fix-loop `n/r` where the body
doesn't state them). Coder model: Sonnet 5; reviews per the LCM lesson: one
two-axis subagent per wave.

| Date | PR | Issue(s) | Tier | Findings | Fix loop | Cert | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 07-16 | #270 | #261, #262 | 3 | n/r | n/r | pass | E9.1 sim: Stop `qty` + Margin Gate + SAVE_VERSION 11. |
| 07-16 | #273 | #263 | 2 | n/r | n/r | pass | E9.1 UI: route editor qty/minMargin + "czeka na marżę" indicator. Closed the E9.1 milestone. |
| 07-16 | #277 | #238 | 2 | n/r | n/r | pass | Pages deploy + single-file build; the game went public. |
| 07-16 | #278 | #99 | 3 | n/r | n/r | pass | ConstructionSite seam extraction; zero behavior change, HQ tests green unmodified (the E9.1 byte-identity discipline). |
| 07-16 | #279 | #274 | 3 | 2 (minor) | 1 | pass | `baseHold` + Hold ladder + SAVE_VERSION 12. Two-axis review: Spec 0 (ladder math + migration independently re-derived), Standards 2 minors fixed in one round (unconditional migration backfill; independent recipe oracle). TDD self-flag: the one-line field assignments were assertion-covered after the fact. Spec erratum (rounding-scheme indistinguishability) surfaced by the review, routed to session close. |

## E14 wave 3 — #285 (first post-merge audit; the outage wave)

One Sonnet coder. The review became a **post-merge audit**: the owner squash-merged
during the 2026-07-16 platform outage; the reviewer — silently cast on the driver's
frontier model by dispatch default — was recast to Opus mid-outage (incident 0015
born here; casting rule now in CLAUDE.md).

| Date | PR | Issue(s) | Tier | Findings | Fix loop | Cert | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 07-16 | #285 | #275 | 3 | 5 (major) | 0 | pass | Shipyard building + RefitOrder lifecycle; 567 in-worktree, audit corroborated the count. The major is a **docs contradiction, not code**: instant-flat-cost vs "built via the Build Order pattern" (Design/CONTEXT) — audit judged the coder's reading defensible against the locked type, owner ratified *constructed* → #286 (package-side root cause: incoherent Tech draft). 2 minors owner-decided (deliver un-gated: accepted as spec'd; deliver co-location swallow: fixed in #287), 2 nits (netWorth refit siteStore → #287; barrel exports → #276 prerequisite). Standards axis: 0 defects. Coder report exemplary — 8 self-flags incl. honest TDD order (34 red-first, 2 after) and a read-path near-miss on the main checkout. Fix loop 0: all remediation was driver-side post-merge (#287) or re-scoped (#286). |

Advisor layer, E14 W3: consulted twice (sanctioned); the pre-PR consult surfaced
the netWorth flag the audit later confirmed independently — first advisor∩review
overlap in the tally, and a benign one (both layers right, coder-side first).

## E14 follow-up — #286 paired A/B (Opus vs Sonnet, 2026-07-17)

**First same-task pair in the sample.** Two coders, identical task package and
baseline (`main @ 1808706`), independent worktrees; arm B's branch was named
`eval/...` and never intended to merge — the comparative review then recommended
merging B, and the owner ratified it (#289 merged; #288 closed unmerged; arm-A
strengths ported via #290). Reviews: two-subagent `/code-review` fan-out per arm
(arm A's by orchestrator error — incident 0016; arm B's kept identical **by owner
request** for symmetric conditions). Full write-up incl. threats to validity:
`design-notes/ab-286-shipyard-construction.md`. Cost metric is **% of a session
limit** (subscription; Opus tokens weigh ~2×), token counts as sanity check.

| Date | PR | Issue(s) | Tier | Findings | Fix loop | Cert | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 07-17 | #288 (closed unmerged) | #286 arm A — **Opus** | 3 | 3 (judgement) | 0 | n/a (not merged) | 583 unit green in-worktree; Spec clean 8/8 AC. Cleaner code (guard-clause deliver, DRY `hasActiveBuildOrder`) but **no SAVE_VERSION bump — deviates from the written ADR-0007 precedent** (the losing axis). Third self-reported TDD-order deviation in the sample (netWorth term; closed + mutation-verified after advisor prompt) — **coder-contract grill triggered**. Advisor ×2. Cost ~30% session limit (169k tokens). |
| 07-17 | #289 | #286 arm B — **Sonnet** | 3 | 3 (judgement) | 0 | pass | 589 unit + proactive affected e2e 26/26 in-worktree; Spec clean 8/8 AC. **Gets the one written-precedent axis right** (SAVE_VERSION 12→13, identity migration, incident-0009 diligence). Judgement findings: non-null-assertion regression, 3× deliver duplication, one guarded weak assertion → all in #290. Zero TDD deviations; advisor ×1. Noticed the A/B setup from worktree metadata (saw only commit subject + SHA; disclosure audited, corroborated by full structural divergence). Cost ~21% session limit (254k tokens). |

Pair verdict: each arm had a real edge (A code cleanliness, B precedent
conformance + broader tests ~20 vs ~14 new behaviors + 30% cheaper); the tiebreak
was the single axis with a written answer. n=1 — a datapoint, not a ruling.
Post-merge cert: main @ c96315b — 589 unit / typecheck / lint / full Playwright
96/96.

## E14 wave 4 — #276 paired A/B (Opus vs Sonnet, 2026-07-17)

**Second same-task pair.** Identical package and baseline (`main @ f2a28f1`),
protocol upgraded per the #286 lessons (index scrub, neutral branch names,
reference-arm quarantine: A's branch + worktree deleted before B's dispatch;
B's disclosure audit clean). Reviews: one two-axis Opus subagent per arm
(tier-3 shape, symmetric — the incident-0016 correction held). Full write-up:
`design-notes/ab-276-shipyard-ui.md`.

| Date | PR | Issue(s) | Tier | Findings | Fix loop | Cert | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 07-17 | — (closed unmerged) | #276 arm A — **Opus** | 3 | 3 (judgement) | 0 | n/a (not merged) | PASS/PASS, 0 hard. Wins architecture (stall generalized in place, shared `SiteProgress`) and maintenance (teal clear of palette, defensive `?? 0`). Loses tests: 0 unit, brittle `toHaveCount(6)` + SVG `<title>` selectors; hides the commission section pre-HQ where repo precedent is disabled-with-reason. Advisor ×2. Cost ~24% limit (190k tokens). Reference branch kept for #292. |
| 07-17 | #291 | #276 arm B — **Sonnet** | 3 | 4 (judgement) | 0 | pass | PASS/PASS, 0 hard. Wins AC fidelity (precedent-aligned disabled-with-reason gate, safer refit confirm), tests (~11 unit over extracted pure modules, negative + purse-drop==quote E2E, `data-*` selectors, full suite 100/100) and flag completeness (disclosed a limitation A shared silently; caught the package's nonexistent "Storehouse pattern"). Regressions → #292 (duplicated stall walk, repeated JSX, violet near mining-purple). Advisor ×1. Cost ~14% limit (217k tokens). |

Pair verdict: axes split 3–2 for B; tiebreak = fix asymmetry (B's gaps are
mechanical ports with A as the reference; A's missing test architecture is not).
Owner ratified merge B; violet kept. **Series 2/2 for Sonnet, same shape both
times: written-rule conformance + broader tests at ~half the limit-% cost; Opus
wins architecture both times.** Post-merge cert: main @ ad37ae0 — 600 unit /
typecheck (full Playwright ran coder-side same content, 100/100).

## E14 follow-up wave — #290 + #292 (arm-A ports, 2026-07-17 s9)

Two Sonnet coders in parallel worktrees (disjoint file sets, reviewer-verified:
`src/sim/{commands,shipyard,shipyard.test}.ts` vs store/UI/e2e + new
`src/sim/siteEstimate.*`), one two-axis Opus reviewer over both diffs in one
context (tier 3). Casting footnote: the wave ran on Sonnet via the def
frontmatter while the s4 Opus override still nominally stood — incident 0017;
the owner closed the override the same session (Sonnet ratified as default).
Both dispatched under the pre-grill TDD line; the evidence path binds from the
next dispatch.

| Date | PR | Issue(s) | Tier | Findings | Fix loop | Cert | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 07-17 | #297 | #290 | 3 | 3 (note) | 0 | pass | Sim port of arm-A patterns + Professor F5 (`withShipyard` at all 10 sites, spread-order safe). Behavior-unchanged claim reviewer-verified (only the yard-autodraw assertion changed; zero `!` in the deliver chain via real narrowing; `tryDeliver` equivalence incl. ledger paths and zero-move tail). Notes: dead `applyDeliveryToSite` + deliberately-left sibling weak assertion → #299; `rushRefit` const cleanup judged in-scope (F5 site). Advisor ×2 — pre-code consult validated a real co-active HQ+Refit swallow trap in the guard design. |
| 07-17 | #298 | #292 | 3 | 1 (note) | 0 | pass | Stall-walk collapse + Professor F3 (dry-run of earlier sites through the real `drawConstructionSite` — same primitive as the tick, cannot drift); concurrent-sites test judged genuinely discriminating (naive `null` vs accounted `"reserve"`, grounded on real `tick()`); all 6 deleted `siteStall` cases retargeted, no coverage loss. TDD honored red-first on `siteEstimate` (math byte-for-byte the deleted UI copy; ADR-0002 purity improved). Note: `!quote` guard was vacuous — simplification exactly behavior-preserving. Design watch: `precedingSites = []` default is a future-caller foot-gun (coder-flagged, both call sites correct). Advisor ×2. |

Wave cert 2026-07-17: main @ e23ab48 — 607 unit / typecheck / lint / full
Playwright 102/102; postmerge CLEAN (arm-A reference branch deleted with #292).
Third and fourth consecutive zero-fix-loop tier-3 rows; first wave fully under
the corrected casting rule (reviewer's Opus named explicitly at dispatch).

| Date | PR | Issue(s) | Tier | Findings | Fix loop | Cert | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 07-19 | #301 | #272 | 3 | 1 (should-fix) + 2 nits | 1 round | pass | Barrel re-exports + `waitingGates` moved to new `src/sim/waiting.ts` (location was an Orchestrator decision, not the coder's). Hard part clean: reviewer verified the move byte-identical by diffing the deleted body against the new file, and audited all 5 old test cases to new homes — zero coverage loss, formatter assertions net *stronger* (old multi-gate case used 3 `toContain` probes and one self-referential interpolation; new one asserts the exact literal). Finding: `HeadquartersPanel.tsx:29` subpath import left unflipped — the file #272 named **first** in its own AC, and after the PR the only remaining subpath import in `src/`. Coder self-flagged an unlisted scope-adjacent file (`FleetList.tsx`), judged minimal and correct. TDD honored red-first (moved test failed on missing module before the impl existed). |
| 07-19 | #300 | #299 | 3 | 1 (should-fix) + 2 nits | 1 round | pass | Dead `applyDeliveryToSite` removed + `autodraw-refit` weak assertion strengthened (both flagged out of #290's scope). Dead-code premise independently re-grepped by the reviewer before accepting the deletion. Named red evidence supplied unprompted: mutated `autoDrawCapForDayTick` → `expected 30 to be less than or equal to 24`, reverted, green. Finding: `docs/specs/E14…md:90` still named the deleted function (spec-drift law). Fix-loop answer better than the instruction — declined the in-place name swap because the sentence describes the *pre-*#99 HQ-shaped state, kept it historical and added an accurate "As landed" note instead. Nits → #302, #303. |

Wave cert 2026-07-19: main @ 8e2cad3 — 611 unit (41 files) / typecheck / lint /
build / full Playwright 102/102; postmerge CLEAN (both worktrees removed, 4
branches pruned). Squash-merge means original SHAs are unreachable, so merged
content was verified by content probes, not `--contains` (incident 0010).

First fix-loop rounds after four consecutive zero-fix-loop tier-3 rows — both
one-item, both caught by the reviewer rather than the coders, and notably **both
were AC items the coders read past** rather than judgement calls: #272 named its
file explicitly, #299's spec-drift obligation is a standing law. Read as a
package-comprehension signal, not a capability one — the same two coders each
produced work the reviewer called clean on the hard parts. Watch whether
"explicitly named in the AC but skipped" repeats; if it does, the lever is
package shape (a checklist of named files), not casting.

## Reading the sample

Judge on trend, not single rows: findings-per-PR and fix-loop rounds at
comparable tiers. One weak-test finding (engine-byte golden, #172 round)
against the incident 0005 pattern — watch for repeats. Sample becomes
A/B-worthy at ~12 comparable tier-3 rows.

**TDD-line grill (2026-07-17):** the coder contract now names an explicit
evidence path — test-first stays the default; a test written after its
implementation is conformant only with named per-test red evidence (revert
or targeted mutation) flagged in the report. The three historical TDD-order
deviations (#205, #208, #288 arm A) were de facto that path before it had a
name. From here, rows count a deviation only for a missing flag or missing
proof — never for order itself.

**A/B series closed (2026-07-17, owner):** 2/2 for Sonnet with the same shape in
both pairs — treated as a consistent datapoint, not statistical proof; a third
pair was declined (~35–50% of a session limit for low marginal information).
Owner decision: **coder default = Sonnet** (closing the s4 Opus override —
incident 0017), **advisor = Opus**; targeted strong-tier coder casting remains
available for architecture-heavy packages (WORKFLOW §Casting). Revisit trigger:
findings/fix-loop trend degradation or a new model release.
