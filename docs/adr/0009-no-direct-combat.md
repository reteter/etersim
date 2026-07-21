# No direct combat: hazard is economic, never tactical

The player fantasy is *"a growing enterprise through routes, margins and timing — **not
through combat or reflexes**"* (PRD §Player fantasy, written in this repo's first commit
`37b5643`). This ADR **records** that decision; it does not create it. It exists because the
decision was load-bearing and, until 2026-07-19, uncited: PRD §Scope and PRD §Events gradient
both attributed it to **ADR-0004** (*Local persistence, no backend in v1*), which has never
contained it — the attribution was wrong from the foundation commit onward, not drifted into
(design-surface sweep **F10**).

## Decision

**Direct combat is out of scope at every lens level** — Region, Multiregion, Galaxy, and
beyond. There is no tactical layer, no ship health or weapons, no reflex-timed input, and no
mechanic whose skill expression is fighting rather than trading.

**What remains in scope**, per the Events gradient (PRD §Long-term fantasy):

- **In-region:** economic disturbances only — flow shocks, bounty and blight. *Never a threat
  to ships.*
- **Inter-region crossings:** travel hazards (aether storms, currents) as voyage outcomes.
- **Open aether:** pirates and free traders as **opt-in encounters** — an encounter is an
  *offer*, and ignoring it has zero consequence for route, cargo or purse
  ([route-events grill](../design-notes/route-events-2026-07-14.md), fork 1).

The operative boundary, in the PRD's own words: **piracy may exist only as an abstract
voyage hazard.** A pirate may cost you cargo as an economic event resolved by the sim; a
pirate may never become a fight the player plays.

## Why it is a law rather than a preference

The 2026-07-14 route-events grill weighed exactly this and chose to park intrusive events
"*without letting the first punitive mechanic enter casually*" (fork 4). The reasoning there
is the reasoning here: combat is not one feature among many but a **different game's skill
axis**, and admitting it once makes every later hazard question a matter of degree rather
than of kind. It also sits against Pillar 2 — *"depth comes from the market, not from
micromanagement"* — and Pillar 4, since a tactical layer is precisely the thing a legible
price panel cannot explain.

## The door is locked, not nailed shut

This is a hard no with a **documented reversal path**, inherited from route-events Phase 3.
Reopening requires **all** of:

1. real multiregion exists;
2. an explicit owner decision to revisit the **no-modification rule** locked at the
   2026-07-14 route-events grill (fork 1 — events never modify routes, cargo or purse), of
   which this combat ban is one instance;
3. a carrier building per the E9 law (e.g. an Escort dock) — mechanics arrive with buildings;
4. its own grill.

Recorded so a future session can tell "settled, do not relitigate" from "settled, and here is
what it would take" — they are different, and only the second is true here.

## Consequences

- `src/sim` carries no combat state: no hull integrity, no armament, no threat entities.
- The Events gradient is the single place hazard escalates, and it escalates in **economic**
  terms.
- The M6 grill inherits this as a rail, not a question
  ([grill-brief-m6-zoom-out](../design-notes/grill-brief-m6-zoom-out.md)).
- **3D is not covered by this ADR.** It is a presentation choice with no recorded trade-off,
  so it stays a plain PRD scope line rather than acquiring a rationale it never had. Filing
  it here would be manufacturing a decision retroactively — the failure this ADR was written
  to correct.
