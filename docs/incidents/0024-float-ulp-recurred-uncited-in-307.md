# 0024 — incident 0023's own predicted recurrence, uncited in #307's dispatch

- **Date:** 2026-07-21
- **Detected by:** CI (`build` job, GitHub Actions `ubuntu-latest`) on PR #366, before merge.
- **Status:** Closed (fixed same session).

## What happened

#307 (E13.0 2/2, GoodsStore refactor) added `persistence.test.ts`'s C2 test — a
byte-identical save round-trip comparing `exportWorldJson(runGoldenScenario())` via
strict `toBe` against a checked-in fixture generated on the coder's Windows machine.
CI (Linux) failed on the same mechanism as incident 0023, one PR later: several
float fields (region stock/price snapshots, osmosis pulses — all reached via
`market.ts`'s `Math.pow`-based price curve) differed in the 15th-16th significant
digit. Fixed by rounding both sides to 9 decimal places before comparison, verified
with a drill (a genuine value-swap mutation still fails loudly and clearly at the
rounded precision).

**The recurrence was named in advance.** Incident 0023's own §Recurrence line reads:
*"any future golden/pinned test that formats a float via bare `toString()`/template
interpolation is exposed the same way, silently, until it happens to touch a
`Math.pow`-derived value."* #307's original task package (dispatched before 0023 was
even discovered, since #306 and #307 ran in parallel) could not have cited it — but
by the time #307's coder wrote the NEW C2 test, 0023 was already fixed and merged on
`main`, and neither the coder's own dispatch context nor the tier-3 review package
I built afterward named it as a precaution for a test matching its own predicted
shape.

## Impact

- **Outcome:** Low — caught by CI on the PR, before merge; fixed same session, one
  fix-loop round.
- **Failure-mode class:** Low — unlike 0023 (nothing in the wave-check path could
  have caught it), this one's detector already exists and worked as designed
  (0023's own §Recommendation explicitly declined to move the cross-platform check
  earlier than CI, "the cost of a pre-merge cross-platform run isn't justified by
  one incident" — that call held here too, CI caught it at the right point).
  Rated Low rather than Medium because the actual gap is narrower: not a missing
  detector, but a missed **citation** — the tier-3 review package (`docs/WORKFLOW.md`
  §Verification gates: "the review package names the repo's scar tissue explicitly")
  named `docs/incidents/README.md` §Log generally but I did not point the reviewer
  or the original coder at 0023 *specifically* for a test the issue's own spec (C2)
  already flagged as new and float-heavy.

## Recurrence

Low, now that this is written down twice. Structural driver unchanged from 0023
(Windows dev / Linux CI), but the actionable fix is process, not mechanism: any
future task package for a coder writing a new golden/pinned/byte-identical test
should name 0023 by number, not rely on the coder rediscovering the class.

## Recommendation

- **Prevent:** when dispatching a coder (or building a review package) for work that
  adds a new fixture-comparison test in `src/sim`/`src/store`, check
  `docs/incidents/README.md` §Log for float-precision-class incidents and cite them
  by number in the task package — don't wait for the class to reannounce itself.
- **Detect:** unchanged from 0023 — CI is the detector, and it worked.
- **Contain:** n/a — fixed.

## Follow-up

Landed same session: `roundFloats` helper in `persistence.test.ts`'s C2 test
(feat/307-goods-store, folded into PR #366 before merge).
