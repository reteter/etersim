# A/B experiment: #276 implemented independently by Opus and Sonnet (2026-07-17)

Second same-task paired trial (first: `ab-286-shipyard-construction.md`). One issue
(#276: E14 4/4 Shipyard UI — tier 3, UI-only, sim consumed through seams), one task
package, one frozen baseline (`main @ f2a28f1`), two coders dispatched cold in
isolated worktrees. Cost metric: % of a session limit (subscription; Opus tokens
weigh ~2×).

## Protocol (upgraded per the #286 lessons — all four applied)

- **Pre-dispatch scrub of the auto-memory `MEMORY.md` index** (eval vocabulary →
  topic-file backup, neutral state line; restored after both arms dispatched).
- **Neutral branch names**, no eval wording in either package: arm A
  `feat/276-shipyard-ui` (Opus, dispatched first), arm B `feat/276-shipyard-surfaces`
  (Sonnet, dispatched second, identical package verbatim except the branch name).
- **Reference-arm quarantine:** arm A was NOT pushed to origin; before dispatching B,
  A's worktree was removed AND its local branch deleted (bundle + SHA kept
  driver-side), so `git branch`/`git worktree list` showed B nothing. Restored after
  B finished.
- **Disclosure audit of arm B** (same prompt as #286): clean — B never ran
  `git branch`/reflog/worktree-dir listings; saw only main-line history. One wrinkle:
  B's audit "quoted" a dependency chain ("#99 → #274 → #275 shipped") that was not in
  its package — a confabulated detail in self-report, itself a datapoint on
  self-report reliability.

## Results

| | Arm A (Opus) | Arm B (Sonnet) |
| --- | --- | --- |
| Tier-3 review (one two-axis Opus subagent each, symmetric) | PASS/PASS, 0 hard | PASS/PASS, 0 hard |
| Judgement findings | 3 | 4 |
| AC coverage | full | full + precedent-aligned commission gate (disabled-with-reason; A hides pre-HQ) |
| New tests | 3 E2E, 0 unit | 4 E2E (negative case, purse-drop == quote) + ~11 unit (pure `refitBubble.ts`, `siteStall.ts`) |
| Architecture | **better**: stall generalized in place, shared `SiteProgress` | duplicated stall walk, repeated JSX; counter: pure testable `refitBubble.ts` |
| Honesty | flags all true | flags all true + disclosed a limitation A shares silently + caught the package's nonexistent "Storehouse pattern" |
| Maintenance | teal clear of palette; defensive `?? 0` | violet near mining-purple (flagged); full-recipe reliance |
| Cost | **~24%** limit (8→32%; 190k tokens) | **~14%** limit (36→50%; 217k tokens) |

**Comparative pass (one Opus analyst over both diffs + both review verdicts):**
axes split 3–2 for B (AC fidelity, tests, honesty vs architecture, maintenance).
Tiebreak: **fix asymmetry** — B's regressions are mechanical ports for which A is a
working reference; A's missing test architecture would need writing from scratch.
**Owner ratified merge B** → PR #291, `main @ ad37ae0`; violet kept (owner call);
arm-A strengths → issue #292; reference branch `feat/276-shipyard-ui` @ ddd33de
pushed to origin post-trial for #292, delete on its close.

## Threats to validity

1. **Isolation materially tighter than #286** — no branch/worktree metadata reachable,
   audit clean. Residue: repo docs (the #286 note, scorecard) were grep-reachable;
   neither coder read them (packages scoped reading; B's audit confirms).
2. **Review-package erratum, symmetric:** both review packages mis-numbered the ADRs
   ("ADR-0006 color, ADR-0007 saves" — repo's color rule lives in ADR-0006
   svg-icon-strategy §Color semantics; ADR-0007 is the margin gate). B's reviewer
   caught it; both reviews graded against the real rules.
3. **n=2 in the series, nondeterministic agents** — trend evidence, not a ruling.
4. **Asymmetric E2E effort was a coder choice, not a package difference** (A ran
   affected specs; B the full suite) — legitimate signal, but it inflates B's token
   count while improving B's evidence.

## Series read after two pairs

Sonnet wins both, and both times on the same shape: **conformance to a written repo
rule** (#286: ADR-0007 save bump; #276: the "never a silent no-op" precedent) plus
broader test evidence, at roughly half the limit-% cost. Opus wins code architecture
both times. If a third pair repeats the shape, the ladder question ("does the
strong-tier coder pay for itself on UI/sim-consumer tiers?") gets a real answer;
`docs/design-notes/coder-scorecard.md` carries the rows.
