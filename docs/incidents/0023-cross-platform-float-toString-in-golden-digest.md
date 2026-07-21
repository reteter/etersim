# 0023 — cross-platform float ULP drift broke a golden digest on first CI run

- **Date:** 2026-07-21
- **Detected by:** CI (`build` job, GitHub Actions `ubuntu-latest`) — not caught locally.
- **Status:** Closed (fixed same session).

## What happened

#306's golden-run digest test (`e13-0-equivalence.test.ts`) passed on the coder's
Windows worktree and passed the tier-3 review (also run locally, same platform).
It failed CI on `main` after merge: two `electronics` values in the fixture
mismatched in the 15th-16th significant digit
(`182.97495270109954` vs `...57`). Every other digest field — thalers, tick,
every other good, both site stores — matched exactly. Root cause: `market.ts`
prices via `** PRICE_CURVE_EXPONENT` (a non-integer exponent); `Math.pow`/`**`
is not guaranteed bit-identical across platforms or Node/V8 versions the way
`+ - * /` are. The digest formatted floats with bare `toString()`, so it
compared full float64 precision instead of the behavior contract.

## Impact

- **Outcome:** Low — caught by CI before merge influenced anything; fixed same
  session by rounding the digest's float fields to a fixed precision
  (`toFixed(6)`), regenerating the fixture, re-verifying both red-evidence
  drills still fire.
- **Failure-mode class:** Medium — the coder's local worktree and the tier-3
  reviewer both ran on the same platform as the fixture's generation, so
  *nothing in the wave-check path* could have caught this before CI. A wave
  with CI disabled (see `agent-memory.md` §GitHub Actions minutes) would have
  merged this red.
- **Rules broken/skipped:** none directly, but this is the same family as
  incident 0009's lesson ("golden tests must not pin engine-dependent
  bytes") in a subtler form — 0009 was about `JSON.stringify`'s key-order
  hazard; this one is about a value's own float64 precision surviving a
  non-arithmetic op (`Math.pow`) across platforms, which no explicit rule
  named yet.

## Recurrence

Medium — structural driver: this repo's local dev machine (Windows) and CI
runner (Linux) will keep differing, and any *future* golden/pinned test that
formats a float via bare `toString()`/template interpolation is exposed the
same way, silently, until it happens to touch a `Math.pow`-derived value.

## Recommendation

- **Prevent:** any golden-digest or fixture test that serializes a float
  should round to a fixed, coarse precision (this fix used `toFixed(6)`) —
  full-precision `toString()` compares platform noise, not behavior. Landed
  in `e13-0-equivalence.test.ts`'s `fmtFloat` helper, documented inline for
  the next author.
- **Detect:** CI running on a different platform than the dev machine is
  *already* the detector that caught this — the gap is that it fires after
  merge to `main`, not during the wave check. No change proposed; the cost of
  a pre-merge cross-platform run isn't justified by one incident.
- **Contain:** n/a — fixed.

## Follow-up

Landed same session: `fmtFloat` rounding in `e13-0-equivalence.test.ts`
(feat/306-golden-run-digest, folded into PR #351 before merge).
