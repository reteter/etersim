# E8 follow-ups — findings from implementing #60

Parking lot for calibration/scope findings surfaced while implementing E8
(sim track, #60 — stochastic flow drift, invariant + dominance suites).
Terms per [CONTEXT.md](../../CONTEXT.md); spec at
[E8-living-economy.md](../specs/E8-living-economy.md).

## Peripheral sole-producer starvation

**Found while writing the invariant suite (docs/specs/E8-living-economy.md
— Testing).** For a good with exactly one net-producer port in the region,
any port strictly beyond one lane-hop from that producer can starve
permanently: its price sits pinned at the 4× ceiling for the entire
days-31–60 sampling window (60-world-day run, no player, several seeds).

Confirmed the root cause predates #60 and is not caused by flow drift: it
reproduces identically with drift disabled (market tick + osmosis only,
`NEUTRAL_DRIFT`). Trade osmosis (#59) diffuses a real disequilibrium across
one lane hop (settled ratio ≈1.0–1.8×) but its per-lane rate/cap
(`OSMOSIS_RATE = 0.02`, `OSMOSIS_CAP = 0.01`) is negligible over two hops —
the trickle that reaches a two-hop consumer is far below its own
consumption rate, so it never climbs off the floor of its stock curve.

**Owner decision (2026-07-08): accept as intended durable-gradient
behavior, do not retune osmosis.** A remote port permanently priced at the
ceiling for a good it can't locally source is durable-gradient E9 route
fodder (a standing arbitrage a looping route is worth chasing), not a
region-health bug. The invariant suite (#60,
`src/sim/economy.test.ts`) was rescoped accordingly: for a good with a sole
producer, ports beyond one lane-hop from it are excluded from the
"no permanent floor/ceiling pin" check; goods with ≥2 producers, and every
port within one hop of a sole producer, stay fully checked.

**Deferred:** whether osmosis's reach should eventually extend past one hop
(e.g. a rate/cap retune, or explicit multi-hop diffusion) is left for a
future playtest to judge — it trades off directly against the dominance
guardrail's "a player ship is always faster than osmosis" property, so any
change needs re-validation against that guardrail, not a unilateral
constant bump. No issue filed yet; revisit after playtesting E8's shipped
behavior (drift + osmosis + elasticity together) feels right.
