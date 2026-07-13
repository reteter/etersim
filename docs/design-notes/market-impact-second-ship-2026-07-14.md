# Market impact & the second-ship payback outlier (#152)

- **Date:** 2026-07-14
- **Origin:** #152 (flagged from #150 / E12) — a scripted two-ship one-route payback
  landed at ~175 world days on seed 1 versus ~40–60 on seeds 7/42/99, after the E9
  economics guardrail had already been widened from the spec's 20–40 to 60 days.
- **Status:** Resolved by owner grill (Q1–Q6 below). No engine change. Spec + CONTEXT.md
  + guardrail updated in the same task.

## The question

Was seed 1's outlier (a) a test-fixture artifact, (b) a phase-synchronization
sensitivity (the second hull launching in a bad phase of the first ship's cycle), or
(c) something else? The issue proposed either amending the pacing target or investigating
the sync effect.

## What the simulation showed

A throwaway probe (`src/sim/_probe152.test.ts`, deleted after use) ran the scripted
grain agrarian→urban loop across seeds [1, 7, 42, 99].

**Staggering the second hull's launch does not help** — durable payback (days from build
completion, measured over a 300-day horizon) barely moves with stagger:

| seed | stag 0 | stag 1 | stag 3 | stag 8 | stag 13 |
| --- | --- | --- | --- | --- | --- |
| 1 | 202 | 199 | 182 | 185 | 178 |
| 7 | 41 | 42 | 41 | 46 | 46 |
| 42 | 52 | 46 | 50 | 50 | 46 |
| 99 | 61 | 59 | 61 | 58 | 59 |

→ **the phase-synchronization hypothesis is falsified.** The effect is phase-independent.

**One ship vs two on the same lane** (120-day window) reveals the real mechanism —
margin compression from the Company's own trades:

| seed | 1-ship margin | 2-ship margin | profit 1→2 ships |
| --- | --- | --- | --- |
| **1** | 84% | **21%** | 15,474 → **8,659 (down!)** |
| 7 | 140% | 77% | 20,717 → 24,428 |
| 42 | 153% | 76% | 22,446 → 25,322 |
| 99 | 148% | 79% | 17,902 → 20,951 |

The pattern is uniform across seeds: a second ship raises the average buy price (drains
the producer) and lowers the average sell price (floods the consumer), halving the
per-unit margin. This is **Market impact** — the price curve responds to stock, so 2×
volume walks the price 2× harder against itself. Seed 1 is the outlier only because its
single-ship margin (84%) is the thinnest of the four (weakest grain gradient); halving a
thin margin lands near break-even (21% → ~175-day payback), while halving a fat one stays
healthy (76% → ~50-day payback). All four lanes are 1-hop, so lane length is not the
differentiator.

**Answer to the framing question:** two ships on one route *is* a viable, rewarded
strategy — on a healthy lane it adds ~15–20% profit; on a thin lane the second hull earns
less than one ship. Working as designed.

## Owner decisions (grill, 2026-07-14)

- **Q1 — real player signal, not a test artifact (B):** "two ships on one good lane" is
  the most intuitive first fleet-scaling move, so the behavior is worth pinning down.
- **Q2 — intended texture, not a balance problem (A):** market impact stays; the seed-1
  case is reclassified from bug to working-as-designed. No engine change, no
  anti-collision mechanic — that would dismantle the E8 economy for a feature.
- **Q3 — spec reframed (A):** the E9 pacing target moves from a flat "20–40 days" to a
  lane-conditional "~40–60 days on a healthy reference lane," with the market-impact
  principle recorded as the reason. (HEARTLAND v2's distances moved even the healthy lane
  past the old v1 figure, independently of seed 1.)
- **Q4 — guardrail package (1+2+3):** keep the seed-42 payback guardrail at 60 days;
  rewrite the stale phase-sync comment; add a property test locking the mechanic
  (`ledger.test.ts`: a second hull on seed 42 adds net profit yet at a compressed
  per-unit margin).
- **Q5 — glossary (A):** CONTEXT.md gains a **Market impact** entry (Trade & economy),
  derived from the price curve, not a new mechanism.
- **Q6 — legibility (A):** trust the route's last-loop result as the intended signal;
  cross-link #130 (surfacing undiscovered mechanics). No new UX scope here.

## Open playtest question

Is the route's last-loop result a strong enough signal for a player to *learn* "this lane
can't carry a second hull" before they waste a build on it? If playtest says no, that is
#130's territory (in-game hints for existing mechanics), not a re-open of this decision.

## Related

- #130 — in-game hints (legibility channel for this and other undiscovered mechanics).
- #115 — Ledger guardrail seed-1 sensitivity (same seed, same thin-gradient family).
- E9 spec — Pacing (the amended target); CONTEXT.md — Market impact.
