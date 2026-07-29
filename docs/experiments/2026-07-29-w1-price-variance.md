# W1: Null-Policy Price Variance (2026-07-29)

## Question

**Does the economy move when the player takes no action?** (PRD §Pillars 1: "The economy moves
whether the player acts or not.")

Specifically:
over a Run of N world days with zero player commands (`doNothing` policy), does every good that is
produced or consumed at each port show non-zero **price** variance across day boundaries?
If a price never changes, the economy is not alive.

**Price, not stock.** An earlier draft of this experiment (and its test,
`harness/w1-price-variance.test.ts`) measured `port.market[good].stock` under a variable named
`price` —
a different quantity.
The real, player-visible price is `price(entry, base)` (`src/sim/market.ts`), clamped to
`[PRICE_FLOOR, PRICE_CEIL] × effectiveBase`.
A port resting at that clamp can show zero price variance while its stock still moves —
exactly the saturation the W5 census (`docs/experiments/2026-07-29-w5-saturation-census.md`, ~11.5%
of grain instances) found is real.
This rewrite measures the real price.

## Batches run

| Policy | Params | Seeds | Days | Notes |
| --- | --- | --- | --- | --- |
| `doNothing` | (none) | 1, 7, 42 | 30 | Reference seeds pinned by #115 and e3-guardrails tests |

Each Run was driven through the real `runOne`/`runBatchRun` machinery (`harness/batch.ts`), not a
raw `advanceDays` loop reimplementing it —
`runOne(..., { enableAssertions: true })` for the invariant-checking half, and a day-chunked
`runBatchRun` call (one day at a time, `doNothing`) for the per-day price sampling `RunRecord`
itself doesn't expose.
Every Run issued zero commands;
the Company held a single ship with a 50-hold and never docked.
Fleet activity was zero by design.

## Findings

### Price variance (real `price()`, clamp-aware)

Across all three reference seeds, every (port, good) pair with production or consumption at that
port showed **non-zero real-price variance** over 30 world days —
no port sat at the `PRICE_FLOOR`/`PRICE_CEIL` clamp for the whole Run at these seeds/day-count.

**Seed 1** (`doNothing`, 30 days, 30 active pairs checked):
- Smallest variance: agrarian port (p4) grain, range [6.016, 7.428], variance ≈ 1.41
- Largest variance: urban port (p1) timber, range [252.0, 438.0], variance ≈ 186.0

**Seed 7** (`doNothing`, 30 days, 35 active pairs checked):
- Smallest variance: agrarian port (p4) grain, range [6.668, 8.193], variance ≈ 1.52
- Largest variance: mining port (p6) electronics, range [156.4, 274.6], variance ≈ 118.2

**Seed 42** (`doNothing`, 30 days, 31 active pairs checked):
- Smallest variance: agrarian port (p5) grain, range [5.184, 8.038], variance ≈ 2.86
- Largest variance: mining port (p6) electronics, range [172.9, 297.7], variance ≈ 124.8

The smallest-variance pairs cluster on agrarian-port grain —
plausible given grain is an agrarian port's own domain good (produced there, so price stays close to
its own equilibrium), not evidence of clamp saturation;
none of these minima sit at a `PRICE_FLOOR`/`PRICE_CEIL` boundary.

### Economy mechanisms verified

- **Production/consumption flux**: daily production and consumption rates (from `ARCHETYPE_PROFILES`) move goods in and out, which is what moves price away from base.
- **Flow drift**: the daily drift multiplier (`flowDrift` in `World`) is alive and adds variance beyond the base flux.
- **Osmosis is not the cause here, but it is not absent either**: `osmosis.ts` iterates `region.lanes` unconditionally regardless of player routes — a `doNothing` Run's price movement comes from production/consumption/drift, and osmosis (lane-driven, not route-driven) can still contribute; this experiment does not isolate its share.

### Anomalies

**Assertions enabled, zero anomalies** across all three seeds
(`runOne(..., { enableAssertions: true })` → `checkInvariants` over every day boundary,
`harness/invariants.ts`).
This is a real result, not an assumption —
the previous draft of this doc claimed "no anomalies flagged" without ever running the assertion
machinery (`--enable-assertions` did not exist yet);
this run genuinely executed the checks.

## Conclusion

✓ **The economy is alive, measured on the real price.** The property holds across the reference
seeds at 30 days:
player inaction does not freeze the price a player would actually see.
The pillars' promise ("the economy moves") is observed at the implementation level, on the quantity
that actually matters to a player (price, not an internal stock number).

W1 is a **falsifiable check**:
`harness/w1-price-variance.test.ts` fails per-seed if any active (port, good) pair's real price
shows zero variance over the Run.
The W5 census shows this can genuinely happen at other seeds/day-counts (clamp saturation) —
this experiment's clean result at seeds 1/7/42 over 30 days is not a claim that saturation cannot
occur, only that it did not occur here.

## Next steps

- Link this finding to the PRD's pacing anchor (#448): understand how world-days map to wall-clock playtime.
- W5 (saturation/stock-cap assertions, `docs/experiments/2026-07-29-w5-saturation-census.md`) already shows real price-clamp saturation exists at other seeds/day-counts — a natural follow-up is running W1's assertion at longer day counts or the W5 census's seed set to see whether it would legitimately fail there.
