# Grill record — route automation (Cluster A), 2026-07-21

Owner-led, run in parallel with the #307/#332/#324 coder waves. Closes #357 — the first of
the two grill clusters #326's audit found unscheduled (companion: Cluster B, #358, not
grilled here).

Outputs: this note; `docs/design-notes/route-conditionals.md` (resolved → here);
`docs/design-notes/playtest-2026-07-14-routes-fleet-ux.md` §Cluster A (resolved → here);
`docs/PRD.md` §Parked hooks (`wait-until-full route orders` → here); `docs/specs/E9-fleet-and-routes.md`
§non-goals (pointer added, text unchanged).

## The question, split first

The 2026-07-14 playtest bundled two structurally different asks under one "route
automation" umbrella:

- **(a) Conditional/threshold Stop orders** — "wait with selling until \<condition\>" on a
  fixed Stop. The original 2026-07-09 ask, close to precedent.
- **(b) Dynamic auto-sell-at-best-price** — the Route's *destination itself* computed at
  execution time rather than fixed at authoring time. A materially bigger change: it
  redefines what a Route is (today: `CONTEXT.md` — "a looping, ordered list of port Stops"),
  not just what a Stop can do.

Splitting these first mattered because they have different costs and, as it turned out,
different fates — bundling them would have made (b)'s cost look like it belonged to (a).

## Verdict: (a) — lock reaffirmed, no design change

Three independent reasons, each sufficient alone:

1. **It would break a second lock from the same 2026-07-09 session**: "a ship on a Route
   never waits in port — it executes Stop orders and departs; only a direct player `sailTo`
   leaves a ship docked." A price-threshold Stop is waiting in port by construction.
   Approving it would mean reopening two locks at once, not one.
2. **It reproduces the exact degeneracy E8 was built to kill.** "Camp-at-producer
   autopilot" and "algorithm, not a decision" are E8's own named failure modes
   (`E8-living-economy.md` §Principle). A price-conditional Stop is the same shape one
   level up: a self-correcting mechanism that stops requiring the player's attention —
   which is precisely what "route rot *is* the gameplay" (E9's non-goal) exists to prevent.
3. **E3's contract quota already covers the adjacent need on contract-bound routes.** A
   quota obligation ("deliver ≥ N units per settlement period") is a standing-obligation
   automation on a different axis (quantity/cadence, not price) — it doesn't dodge bad
   prices, so it doesn't reproduce the autopilot shape. Free-trade (non-contract) routes
   have no such substitute, but that gap is diagnosed below, not filled by conditionals.

**Diagnosis, not just a rejection.** Two independent playtesters (owner and the 2026-07-12
fresh-eyes tester) organically asked for this. The likelier explanation is a **legibility
gap**, not a wrong design: neither playtester could see a route's margin decaying or get
price context inline while editing — exactly `playtest-2026-07-14-routes-fleet-ux.md`
§Cluster B's three symptoms (route editor lacks price context, Price Board readability,
illegible "sell all" execution). The energy this grill's evidence generated is routed to
**#358** (Cluster B), already filed, rather than spent building automation that would mask
the symptom instead of curing it.

## Verdict: "wait-until-full route orders" (PRD §Parked hooks) — same reasoning, same close

`route-conditionals.md` flagged this sibling hook as likely settled by the same grill: a
Stop that waits until the ship's hold fills before departing is the identical
lock-violation shape (waiting in port on a Route) as (a). Closed the same way, same reasons
— not left dangling for a future session to re-derive.

## (b) — out of scope here, and not an orphan

Dynamic auto-sell-at-best-price is explicitly **not decided by this grill**. It already has
a conceptual home: E9's own non-goal list names `"supplier" ship automation (parked hook —
the deliver order is its foundation)`, and `PRD.md` §Horizon tracks *Supplier ships*
(confirmed via `playtest-2026-07-12-fresh-eyes-kacper.md:53`, which names the same PRD
Horizon slot for an unrelated independently-invented request). Checked against the
trigger-is-a-promise law before leaving it as prose: this is a PRD-roadmap-tracked future
slot, the same exemption class #326's audit already established for grill briefs — not a
new orphan needing its own issue.

## Why no ADR

This reaffirms an existing lock; it does not create a new hard-to-reverse decision. An ADR
records a *new* commitment — reafirming one that already stands is exactly what a spec's
non-goal list and this note are for.
