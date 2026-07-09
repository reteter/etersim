# Playtest 2026-07-07 — market legibility & v2 direction inputs

Parking lot for owner feedback from the 2026-07-07 playtest session (seed `playtest`).
Owner was not fully satisfied with v1 gameplay — these observations feed the next
design/grill session. Terms per [CONTEXT.md](../../CONTEXT.md); process per
[WORKFLOW.md](../WORKFLOW.md). Related locked work: [#35](https://github.com/reteter/etersim/issues/35)
(buy/sell UI, marginal price legibility).

Status: **grilled 2026-07-07 — v2 goals locked into [PRD](../PRD.md) (M2 — Living Region:
E8 Living economy, E9 Fleet & routes, E10 Orrery view).** Grill decisions: orchestration
as progression (manual trade stays); economy = elasticity + lane osmosis + stochastic
drift (no upkeep — parked hook); fleet-lite with dumb looping routes (no conditionals);
static orbit placement (motion parked for E5); full-info region economic panel (fog
parked for E6). Items 1 (trend glyph) and lane accent are quick wins inside E10/E2 polish.

---

## 1. Flat-trend glyph reads as a negative price

Screenshot: `tmp/ss/gamestate20260707_1.png` (Brassmoor, remote view).

The flat trend renders as `– ₸287` (`TREND_GLYPH` in `src/ui/PortPanel.tsx`), which reads
as **-287** — owner assumed a falling price or a bug. Root cause is purely presentational:
`–` (en dash) directly before the price is indistinguishable from a minus sign.

Direction candidates (to grill):
- Replace `–` with an unambiguous glyph (`=`, `→`) or drop the glyph for flat prices.
- Show trend *after* the price with a delta, e.g. `₸287 ▲12` — direction **and** magnitude.

## 2. "Buy here, sell there" decision is all in the player's head

> **Subsumed (2026-07-08):** the [E8 spec](../specs/E8-living-economy.md) price board
> (per-good cheapest-ask / highest-bid highlights) covers this decision region-wide; the
> per-good comparison badge in the remote port view is deliberately **not built** —
> revisit only if a post-E8 playtest shows the port panel still needs it.

When docked at port A and browsing port B, the panel shows raw prices only. The player
must memorize A's prices and mentally compute spread × hold − voyage cost. The core
decision loop of the game has zero UI support — hits the M1 success criterion ("price
differences and route choice keep mattering") directly.

Direction candidates (to grill):
- Per-good comparison badge in the remote port view: delta vs. the port the Controlled
  Ship is docked at, e.g. `+₸178/unit`, colored.
- Optional route summary under the table: best good for this leg, approximate full-hold
  profit (careful: marginal pricing makes this non-linear — ties into #35 legibility work).

## 3. Region-wide "economic panel" (owner idea)

> **Resolved (2026-07-08):** grilled into the approved
> [E8 spec](../specs/E8-living-economy.md) — an overlay (Options pattern) with ports ×
> goods, bid/ask + trend per cell, best-buy/best-sell highlights; full information (fog
> stays parked for E6).

Owner suggestion: a dedicated economic view — a price board for the **whole region**
(all ports × all goods in one table), instead of clicking through ports one at a time.
Flagged by owner as a topic for a grill and wider discussion. Open questions for the
grill: full information vs. fog (does perfect region-wide price knowledge kill the
"route is a bet" pillar?), placement (panel? overlay? map layer?), relation to items 1–2
(may subsume the cross-port comparison).

## 4. Dominant strategy: wait at the producer, sell to the starved neighbor

> **Resolved (2026-07-08):** grilled into the approved
> [E8 spec](../specs/E8-living-economy.md) — price-elastic flows (soft saturation,
> 0.25×–1.5×), per-archetype price bias, bid-ask spread, trade osmosis with a deadband,
> and daily flow drift; a dominance-guardrail test encodes that the camp-and-haul
> autopilot is no longer optimal. (Upkeep stays parked, per §8.)

Screenshot: `tmp/ss/gamestate20260707_2.png` (Brassmoor after a few world days: 3 of 5
goods at stock **0** / ceiling price, Aether Salt at stock cap / floor price).

Owner-reported optimal play: dock at a producer of good X, run 100× until the price hits
the floor, buy max, sail to the nearest port — which by then has zero stock of X, so the
price sits at the ceiling. "That's not a decision anymore, it's an algorithm."

**Root cause (sim analysis, `src/sim/market.ts`):** production/consumption are constant
per-day flows with no coupling between ports and no price feedback. Every good at every
port therefore drifts *monotonically* to its attractor — net producers to the stock cap
(price floor ₸0.25×base), net consumers to stock 0 (ceiling ₸4×base) — and stays there.
After a few days the whole region is saturated at the extremes: prices are static and
fully predictable, waiting is free, and the spread floor→ceiling is guaranteed. The
"route is a bet" pillar dies because nothing drifts anymore. Marginal pricing softens
the dump but doesn't restore any decision.

Direction candidates (to grill — likely the core of the v2 economy work):
- **NPC trade flows** (owner instinct; fits Harbor "other ships" and E3 draft):
  - *Cheap:* abstract "trade osmosis" — goods flow along lanes each tick from
    low-price to high-price ports, proportional to the gap. Deterministic, no ships.
  - *Rich:* simulated NPC ships visible on the map / in Harbors, doing the arbitrage
    the player does — the player competes with them for spreads.
- **Elastic flows:** consumption/production respond to price (expensive ⇒ consume less,
  cheap ⇒ produce less). Removes hard saturation; markets orbit equilibrium instead of
  pinning at floor/ceiling.
- **Cost of waiting:** daily upkeep / crew wages / docking fees so "100× and wait" burns
  thalers. Also the game's first money sink.
- **Stochastic drift** on equilibria or flows, so bottoming out is not deterministic.

These are complementary, not alternatives — elasticity + a waiting cost may be the
minimal fix; NPC flows are the thematic one.

## 5. Presentation: planetary system model; lanes too dominant

> **Resolved (2026-07-07):** grilled into the approved
> [E10 spec](../specs/E10-orrery-view.md) — static rings (one port per ring), decision-A
> topology + proportional ticks, selection/course lane accents, aether-glow package.
> The open questions below are answered there.

Owner (strong preference): the region should present as a **planetary system** — a star
in the center, ports as planets around it. "Absolutely — this would completely improve
the experience."

Lanes: current always-on lines dominate the map. Desired: lanes are subtle/accented by
default and become clearly visible when a port is selected (its connections light up).

Open questions for the grill:
- **Static or orbital?** Planets placed on orbit rings (purely visual skin over current
  positions) vs. actually *orbiting* over world time. Orbital motion would make
  distances/ETAs time-dependent — huge gameplay implications (routes open and close as
  planets align; could be a great source of the "route is a bet" tension that item 4
  says is missing — but a big sim change: `previewRouteTicks`, voyage mapping, #25).
- Interaction with **#25** (geometry-aware lane topology, decision A "map as space"):
  orbit-ring placement changes what "short connections" means; #25 implementation
  should probably wait until this is decided.
- Does the star matter mechanically (E5 aether currents?) or is it set dressing?
- Lane accent styling: hover vs. selection, route-preview highlight on Sail affordance.

## 6. Icon/glyph set — reheat #34

Owner wants [#34](https://github.com/reteter/etersim/issues/34) reheated with a bigger
selection of glyphs. Research answer (2026-07-07): **easily available sets exist, no
need to commission custom art** for the monochrome-tintable baseline:

- **game-icons.net** — ~4,200 monochrome single-path SVGs, CC BY 3.0 (attribution
  required). Best thematic fit: ships, anchors, planets, orbits, grain/timber/gear/
  crystal goods icons. Tintable via `fill: currentColor`; works inline in the SVG map.
- **Lucide** (MIT) / **Phosphor** (MIT) — clean UI-chrome icons (settings, pause,
  export), less thematic; good complement for panels.

Custom art (Claude Design) only worth it if we later want a cohesive *colored*
aether-punk style beyond tinted monochrome.

## 7. Owner's v2 goal statement

> A **living, self-balancing region** where the player can simply *watch* the region's
> economy work — plus **player-defined trade routes**, Transport Tycoon style: assign a
> ship waypoints A → B → C with per-stop load/unload orders.

Roadmap implications (for the grill / PRD update):
- The "living region" half is item 4's economy work (NPC flows / elasticity).
- The "routes with load/unload orders" half is essentially **E4 Fleet's route
  automation pulled forward** — v2 may become "living economy + route automation",
  with E3 (contracts & guilds) sliding later. PRD milestone order needs a decision.
- Note the shift in player fantasy: from hands-on per-leg trading toward
  **observe-and-orchestrate** — worth an explicit pillar check during the grill.

> Resolved → PRD: M2 locked as "living economy + route automation" (v2 grill,
> 2026-07-07); E3 slid to M3 — Guilds & obligations, locked at the M3 grill
> (2026-07-09; specs E12/E3/E13 approved).

---

## 8. Parked during the v2 grill (future hooks)

- **Ship upkeep / running costs** — owner: early-game upkeep feels like an unexplained
  penalty; introduce only when costs are legible (E3 era). v2's money sink = hull purchases.
- **Wait-until-full / timed route orders** — first candidate if playtests show ships
  sailing empty.
- **Real orbital motion** — E5 candidate (aether currents over a moving system).
- **Information fog on remote prices** — E6 candidate (events cut the telegraph).
- **Region/port upgrades; upgrade-gated multi-region economic view** — owner concept for
  the multi-region era; two big branches to grill when regions multiply.

---

*(Session closed 2026-07-07. v2 grilled and locked into the PRD the same day — see Status
at the top. Next steps: per-epic specs for E8 → E9 → E10 per WORKFLOW.)*
