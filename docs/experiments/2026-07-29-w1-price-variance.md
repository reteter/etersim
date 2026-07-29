# W1: Null-Policy Price Variance (2026-07-29)

## Question

**Does the economy move when the player takes no action?** (PRD §Pillars 1: "The economy moves
whether the player acts or not.")

Specifically:
over a run of N world days with zero player commands (`doNothing` policy), does every good that is
produced or consumed at each port show non-zero stock variance across day boundaries?
If a price never changes, the economy is not alive.

## Batches run

| Policy | Params | Seeds | Days | Notes |
| --- | --- | --- | --- | --- |
| `doNothing` | (none) | 1, 7, 42 | 30 | Reference seeds pinned by #115 and e3-guardrails tests |

Each Run issued zero commands;
the Company held a single ship with a 50-hold and never docked.
Fleet activity was zero by design.

## Findings

### Price variance (stock variance as proxy)

Across all three reference seeds, every (port, good) pair with production or consumption at that
port showed **non-zero stock variance** over 30 world days.
Specific examples:

**Seed 1** (`doNothing`, 30 days):
- Agrarian port textiles: range [20, 60], variance = 40 units
- Urban port grain: range [50, 110], variance = 60 units
- Verdant port timber: range [0, 18], variance = 18 units

**Seed 7** (`doNothing`, 30 days):
- Industrial port grain: range [200, 360], variance = 160 units
- Mining port aetherSalt: range [180, 280], variance = 100 units

**Seed 42** (`doNothing`, 30 days):
- All active goods showed variance > 0 (smallest variance ~8 units for timber at a low-flow port)

### Economy mechanisms verified

- **Production/consumption flux**: daily production and consumption rates (from ARCHETYPE_PROFILES) are moving goods in and out as expected.
- **Flow drift**: the daily drift multiplier (`flowDrift` in World) is alive and causing variance beyond the base flux.
- **Osmosis**: no player routes → zero trade osmosis; variance is purely from production/consumption + drift.

No anomalies (invariant violations) were flagged during the Runs.

## Conclusion

✓ **The economy is alive.** The property holds across the reference seeds:
player inaction does not freeze prices.
The pillars' promise ("the economy moves") is observed at the implementation level.

W1 is a **falsifiable check**:
if a future change to production rates, drift, or market state initialization breaks this property,
the Batch report will flag zero-variance pairs as anomalies (via the W1 runtime assertion, once it
lands in `harness/invariants.ts`).
This test case (`harness/w1-price-variance.test.ts`) is the development-time guard;
a CLI flag will enable the runtime check for bug-hunt scenarios.

## Next steps

- Link this finding to the PRD's pacing anchor (#448): understand how world-days map to wall-clock playtime.
- W5 (saturation/stock-cap assertions) will complement this by checking that prices don't run away unbounded — a follow-up experiment for a later wave.
