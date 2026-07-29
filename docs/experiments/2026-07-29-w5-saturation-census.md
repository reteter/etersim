# 2026-07-29 — W5 saturation census (#115 replacement, half of #234)

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

## Method

`scripts/experiments/w5-saturation-census.ts` (this PR). 20 seeds (1000–1019) × 240
world-days, `doNothing` policy (zero commands, every tick) — the null-policy Run the
question calls for. At every day boundary, for every `(port, good)` pair, samples
`s = stock / (STOCK_CAP_MULTIPLIER × equilibrium)` (`market.ts`'s own cap formula).

Regimes, derived at runtime from `ARCHETYPE_PROFILES` — never hardcoded per the
comment's instruction, since those weights are tuning and would silently invalidate a
hardcoded regime list after any tuning pass:

- **R1 inert** (`production = consumption = 0` for that pair): no Run needed to prove
  this one — `market.ts`'s `marketTick` computes `produced`/`consumed` from
  `profile.productionPerDay`/`consumptionPerDay`, both zero here, so the function is
  a no-op on `stock` by construction. Confirmed empirically anyway (every R1 pair's
  variance was driven only by `osmosisTick`, never by `marketTick`) — included in the
  table as a sanity check on the classifier, not as new information.
- **R2 saturated**: terminal `s` within `ε = 0.03` of 0 or 1, **and** its variance over
  the last 20 days ≤ `0.0005` (a std-dev of ≈2%) — "resting", not "passing through".
- **R3 living**: everything else.

Covariates carried per pair: port degree (lane count touching the port) and mean
`voyageTicks` of those lanes — both bear on osmosis's per-lane clearing rate
(`osmosis.ts`).

**Classifier sanity-checked, not just trusted**: a hand-inspection of five seeds'
`verdant`/`grain` trajectories (the highest-rate group) found one genuine pin — seed
1005, port `p5`: `s` at day 0 = 0.248, by day 60 already 0.0001, and flat at 0.0001
through day 240. The other four seeds in that sample sat at 0.10–0.31 the whole run —
correctly *not* flagged. The R2 count is not a threshold artifact.

## Results

20 seeds × 240 days, `doNothing`. Table: regime counts per `(archetype, good)` pair
across every port of that archetype, every seed (`n` = ports × seeds, varies by
archetype's port count in a given world).

| archetype | good | prod/day | cons/day | R1 | R2-sat | R3-living | median terminal s | degree range | voyageTicks range |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| agrarian | aetherSalt | 0 | 4 | 0 | 0 | 29 | 0.154 | 2–6 | 32–66 |
| agrarian | electronics | 0 | 2 | 0 | 0 | 29 | 0.140 | 2–6 | 32–66 |
| agrarian | grain | 96 | 0 | 0 | 3 | 26 | 0.615 | 2–6 | 32–66 |
| agrarian | textiles | 0 | 6 | 0 | 0 | 29 | 0.134 | 2–6 | 32–66 |
| agrarian | timber | 0 | 0 | 29 | 0 | 0 | 0.268 | 2–6 | 32–66 |
| freeport | aetherSalt | 0 | 0 | 20 | 0 | 0 | 0.201 | 3–6 | 31–64 |
| freeport | electronics | 0 | 0 | 20 | 0 | 0 | 0.236 | 3–6 | 31–64 |
| freeport | grain | 0 | 6 | 0 | 2 | 18 | 0.134 | 3–6 | 31–64 |
| freeport | textiles | 0 | 2 | 0 | 0 | 20 | 0.166 | 3–6 | 31–64 |
| freeport | timber | 0 | 0 | 20 | 0 | 0 | 0.285 | 3–6 | 31–64 |
| industrial | aetherSalt | 0 | 8 | 0 | 0 | 26 | 0.129 | 2–6 | 32–62 |
| industrial | electronics | 12 | 0 | 0 | 1 | 25 | 0.564 | 2–6 | 32–62 |
| industrial | grain | 0 | 24 | 0 | 3 | 23 | 0.126 | 2–6 | 32–62 |
| industrial | textiles | 0 | 0 | 26 | 0 | 0 | 0.226 | 2–6 | 32–62 |
| industrial | timber | 0 | 2 | 0 | 0 | 26 | 0.195 | 2–6 | 32–62 |
| mining | aetherSalt | 20 | 0 | 0 | 1 | 26 | 0.611 | 2–5 | 31–70 |
| mining | electronics | 0 | 3 | 0 | 0 | 27 | 0.172 | 2–5 | 31–70 |
| mining | grain | 0 | 18 | 0 | 2 | 25 | 0.146 | 2–5 | 31–70 |
| mining | textiles | 0 | 4 | 0 | 0 | 27 | 0.184 | 2–5 | 31–70 |
| mining | timber | 0 | 0 | 27 | 0 | 0 | 0.292 | 2–5 | 31–70 |
| urban | aetherSalt | 0 | 4 | 0 | 0 | 26 | 0.133 | 2–7 | 30–64 |
| urban | electronics | 0 | 4 | 0 | 0 | 26 | 0.150 | 2–7 | 30–64 |
| urban | grain | 0 | 30 | 0 | 3 | 23 | 0.127 | 2–7 | 30–64 |
| urban | textiles | 24 | 0 | 0 | 1 | 25 | 0.615 | 2–7 | 30–64 |
| urban | timber | 0 | 3 | 0 | 0 | 26 | 0.158 | 2–7 | 30–64 |
| verdant | aetherSalt | 0 | 0 | 29 | 0 | 0 | 0.176 | 3–5 | 30–64 |
| verdant | electronics | 0 | 0 | 29 | 0 | 0 | 0.197 | 3–5 | 30–64 |
| verdant | grain | 0 | 12 | 0 | 5 | 24 | 0.158 | 3–5 | 30–64 |
| verdant | textiles | 0 | 5 | 0 | 0 | 29 | 0.148 | 3–5 | 30–64 |
| verdant | timber | 6 | 0 | 0 | 0 | 29 | 0.495 | 3–5 | 30–64 |

## Conclusion — saturation happens, concentrated almost entirely on grain

R1 held exactly as the code guarantees: every inert pair's terminal `s` moved only via
osmosis, never approached the boundary, zero R2 among 154 inert-pair samples.

Among the 27 non-inert `(archetype, good)` combinations (581 pair-instances total),
**21 saturated (R2) — and 18 of those 21 (86%) are `grain`.** Grain-specific rate:
18 of 156 grain instances saturate, **≈ 11.5%**. Every other traded good combined:
3 of 425 instances, **≈ 0.7%**. Grain is both the highest-volume produced good (96/day
at `agrarian`, more than 4× the next-heaviest producer) and the most widely consumed
(every other archetype consumes it, up to 30/day at `urban`) — it is the good doing
the most work in the network, and the one closest to outrunning osmosis's per-lane
clearing rate. The saturating cases are genuine terminal pins (hand-verified above),
not threshold noise, and they recur across multiple archetypes (both producer-side
gluts at `agrarian`/`industrial`/`mining`/`urban` and consumer-side depletion at
every consuming archetype, most often `verdant`).

This is **not** "some good trends to the boundary at most ports of some archetype" (the
issue's original, too-strong false-if condition) — it is a real but minority tail
(~11.5% of grain instances, under 1% of everything else) concentrated on the network's
single heaviest-volume good. Per the 2026-07-28 comment's explicit instruction:
**no bounded assertion lands from this wave, and `ARCHETYPE_PROFILES`/`OSMOSIS_*`/
`STOCK_CAP_MULTIPLIER` are not tuned to manufacture a green** (§Laws 7–8). The finding
is the deliverable.

## Recommendation

Route to a grill: is an ~11.5% grain-saturation rate over a 240-day null-policy Run
within Pillar 1's intent ("a producer at 97% of cap has spent nearly its whole
arbitrage signal", per the reformulation), or does it call for either (a) raising
grain's `OSMOSIS_CAP`/rate specifically, (b) accepting it as a rare, discoverable
"glutted port" opportunity for the player (a feature, not a bug — matches the pillar's
"gradient the whole game is built on"), or (c) a distribution-bounded guardrail with
this census's numbers as its stated margin, decided consciously rather than backed
into. **#115 does not close from this PR alone** — it closes once the grill above
picks one of (a)/(b)/(c) and, if (c), a follow-up lands the actual assertion.

## Reproduction

```
npx tsx scripts/experiments/w5-saturation-census.ts
```

Deterministic: same seeds, same `doNothing` policy, same day count ⇒ same table
(ADR-0003).
