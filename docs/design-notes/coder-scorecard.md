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

## E13.0 wave — #306 + #341 (2026-07-21, s16, parallel dispatch)

Two Sonnet coders in parallel isolated worktrees, unrelated issues sharing no
files (`src/sim/e13-0-*` + fixture vs `scripts/normalize-markdown.*` +
`CONTEXT.md` + `package.json`) — first genuinely independent parallel dispatch
since the #290/#292 wave (s9). Baseline both branched from: 611 unit tests,
41 files. #306 is the E13.0 refactor's behavior-preservation cover, dispatched
strictly ahead of #307 per the spec's issue-cut order. #341 was grilled to a
spec the same session before dispatch (`markdown-normalizer-grill-2026-07-21.md`).

| Date | PR | Issue(s) | Tier | Findings | Fix loop | Cert | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 07-21 | #351 | #306 | 3 | 1 (CI-only) | 1 | pass | Golden-run digest (C1) + phase-order snapshot (C4), zero production-code diff. Two-axis Opus review (pre-CI) verified both red-evidence drills genuinely discriminating (not the incident-0005 pattern) via independent re-derivation, not trust; caught and confirmed-fixed a coder self-reported `ports[0]` bug (RNG-drawn home port, not a fixed index); independently verified the repo's first `?raw` import's full typing chain before accepting it as merge-gate-safe. One Orchestrator micro-fix at wave-close (spec's stale `shipyard.test.ts:726` pointer → `:732`, plus a clarifying note that C1's `moveOwnGoods` reference describes #307's not-yet-built function). **Post-review, pre-merge: CI (Linux) caught what neither the coder's worktree nor the reviewer could — a cross-platform float ULP mismatch in the digest's `electronics` fields (`Math.pow`, not bit-identical across platforms) — incident 0023.** One fix-loop round via resume: rounded digest floats to fixed precision (`toFixed(6)`), regenerated the fixture, re-verified both red drills still fire, re-pushed; CI green on re-run. |
| 07-21 | #350 | #341 | 1 | 0 | 0 | pass | AST-based (`remark`/`remark-gfm`) markdown normalizer + `CONTEXT.md` proof migration. Tier 1 (docs/infra only, no `src/sim`/UI) — session-driver inline review, deliberately thorough given the migration's content-integrity stakes: independently re-derived word-count equality (7069=7069) and a whitespace-normalized full-file diff (byte-identical) rather than trusting the coder's own grep-based count, plus re-counted line-start bold headers (82→82, zero non-header hits) and confirmed the `**processed goods**` artifact that opened #341 no longer leads a line. Tests written after implementation, flagged per contract with two named mutation-based red drills (one caught the coder's own first-draft vacuous test before finalizing). One follow-up filed, not a fix-loop item: `eslint.config.js` has no `files:` block for `scripts/**/*.mjs` (pre-existing gap, → #349). |

Both merged same session. First tier-1 row in this scorecard to get a review
this thorough — judgement call: a content-integrity migration script's risk
isn't well captured by "docs/infra only" path-based tiering, so the session
driver escalated its own rigor without escalating the formal tier (no
subagent dispatched, per tier 1's own definition — the extra verification
was git-plumbing checks, not a review subagent).

## E13.0 wave 2 — #307 + #324 (2026-07-21, s16, parallel dispatch)

Two Sonnet coders in parallel isolated worktrees, unrelated issues sharing no
files (`src/sim`/`src/ui`/`src/store` vs `scripts/check-glossary-anchoring.*`).
#307 is E13.0's actual refactor, dispatched only after #306 merged and went
green per the spec's strict issue-cut order — closes the sub-epic.

| Date | PR | Issue(s) | Tier | Findings | Fix loop | Cert | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 07-21 | #366 | #307 | 3 | 0 (tier-3 review) + 2 (CI) | 2 | pass | GoodsStore + Transfer: opaque type (compiler-proven — an unused `@ts-expect-error` fails `tsc`), `StorePolicy`, `transfer.ts`, ~127-site migration across `src/sim`/`src/ui`/`src/store`, one PR (opaque type breaks a sim-only split). Two-axis Opus review: **MERGE, zero blocking findings on either axis** — independently re-ran every gate, grepped the whole diff for encapsulation escape hatches (found none), and verified both headline claims rather than trusting the report (the C3 invariant test draws its moves from `companyStores(world)`, non-tautological; the C2-caught-a-real-bug claim — FP accumulation order flipping a last bit, same class as incident 0023 — checked and confirmed genuine). Two informational, non-blocking findings: (A) a new test-support module (`e13-0-golden-scenario.ts`) imported `vitest`'s `expect` despite living in `src/sim`'s production module graph — fixed in one round (plain `assertTrue` helper, fail-loud verified by a deliberate corruption-then-revert drill); (B) an unreachable refit null-check divergence, left as-is per the reviewer's own call. **Second fix-loop round, post-review: CI (Linux) hit incident 0023's own predicted recurrence** — a NEW test (#307's C2 byte-identical save round-trip) added after 0023 was fixed, in a task package that didn't cite 0023 by number. Fixed same session (rounded deep-equal, 9dp, drill-verified a real value-swap still fails loudly) → incident 0024, naming the process gap (cite known incidents in task packages, don't wait for the class to reannounce itself). |
| 07-21 | #365 | #324 | 1 | 0 | 0 | pass | W9 automation (`check-glossary-anchoring.mjs`): glossary-term occurrence counter, anchored per incident 0020 against a known-answer control term ("Thaler") before trusting any zero-occurrence result. Tier 1 (docs/infra + `scripts/`, no `src/sim`/UI) — session-driver inline review: independently re-ran the real script against the repo (82 terms, zero orphans, matches exactly), read the full script + 14 tests. Coder caught its own pre-commit bug (PascalCase/camelCase identifier forms were case-identical under case-insensitive matching, silently double-counting — fixed and re-verified before ever reporting). Coder also caught and *declined* to ship a category-error doc edit (conflating "#324 automates W9" with "#324 automates the anchored-counts law," which a sibling LIVE note explicitly says is not centrally automatable) after an advisor consult — reverted rather than landing a false claim. Rebased at integration to resolve a `package.json`/`world-model-implications.md` conflict against two concurrently-merged PRs; both routing-table rows correctly marked done. |

## E13 #100 — delegation eval (2026-07-21)

The arms of the pre-registered solo-driver eval
(`eval-gpt-5.6-solo-driver-e13.md`), read at the whole-#100 aggregate (eval
§Granularity symmetry): the **pipeline** arm (#372, merged as real #100) and two
**solo-driver** GPT arms — **Sol** (frontier, #371) and the **Terra** cheap-tier
re-run (#373). GPT rows are **solo-driver units**, not coder-under-pipeline rows —
advisor column N/A — and do **not** enter the Sonnet coder trend sample.

| Date | PR | Issue(s) | Tier | Findings | Fix loop | Cert | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 07-21 | #372 | #100 | 3 | 3 (minor) | 1 | pass | **Pipeline arm** (Opus orch + Sonnet coder + Opus tier-3 wave check). Author-blind out-of-band ruler: **MERGE / MERGE, zero blocking/major**; 3 cosmetic minors (stale `resolveDeliveryTarget` doc-comment, English ledger strings under the legacy carve-out, a stray blank line). Hard-law scan all CLEAR — netWorth `total` **bit-identical** in the golden save (`buildingStoreValue` appended as a separate accumulator, `cargoValue`/`siteStoreValue` order byte-preserved), `migrateV13ToV14` float-free: **the incident 0023/0024 ULP class did not recur**. One internal fix-loop round (pinned `runGuildBuildAutoDraw` in the C4 phase-order snapshot + byte-equal Ledger over a building script). Built ON the E13.0 primitives (store/withdraw via `Transfer`; capacity/filter in `accepts`, not clamped in the command). Gates on independent re-run: 753 unit / 102 e2e / typecheck / lint / build green. Merged as real #100. |
| 07-21 | #371* | #100 | 3 | 1 (minor) | 0 | pass | *__solo-driver unit__ — GPT 5.6 sol@medium in its own harness, **no advisor/pipeline layer** (advisor N/A). Same author-blind ruler: **MERGE / MERGE, zero blocking/major**; 1 minor (`docs/specs/README.md:32` stale clause the Orchestrator itself authored — not GPT code). Objective gates green on independent re-run (732 unit / 102 e2e). Axis 3: **2 minor incidents self-filed** (0025 PowerShell expanded-replacement capture, 0026 route-editor e2e-affected near-miss — both self-corrected in-run, nothing reached the branch). Axis 4: full solo loop, monolithic single-feat-commit decomposition. Cost ≈45% of the weekly **frontier** limit (reported, not ranked — frozen threat #5). Quarantined, not merged (#371 closed). **[Erratum 2026-07-21 s19: the "1 minor / MERGE" here is incomplete — the Terra re-run established as an author-blind code fact that Sol's arm *also* lacks the #100 no-dominance guardrail test (a named AC). Re-judged at that rigor Sol is ~CONDITIONAL, one missing named-AC test. See the Terra row + eval §Erratum.]** |
| 07-21 | #373* | #100 | 3 | 3 major / 4 minor | 1–2 (est.) | pass (gates) / **NO-MERGE** (ruler) | *__solo-driver unit__ — GPT 5.6 **terra@medium** (cheap tier), own harness, **no advisor/pipeline layer** (advisor N/A). **Verdict: CONDITIONAL** (delegate-with-guardrails), provisional n=1. Author-blind ruler: **NO-MERGE** at the diff level. Hard-law scan all CLEAR (ULP class 0023/0024 did **not** recur; `resolveDeliveryTarget` legitimately deleted). Objective gates green on independent re-run (725 unit / 102 e2e / typecheck / lint / build) — **green-but-not-sufficient**; the shortfall is AC conformance no gate checks. Three majors, attribution grep-verified vs *both* control arms: (1) no-dominance guardrail test **absent** — shared with Sol; (2) deliver+rush to storehouse construction **absent** — Terra-specific under-reach, a missing named **feature** (Claude + Sol both have it); (3) v12 migration returns raw (`{12,13,14}`, missing `buildingStoreValue` backfill) — **Terra-specific but runtime-benign** (all `buildings` reads/writes guard `?? []`, live netWorth recomputed, chart reads stored `.total` not the missing field): a discipline+type deviation, **not** the correctness escape the ruler first labelled — hand-verified after its line cites came up ~40 off, which is what kept the verdict off NO-GO. Cost **16% of the weekly limit** — same shared pool as Sol, so 16% vs 45% is same-denominator (≈⅓); reported, not ranked (threat #5). Info-environment confound: reference key `509e2fd` was on `main`; Terra found it, asked to read it, refused — available-but-refused, still underperformed. Quarantined (branch kept), not merged; #373 closed. |

**Verdict — two arms, one task:**

- **Sol (frontier, ≈45% wk):** re-judged at GAP-1-aware rigor → **~CONDITIONAL**
  (one missing named-AC test, process-addable). *Falsifies* "GPT can't solo-drive
  a real feature near the merge bar" — it got close; a clean pass is weak evidence
  regardless.
- **Terra (cheap, 16% wk):** **CONDITIONAL** (delegate-with-guardrails), provisional (n=1) —
  a *deeper* CONDITIONAL than Sol: a missing test (GAP 1) **+ a missing named feature**
  (deliver+rush, GAP 2, Terra-specific) **+ an incorrect-but-benign v12 migration** (GAP 3).
  Ruler NO-MERGE at the diff level; est. 1–2 fix-loop rounds. *Not* NO-GO: the ruler's
  "correctness escape" on GAP 3 was hand-verified benign (guarded `buildings`, recomputed
  netWorth) after its line cites ran ~40 off — a near-miss where the eval's own thesis (verify
  the finding, don't trust the label) caught the driver. Per frozen n=1 asymmetry the
  *falsification* that did occur — cheap-tier-solo did **not** produce a clean merge-ready #100
  unaided — is the trustworthy direction.

**The money finding (instrument-independent, grep-verified):** dropping frontier→cheap cut
cost to ~⅓ but degraded conformance from "one test short" to "a test + a **feature** + a
migration short." Carried by GAP 2 (a missing named feature, code fact) — robust even after
GAP 3 is demoted from escape to laxity. **The win is the pipeline** (cheap Sonnet coder under
a thin strong-Opus review layer cleared the bar cost-effectively) — **not any solo**;
cheapening the solo degrades the product, not just the bill. Cost stays outside the trinary
verdict (frozen threat #5).

## Drobiazgi wave 4 — #375 + #302/#303 (2026-07-22, s21)

Two Sonnet coders, disjoint files (`src/ui/PortPanel.tsx` + `src/ui/buyCap.ts` +
`e2e/market.spec.ts` vs `src/sim/building.test.ts` + `src/sim/shipyard.test.ts`).
Dispatched async/background in a prior session (s20) under `isolation: "worktree"`;
both self-reported no harness worktree was pre-provisioned and improvised a manual
`git worktree add` (the exact incident-0012 anti-pattern) — see issue #378. Main
stayed clean both times (verified), so this is a near-miss, not a repeat of 0012.
A same-session repro dispatch (identical shape: `coder`, `isolation: "worktree"`,
async/background) **did not reproduce** the failure — dedicated worktree + branch
were provisioned correctly before the repro agent took any action. Root cause
stays unresolved; mechanism confirmed sound in the general case.

| Date | PR | Issue(s) | Tier | Findings | Fix loop | Cert | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 07-22 | #380 | #375 | 2 | 1 (minor) | 0 (session-driver micro-fix) | pass | Buy-cap hint: `buyMax === 0` keeps the absolute "Not enough thalers"; `buyMax > 0` now names the cap instead. Tier-2 Sonnet review: zero blocking findings, but caught a real incident-0005-shaped weak test — `buyCap.test.ts`'s "regardless of buyMax" case passed `buyMax=0` on both sides, so it never actually varied the parameter. Owner flagged the review's own "not a real risk" framing as the same pattern by another name (assurance from reading the switch statement, not from the test). Fixed directly (session driver, not returned to the coder): added `buyMax=5` variants; mutation-verified (coupling the hold/stock branches to `buyMax===0` now fails the assertion, reverted). Re-ran full local gate + CI green post-fix. |
| 07-22 | #381 | #302, #303 | 3 | 0 blocking, 1 (minor, out of scope) | 0 | pass | De-vacuates the last `if (store)` guard in `building.test.ts` (incident-0005 pattern) — also caught and fixed a sibling vacuity the issue didn't name (`store ? amountOf(...) : 0` ternary, line 141). Keys the shipyard auto-draw bound test on `AUTO_DRAW_PER_DAY` instead of a hardcoded, 2.4x-loose `24`. Two-axis Opus review: both changes verified as genuine strengthening, not relocated vacuity — arithmetic re-derived independently (`TICKS_PER_DAY=24`, draw caps 0–9, so the tightened bound is exact, not tautological). One non-blocking note: the test's own `24`-tick loop count is still a bare literal coupled to `TICKS_PER_DAY` by coincidence, not by reference — latent, out of #303's scope. |
| 07-23 | #399 | #391 | 3 | 0 blocking (code); 1 process | 1 | pass | `dockingFee` routeId tag + `SAVE_VERSION` 14→15. Coder Vitest-green (768) but **skipped Playwright e2e** — the wave check found the incident-0009 blocker it hid: the v13 e2e fixture `ledger-scenario.json` is unreadable under the new `{14,15}` READABLE_VERSIONS. Fix-loop (resume, incident 0014): hand-bumped fixture 13→14 + exact v13→v14 backfill (`buildings:[]`, `buildingStoreValue:0`; no float regen, incidents 0023/0024). Process note (not on the coder): the driver **under-gated** — ran a tier-1 inline review on this tier-3 change before the owner flagged it and it was escalated (incident 0016 §Recurrence). Post-fix tier-3 two-axis **Opus** review: **MERGE-READY** both axes — tagging rule exact (`isRouteActive`), migration a genuine identity, the two `route.test.ts` tests bite *complementary* mutations (incident 0005), golden scenario routeless ⇒ byte-identical. Green post-fix: 768 vitest / 111 e2e / typecheck / lint. Coder self-reported the e2e-gap root cause. |

## E16 waves — #392 enabler + #394 core (2026-07-23, s24)

Two Sonnet coders, background + `isolation: "worktree"` (the flag now confirmed to
provision only in the background — incident 0025 root-caused this session). Both clean
waves, tier-2 Sonnet review each re-ran gates independently. First E16 (Workbench) code.

| Date | PR | Issue(s) | Tier | Findings | Fix loop | Cert | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 07-23 | #402 | #392 | 2 | 0 blocking; 1 should-fix (spec-sync, driver) | 0 | pass | E16 enabler: market-quality signal selector (subsumes `columnExtremes`, behavior-neutral — no snapshot churn + a tie-at-extreme render test with mutation proof = Trap 1, board highlights off `tier==="strong"` not a singular port id) + read-only `RouteRibbon`. **Advisor (pre-push) caught two things the unit tests structurally could not:** a board-level Trap-1 gap, and an **incident-0002 gold near-miss** — the ribbon Ship glyph used reserved `#e0a840`, retinted to non-Controlled `#cfd6e2`. Coder TDD slip (impl before test) self-caught, recovered with named red + a `tierFor` mutation. Driver micro-edit: spec §Tech signature `(region, priceSnapshots)`→`(ports)` (doc-only, `priceSnapshots` feeds trend not the tier). Tier-2 Sonnet review re-ran 784/784, MERGE-READY. |
| 07-23 | #403 | #394 | 2 | 0 blocking; 3 nits (1 driver micro-fix, 2 → #405) | 0 | pass (116 e2e) | E16 core — the #376 heart: port-centric board authoring. **All five package pins held** (local-draft-then-commit gated on `isValidRoute`; `nextRouteId` *relocated* to `routeAuthoring.ts` not duplicated; inferred-kind tie rule named+commented `TIER_STRENGTH`, tie→buy; order-equivalence asserts the built `Route` payload `toEqual` a hand-built literal; non-scope respected — no assign/`sailTo`). Gesture collision with #62 row-nav resolved by gating authoring on draft-active (advisor-consulted; a dedicated E2E guards the default nav). **Second gold near-miss avoided cleanly** — coder chose highlight `#e0c265`, distinct from `#e0a840` (incident-0002 §Recurrence confirmed twice this session). Flag C (board is buy/sell-only; store/withdraw have no board home once #393 removes the RoutesTab editor) parked → **#404, blocks #393**. Nits→#405; aria-label English "at"→"w" driver micro-fix. Tier-2 Sonnet review re-ran 821/821, MERGE-READY. |

## E16 fan-out wave — #396 + #398 (2026-07-23, s25) — the #406 parallel-timing experiment

The first dispatch run **explicitly to measure** whether a genuine ≥2-coder parallel wave
shortens a session (#406), now that background isolation is confirmed to provision reliably
(incident 0025). Two Sonnet coders, background + `isolation: "worktree"`, one shared
tier-2 Sonnet review over the combined diff, owner-merged, full cert green (825 vitest /
120 e2e / typecheck / lint on `main`).

**Disjointness gate mattered.** #406 named #396 **+ #397** as the vehicle; the Orchestrator
killed that pair at dispatch — both render on the same PortPanel `GoodRow` (spec puts the
"okazja" label on the exact cell #396 shades), and #397 is cross-cutting by nature ("the
word" reaches offer surfaces on any layout), so it cannot be *confirmed* file-disjoint from
anything. Substituted **#398** (a truly disjoint partner); #397 goes solo later. The
experiment measures parallelism, not the selector, so a disjoint pair still runs it.

**#406 result:** parallel wall-clock ≈ **15m19s** (bounded by the slower #398) vs. a
sequential estimate ≈ **25m46s** (10m27s + 15m19s) — **~41% saved**. Orchestrator overhead
stayed low: one review covered both, one `index.css` overlap (hunks 625 lines apart —
merged clean), and one *package-quality* miss (the driver's #398 pointer named
`RouteRibbon.tsx`; the chip actually lives in `PriceBoardOverlay.tsx` — the coder caught and
corrected it). **Zero cross-contamination** despite the shared stylesheet — the point of the
background-isolation fix, confirmed. Verdict: a confirmed-disjoint pair is worth dispatching
in parallel; the cost is the disjointness proof up front, not the run.

| Date | PR | Issue(s) | Tier | Findings | Fix loop | Cert | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 07-23 | #407 | #396 | 2 | 0 (clean) | 0 | pass | PortPanel buy/sell action shading from the same `computeMarketSignal` selector the board uses (single source). Intensity-only (opacity/weight, hue-free — ADR-0006/incident-0002 respected). Unavailable≠faded held: class applies only on `canBuy`/`canSell`. **Mapping call (driver-decided, code-derived, not owner):** `strong`→bright, `mid`/`weak`→faded — because the as-built board is **binary** (`PriceBoardOverlay.tsx` branches only on `=== "strong"`; `mid`/`weak` render identically), so this keeps "bright = best market" identical on every surface. Surfaced the underlying spec drift (§rendering-1/2 "near-best steps down" / "(near-)best" was never built) → **#409** (owner call: sync prose vs. build gradient). Reviewer confirmed the e2e board↔PortPanel class-equality assertion *is* tier-equality (board `--best` ≡ `tier==="strong"`), not over-coupling. Tier-2 Sonnet: ship, no findings. |
| 07-23 | #408 | #398 | 2 | 0 blocking; 1 nit (test-coverage) | 0 | pass | Runtime execution legibility (cluster-B symptom c): chip reads `sprzedaj całość · {good}`; ephemeral routed-sale note `{Port}: sprzedano całość {good} ({n} szt.) — Stop {k}` in the pause-cause (#130) pattern (`gameStore.ts` + `TopBar.tsx`). **Scope flag watched, not hit:** note fully derived from already-exposed sim values (Ledger `trade` events + routes) — `advance()` diffs the append-only ledger, filters `side==="sell"` + `routeId` + greedy (`order.qty===undefined`) — **no `src/sim` change**. Package pointer was wrong (RouteRibbon → PriceBoardOverlay); coder corrected + flagged. Reviewer verified ledger-diff soundness (fold calls `tick(next,[])` with no commands so defs can't mutate mid-fold), `qty===undefined` keys the *order def* not `event.qty`. Edge-triggered persist-until-superseded lifecycle (no timer → determinism-safe). Nit: `reset()` test could also exercise `newGame`/`loadWorld` (shared `...INITIAL` path). Tier-2 Sonnet: ship. |

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
