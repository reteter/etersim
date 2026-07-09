# Playtest 2026-07-09 — seed `playtest-living` (E8 verification)

Owner playtest of the shipped E8 economy (all seven issues merged, epic closed).
Screenshots: `tmp/ss/playtest-living_20260709_1..3.png` (Day 36 and Day 248 states).
Terms per [CONTEXT.md](../../CONTEXT.md); process per [WORKFLOW.md](../WORKFLOW.md);
protocol phases per the session briefing (A observe / B starvation verdict / C play the loop).

---

## E8 goals verified in play ✅

The epic's three target degeneracies are all confirmed dead by feel, not just by test:

1. **Camp-at-the-producer autopilot** — no longer plays as optimal (matches the #60
   dominance guardrail).
2. **Single-port scalp** (buy 10 / wait / sell 10) — no longer profits (spread working).
3. **"Algorithm, not a decision"** — owner reports the opposite: *"zaczyna grać się
   przyjemnie, fajnie obserwować osmozę i żyjący region"*; emergent strategy = buy the
   producer's surplus → haul to the best bid → repeat or switch good on spread. That is
   exactly the structural-gradient loop the spec aimed for, and it prefigures E9 routes.

Progression pull reported (bigger hold, routes/lanes, upgrades) — direct appetite for E9.
Thalers 500 → 86,210 by Day 248.

## Defects & polish (filed)

| # | Item | Home |
|---|------|------|
| 1 | Speed/pause hotkeys (`1`/`2`/`3`/`space`) missing — not a regression; unshipped scope | [#56](https://github.com/reteter/etersim/issues/56) (comment added) |
| 2 | Pulse animation too fast (1x fast, 100x lightning); grill: anchor travel speed to baseline ship speed — the visual currently contradicts "a ship always beats osmosis" | [#72](https://github.com/reteter/etersim/issues/72) |
| 3 | Port market panel: merge `Buy max`/`Sell max` into one compact row with `Buy …`/`Sell …` | [#73](https://github.com/reteter/etersim/issues/73) |
| 4 | Good icons before names (market rows + port description) | [#74](https://github.com/reteter/etersim/issues/74) |
| 5 | Price values misaligned vs TREND/BID/ASK headers | [#75](https://github.com/reteter/etersim/issues/75) |

## Balance observations (analyst read of the screenshots, to discuss)

- **Sole-producer starvation is live and durable**: grain asks show `—` (stock 0) at
  Velharrow and Palegate on **both** Day 36 and Day 248 — pinned for 200+ days, while
  Gildersey (agrarian producer) sits at the ₸3 floor with **stock 3732**. The parked
  tradeoff ([e8-followups.md §1](e8-followups.md)) is exactly what the screenshots show.
  **Open: owner verdict pending** — does the pinned rim read as *dead UI* or as a
  *standing premium route*? (It is lucrative: ₸3 ask at the producer vs ₸50–51 bid two
  hops out ≈ **16×**, far above the 25–40% resting-gradient target — the exception
  gradient dwarfs the designed ones.)
- **Natural play speed is 10x** at current port distances (~130-tick hauls); 100x is for
  waiting, 1x near-unused. Input for E9 pacing and any future distance tuning.
- **Spread collapses to bid = ask at low prices** (₸3 = ₸3, ₸4 = ₸4 after rounding) —
  the ~2.5%/side spread rounds to zero below ~₸20. Harmless today (scalping also needs
  price drift), but worth remembering if cheap-good scalps ever reappear.
- **Drift legibility unconfirmed**: the Day 248 board shows mostly `=` trends with a few
  ▲/▼. Whether the region visibly *breathes* over minutes of watching was not explicitly
  reported — **open question to owner**.

## Open questions (owner)

> **Resolved (2026-07-09, owner):**
> (1) Pinned rim = **standing premium route**, not deadness — one per region makes a good
> early-game ramp and a natural guide. Parked alternatives in
> [e8-followups.md §1](e8-followups.md) stay parked (verdict recorded there). Nuance the
> verdict rests on: *"one per region"* is a topology property worldgen does **not**
> guarantee yet — revisit at a worldgen grill if generated regions oversupply starved rims.
> (2) Drift reads healthy: opportunities always exist, only the spreads shift; the natural
> arc is grain (cheapest) → timber as fast as possible → expensive goods late. No
> amplitude change needed.

1. **Phase B verdict**: pinned rim — dead pixel or standing opportunity? Decides whether
   the parked alternatives in [e8-followups.md §1](e8-followups.md) stay parked.
2. **Drift feel**: did the price board visibly change on re-opens (goods swinging,
   opportunities appearing/expiring), or did it feel static outside player action?

## New owner inputs (2026-07-09 follow-up) — grill inputs

1. **Regulated money sink — "good moment to introduce":** per-port transit/docking fee,
   or differentiated per-port trade taxes — small, but felt. Partially unparks the PRD
   "Company running costs" hook (owner had parked it until costs are legible; the price
   board + two-sided quotes arguably make them legible now). → **E9 grill input** (fleet
   economics needs its sinks designed together with route profits).
2. **Company performance board:** transaction list, running result, possibly a chart of
   total company value over time. Serves the observe-and-orchestrate fantasy (E9) — and
   doubles as structured company metrics for the planned "Analyst-playable mode" harness
   (same data, two consumers). → **E9 grill input**, cross-linked to the Analyst-mode
   grill.

---

*(Session 2026-07-09. E8 closed; next per session queue: grill "Analyst-playable mode",
then grill E9 — this note's progression-pull and pacing items are E9 grill inputs.)*
