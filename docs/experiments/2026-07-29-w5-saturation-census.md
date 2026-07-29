# 2026-07-29 — W5 saturation census (part of #234; not #115 — see correction below)

## Question

W5 (docs/design-notes/world-model-implications.md, 2026-07-19; reformulated in the
2026-07-28 comment on #234): does a null-policy Run ever drive a (port, good) pair to
**saturation** — resting near its price floor or cap, out of headroom, rather than at a
healthy interior fixed point?

As the reformulation established from the code: the sim has no local equilibrating
force per pair (`region.ts:48` — a good is pure source, pure sink, or inert; never
both). The only counterforce is `osmosisTick`. So the real question is a race: can
osmosis clear a producer's/consumer's flow fast enough to keep the terminal stock
fraction away from the boundary? **This step measures that race. It asserts nothing —
per the comment's ordering, a bounded guardrail (if any) is a follow-up that reads its
bounds off this census, and if the census itself shows saturation, the finding is the
deliverable.**

## v2 — reformulated per the 2026-07-29 owner grill on #234/#115

The v1 census below (terminal-state classification, arbitrary 240-day window) found
saturation but couldn't say whether it was a transient glut or a dead port — a
terminal-day snapshot can't distinguish "saturated for 3 of 240 days, just happened to
end there" from "saturated from day 60 onward." The owner grill resolved this:

1. **Metric**: time-in-saturation (% of the window's days spent near the boundary) and
   whether the pair **recovers** (leaves saturation again) or is still saturated at
   the window's end — not a single terminal-day classification.
2. **Window**: tied to a player-relevant reference, not an arbitrary day count. First
   choice — median world-days-to-`launch` from the harness's own milestone metric
   (#446) — turned out **unmeasurable**: `gradientLoop`, the only non-trivial
   reference policy, never issues `foundHeadquarters` or any build/launch command.
   Verified with a real Batch: `npx tsx harness/cli.ts run --policy gradientLoop
   --seeds 1000-1019 --days 60` — every milestone (`founding` through `completed`)
   is 0/20 reached. A "builder/contractor" reference policy that could reach `launch`
   doesn't exist yet (`harness/batch.ts`'s own doc comment names this gap, sibling to
   #449, out of scope here). **Resolution: `WINDOW_DAYS = 120` is a stated
   approximation** ("roughly twice any reasonable single trading cycle"), not a
   measured player-relevant figure — closing that gap for real is a follow-up.

### v2 method

`scripts/experiments/w5-saturation-census.ts` (rewritten in place, same file). 20
seeds × 120 days, `doNothing`. Per `(port, good)` pair: `isSaturated(s) = s ≤ 0.03 ||
s ≥ 0.97`, sampled every day. Reports, per pair: `daysSaturated`, `fractionSaturated`,
`everSaturated`, `terminalSaturated` (saturated at day 120), `recovered`
(`everSaturated && !terminalSaturated`), `firstSaturationDay`.

### v2 results

| archetype | good | prod/day | cons/day | n | ever-saturated | recovered | still-sat.@120 | median % window sat. (of ever-sat.) | median first-sat. day |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| agrarian | grain | 96 | 0 | 29 | 1 | 0 | 1 | 39.7% | 73 |
| freeport | grain | 0 | 6 | 20 | 2 | 0 | 2 | 79.3% | 34 |
| industrial | grain | 0 | 24 | 26 | 3 | 0 | 3 | 78.5% | 26 |
| mining | grain | 0 | 18 | 27 | 3 | 1 | 2 | 71.1% | 35 |
| urban | grain | 0 | 30 | 26 | 3 | 0 | 3 | 84.3% | 19 |
| urban | textiles | 24 | 0 | 26 | 1 | 0 | 1 | 26.4% | 89 |
| verdant | grain | 0 | 12 | 29 | 5 | 0 | 5 | 80.2% | 24 |

Every other `(archetype, good)` combination: 0 ever-saturated in 120 days (unchanged
from v1's inert/near-zero groups). Full per-pair numbers reproducible via the script.

### v2 conclusion — not a glut, a lock-in

**This is a materially different finding than v1's terminal snapshot suggested.**
17 of 17 grain instances that ever saturate within the window do so **early** (median
first-saturation day 19–35 across archetypes, one outlier at 73) and then **stay
saturated for the rest of the window** — median 71–84% of the entire 120-day window
spent pinned, for four of the five archetype groups. Only **1 of 17** grain instances
(one `mining` port) recovers before day 120. The one non-grain hit, `urban`/`textiles`,
is the opposite shape: late (day 89), mild (26.4% of the window), a plausible late-game
transient — but it's a single instance, not a pattern.

This rules out **option (b)** ("accept it as a rare, discoverable glutted-port
opportunity") for grain specifically, as originally floated in v1: a port that locks
into saturation by day ~25 and never leaves is not a discoverable event a player
stumbles into and trades around — for the ~11% of grain (port, good) pairs it hits, it
is a standing dead zone on the map for most of a playthrough's opening act. The
`urban`/`textiles` case is consistent with (b) as originally imagined; grain is not.

**No bounded assertion still lands from this file** — per §Laws 7–8, no constant is
tuned to manufacture a green, and the recommendation below is a grill output, not a
code change.

## v1 (superseded) — terminal-state census, 240-day arbitrary window

Kept for provenance; **do not read the v1 numbers as the current finding** — v2 above
supersedes it. v1 asked only "where does the pair end up," not "how did it get there
or does it come back," which is why the grill reformulated it.

Method: 20 seeds (1000–1019) × 240 world-days, `doNothing`. R1 inert
(`production=consumption=0`, confirmed a `marketTick` no-op by code inspection, zero
false positives among 154 inert-pair samples) / R2 saturated (terminal `s` within
`ε=0.03` of 0 or 1, end-window variance ≤ `0.0005`) / R3 living.

Result: 21 of 581 non-inert instances saturated (R2), 18 of those 21 (86%) `grain` —
≈11.5% of grain instances vs ≈0.7% of everything else combined. Hand-verified as
genuine terminal pins on a 5-seed sample (seed 1005, `verdant` port `p5`: `s` = 0.248
at day 0, 0.0001 by day 60, flat through day 240).

## Recommendation and outcome (owner grill, 2026-07-29)

The grill picked **(c) now, (a-per-good) later**: land a distribution-bounded
guardrail using this census's numbers as its stated margin, accepting the measured
~11% grain lock-in rate as a known, characterized feature of the current constants —
not tuning `OSMOSIS_CAP`/rate to chase it away without playtest evidence it actually
hurts. A **per-good osmosis rate** (raising grain's clearing capacity specifically,
since `OSMOSIS_RATE`/`CAP`/`DEADBAND` are global constants today — `osmosis.ts` — with
no per-good lever) is parked as its own future topic, gated on playtest evidence the
lock-in is actually a problem in play, not just in a null-policy census.

**Guardrail landed**: `src/sim/w5-grain-saturation.test.ts` — a multi-seed (1–20,
disjoint from this census's 1000–1019 sample) distribution assertion over the same
120-day window: grain's terminal-saturation rate must stay ≤25% (≈2x the measured
~11% baseline, headroom for seed variance while catching a real regression), every
other good's ≤10% (today: ~0%). Deliberately loose per the issue's own instruction —
this guards against saturation getting *worse*, it does not pin today's rate as a
target.

**Correction (2026-07-29): #115 is not touched by this work.** Earlier drafts of this
file (and two issue comments) treated this census as related to closing #115 — the
2026-07-19/2026-07-28 comments on #234 call this "the natural home for #115's
replacement." Checked directly: **#115 was closed independently on 2026-07-21**, as
OBE — its actual subject (a seed-1 payback discrepancy in a two-ship economics
guardrail) was settled as by-design (Market impact / diminishing returns), unrelated
to price/stock saturation. Those #234 comments predate that closure's context and are
stale on this point. The still-open, genuinely-related descendant of #115's
methodology lesson is **#374** ("multi-seed the storehouse no-dominance guardrail"),
a different test, not addressed here.

## Reproduction

```
npx tsx scripts/experiments/w5-saturation-census.ts
```

Deterministic: same seeds, same `doNothing` policy, same day count ⇒ same table
(ADR-0003).
