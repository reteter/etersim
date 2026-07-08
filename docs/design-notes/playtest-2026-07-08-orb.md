# Playtest 2026-07-08 — seed `playtest-orb` (map polish shipped, E8 inputs gathered)

Owner playtest on seed `playtest-orb`. Ten observations; the five UI-polish items
shipped in **[PR #55](https://github.com/reteter/etersim/pull/55)**. The economy items
are inputs for the **E8 Living Economy** grill (PRD M2 — not yet spec'd/milestoned);
keybinds are **[#56](https://github.com/reteter/etersim/issues/56)**. Terms per
[CONTEXT.md](../../CONTEXT.md); process per [WORKFLOW.md](../WORKFLOW.md). Builds on the
[2026-07-07 market-legibility note](playtest-2026-07-07-market-legibility.md).

---

## Shipped in PR #55 (map polish)

1. **Docked ship glyph unreadable** on the bright port disc → dark halo, docked-only
   (`.ship--docked .ship__glyph`); no state-via-color, stays within ADR-0006.
3. **Default lanes too wide** → `.lane` stroke-width `0.5 → 0.35`.
4. **Accented lanes too loud** → port-accent `0.7 → 0.55` (softer glow), course-accent
   `0.8 → 0.6`.
5. **`Docked here` header is now a toggle** — from the ship's own ShipPanel it returns to
   that port's panel; otherwise opens the ShipPanel.
8. **Route preview on hover** — while the Controlled Ship is docked, hovering another port
   previews the shortest route from its berth as a muted static dashed course
   (`.lane--hover-preview`), reading as a hypothesis, weaker than a committed course.

Review fix folded in: a lane that was both preview and port-accent inherited the preview's
dash/opacity (muddied hybrid); `.lane--port-accent` now resets them.

**Vocabulary flag for the E9 grill:** #8 introduced a `preview` identifier family
(`previewLaneIds`, `.lane--hover-preview`) parallel to E10's `course` family — both render
a `shortestRoute` on lanes. Kept distinct on purpose (hypothesis vs. committed course);
fold into the route/course/preview reconciliation CONTEXT.md already defers to E9.

---

## Deferred to the E8 Living Economy grill

> **Resolved (2026-07-08):** grilled into the approved
> [E8 spec](../specs/E8-living-economy.md) — items 2 (elasticity + the whole mechanism
> stack), 6 (per-archetype price bias + per-port jitter), 10 (bid-ask spread ~2.5%/side)
> and 7 (price board overlay with bid/ask and best-buy/best-sell highlights) all land
> there. Original text kept below for history.

These sharpen — and in two places **extend** — the economy work already locked in the PRD
(elasticity + lane osmosis + stochastic drift; see 2026-07-07 note item 4). The locked
high-level directions mostly *converge* prices; the owner's `playtest-orb` feedback asks
for two levers the locked set does **not** cover.

### 2. Free-time arbitrage still dominant (re-confirmed)

Same root as the 2026-07-07 item 4: constant per-day flows, each good pure-producer or
pure-consumer per port (`src/sim/region.ts`), no restoring force → every market saturates
at floor (producers, stock→cap) or ceiling (consumers, stock→0) and stays pinned
(`src/sim/market.ts`). Time has no cost, so "run 100× until saturated, then harvest the
guaranteed max spread" beats active trading. Auto-pause-on-arrival only guards going AFK.

### 6. Zeroed prices are identical across ports — NEW E8 requirement

At stock 0 a good pins to `PRICE_CEIL × base`, and `base` is **global per good**
(`src/sim/goods.ts`) with global clamp multipliers (`src/sim/market.ts`) — so every
saturated port quotes the *same* extreme price (grain@0 = ₸40 everywhere). This is a
symptom of #2, but it exposes a gap: **the locked directions do not create durable,
structural price variation by port type.**
- Elasticity → at rest, price ≈ `base` (global) → still identical across ports.
- Osmosis → actively *flattens* cross-port gaps.
- Stochastic drift → noise, not type-based structure.

⇒ **New requirement for the E8 spec:** a **per-archetype (or per-port) price bias** so a
mining outpost intrinsically values grain higher than an agrarian breadbasket. Spatial
price heterogeneity is the actual engine of trade; today the only inter-port difference is
which goods flow in/out.

### 10. Single-port scalp: buy 10 / wait a tick / sell 10 = profit — NEW E8 lever

Breaks the `market.ts` comment "a buy-then-sell round trip at one market never profits."
That guarantee holds only for an *instantaneous* round trip (buy and sell walk the
**identical** price curve — there is **no bid-ask spread**). Wait one tick and the port's
consumption lowers stock → raises price → you sell higher than you paid. Profit = the
consumption-driven drift captured while holding. Another face of #2 (predictable monotonic
drift + free time), but it isolates a distinct, cheap lever:

⇒ **New requirement for the E8 spec:** a **bid-ask spread / transaction fee**, so any
inter-tick price move is not a free scalp. Independent of elasticity/osmosis; also the
game's first friction on churn.

### 7. Region-wide price board (already agreed, not built)

Locked in the 2026-07-07 note (item 3) as "full-info region economic panel (fog parked for
E6)" — all ports × all goods in one table, instead of clicking port-by-port. Open grill
questions from that note stand (overlay vs. panel vs. map layer; relation to the per-good
comparison badge). Lands in E8/M2.

---

## Summary of homes

| # | Observation | Home |
|---|-------------|------|
| 1, 3, 4, 5, 8 | Map polish (legible ship, quieter lanes, toggle, hover preview) | **Shipped — PR #55** |
| 2 | Free-time arbitrage | E8 grill |
| 6 | Identical zeroed prices → per-archetype price bias | E8 grill (**new requirement**) |
| 10 | Single-port scalp → bid-ask spread / fee | E8 grill (**new requirement**) |
| 7 | Region-wide price board | E8/M2 (agreed, unbuilt) |
| 9 | Keybinds + `Keybinds` options tab | **[#56](https://github.com/reteter/etersim/issues/56)** (scope grill first) |

*(Session closed 2026-07-08. Next: E8 Living Economy grill → spec → issues, per WORKFLOW.)*
