# Playtest analysis — 2026-07-14 (evening, random-seed run)

Owner playtest on a random seed (screens: day 89, 2 ships, ₸34,289, pre-E3-UI build
@ ~a08bcd3). Analyst pass: each observation verified against the codebase, then
routed. Terminology per CONTEXT.md.

## Observations

### 1. Auto-pause note changes TopBar height → issue (bug-ish UI polish)

Verified: `top-bar__pause-note` (`TopBar.tsx:91`, #130) renders as a second flow row
inside `.top-bar`, so the bar grows when the note appears and shrinks on resume —
the map viewport below jumps. Screenshot 1 shows the two-row state. Routing: small
UI issue — reposition so the note never affects TopBar height (overlay/absolute
within the bar, or a reserved slot). **Interplay:** the pending #97 branch adds the
notice strip to the same TopBar — land this fix after #97 merges and consider both
surfaces together (they compete for the same space; one consistent "status line"
slot may serve both). → **#195**

### 2. "Docked at {port}" in ShipPanel should link to the port → issue (small feat)

Verified: `ShipPanel.tsx:70` renders plain text; the store already has the port
selection action the Harbor list uses, so the wiring exists. Routing: small UI
issue — port name becomes a link/button opening that port's panel (and the
"Underway to {dest}" line deserves the same treatment for consistency). → **#196**

### 3. Ports without a min/max highlight on a good — correct, no action

Verified as intended: the Price board highlights exactly one cheapest-ask and one
highest-bid cell per good across the region (#62); with 9 ports most rows carry no
highlight for a given good. The "—" cells (screenshot 2: grain at Kruxhaven,
Velharrow, Coppervale) are the no-stock/no-ask state rendering correctly. Owner
judged it good information design. Recorded, nothing to do.

### 4. Dispatching ships from the Price board; board as a permanent region-view element post-HQ → cluster B grill input

Design idea, not verified against code (nothing to verify — new mechanic). This is
exactly the **cluster B (economic surface)** territory the E3 UI grill deliberately
deferred until contracts are playtested (lock 3): the Kontrakty tab (#96, merging
now) already changes what the board is for. Adding dispatch would make the board a
command surface, not just a readout — a real architectural step (map is currently
the only command surface besides panels). Routed to the cluster B grill inputs; do
not implement ahead of it.

### 5. Balance: income rates, price-change speed, additional mechanics for engagement → parked (post-E3 horizon)

Owner's forward-looking note, no code claim. Natural home: the balance/pacing pass
that E11 (Proving grounds) is designed to feed with Batch data — revisit when the
harness exists, or at the cluster A/B grills where pacing questions already live.
Parked here; no issue.

## Routing summary

| # | Route |
| --- | --- |
| 1 | Issue #195 (UI small, after #97 merges) |
| 2 | Issue #196 (UI small) |
| 3 | No action — working as designed, owner-approved |
| 4 | Cluster B grill input (economic surface, post-E3 per grill lock 3) |
| 5 | Parked — balance pass, E11/cluster grills horizon |
