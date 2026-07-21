# Route order conditionals — "hold the sale until …" (resolved, do not implement)

Raised by the owner during the M3/E3 grill (2026-07-09), while locking guild contract
mechanics. **Resolved 2026-07-21 (#357 grill): lock reaffirmed, no design change** — see
[route-automation-grill-2026-07-21.md](route-automation-grill-2026-07-21.md) for the full
reasoning (breaks the no-wait-in-port lock, reproduces E8's autopilot degeneracy, and E3's
contract quota already covers the adjacent need on contract-bound routes). Kept below for
history; do not re-litigate without new facts.

## The ask

The owner starts to see a need for a conditional sell mechanism on Routes: a Stop order
in the spirit of "wait with selling until \<condition\>" (e.g. a price threshold).
Origin context: continuous guild contracts (E3 direction) make Routes carry standing
obligations, which sharpens the question of *when* a loop should realize its margin.

## Why this is a real decision, not a tweak

- The approved E9 spec lists route wait/price conditionals as an **explicit non-goal**:
  "routes decay as the living market tightens spreads, and noticing and re-planning them
  *is* the game". A conditional sell weakens route rot — E9's core gameplay signal —
  so unparking this amends a design law, not just adds an order type.
- Locked at the same grill (2026-07-09): ships on a Route never wait in port — they
  execute Stop orders and depart; only a direct player `sailTo` leaves a ship docked.
  A "wait until" order would need semantics that don't contradict this (skip-and-carry
  vs. loiter), plus legibility for "why didn't my ship sell?" (pillar 4).
- Related parked hook: "wait-until-full route orders" (PRD, M2 parked hooks) — likely
  the same grill should settle both.

## Inputs to bring to that grill

- E9 playtests: does route rot actually feel like gameplay, or like babysitting?
- E3 contracts: do standing obligations make conditional sells more or less necessary?
  (A contract quota may already *be* the "when to sell" answer.)
- Fresh-eyes playtest ([2026-07-12](playtest-2026-07-12-fresh-eyes-kacper.md), raw log
  item 10): the first outside player, unprompted, asked for exactly this — "buy below
  the average price, sell above it, automate the process" — *and* found the route
  editor too complicated as-is. Signal that price conditionals are the intuitive mental
  model for route automation; the grill must answer why route rot is better, or fold.
