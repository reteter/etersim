# Founding progress bar — grill record (2026-07-14)

Grill of #134 ("cost stockpile → company investment policy"). Parking-lot item,
owner-flagged "do not implement without a grill." Outcome: the idea splits into
**A** (ships now, as A1a) and **B** (parked hook). This note records the decision
tree; implementation lands via **#157**.

## The split

The issue conflated two features with different cost and different roadmap slot:

- **A — visible founding savings goal.** Concrete, near-term, answers the fresh-eyes
  playtest hunger ("a goal to see"; `playtest-2026-07-12-fresh-eyes-kacper.md`, item 7).
- **B — company investment policy** ("direct 20% of income to investments"). The
  "bigger idea", but its payoff is at multiregion scale, which does not meaningfully
  exist yet.

The #122 grill's **equivalence result** already killed the stockpile as a softlock fix
(deposits respecting the Reserve admit nobody the hard gate blocks). So A is a
*goals/progression* feature, not a mechanics fix.

## Decision tree (A)

| Fork | Options | Choice | Why |
| --- | --- | --- | --- |
| 1. Feature job | A now / B now / both | **A now, B = hook** | B needs an "income" concept the sim lacks and pays off only at multiregion scale that does not exist yet |
| 2. Display vs stockpile | A1 display / A2 locked pot | **A1 — pure display** | equivalence proved deposits add no gating value; a real commitment device risks the agency guarantee; a freely-withdrawable pot ≈ a progress bar anyway |
| 3. Goal scope | A1a founding / A1b any build / A1c arbitrary | **A1a — founding only** | founding is the one place with a clean save-and-wait dynamic (fixed target, no other mechanic); post-founding, `computeBuildEstimate` + auto-draw already cover builds |
| 4. Placement | P1 PortPanel / P2 TopBar / both | **P1 — PortPanel HQ section** | the founding affordance already lives there (disabled button + tooltip); TopBar already carries the raw purse; a founding-only bar in permanent chrome is transient/odd |
| 5. Projection | R1 static / R2 ETA | **R1 — static** | ETA needs an earnings rate = the "income" concept, parked to B; static bar needs zero new sim concept, no determinism trap |
| 6. Reserve on bar | V1 single bar / V2 marker | **V1 — bar to ₸3,000, no marker** | target must be the real gate `HEADQUARTERS_COST + CONSTRUCTION_RESERVE` (a bar to ₸2,500 reads 100% while the button is still disabled — forbidden display/gate drift); Reserve pedagogy belongs post-founding (auto-draw stall), not here; breakdown stays in the tooltip |
| 7. Delivery | S1 own issue / S2 fold into epic / S3 note only | **S1 — own issue + PR** | small, self-contained, UI-only, no E3/E13 dependency; #134 rewritten as the B hook |

## A1a implementation shape (see #157)

Pure UI-side. Fill = pure helper
`min(thalers, HEADQUARTERS_COST + CONSTRUCTION_RESERVE) / (HEADQUARTERS_COST + CONSTRUCTION_RESERVE)`
(`buyCap.ts` / `priceTrend.ts` pattern), clamped at 100%, unit-tested. No new Ledger
kinds, no serialized state, no ADR, no CONTEXT.md term — it introduces no mechanic, so
it does not touch the "buildings introduce mechanics" law. Playwright E2E covers
visible-pre-founding / gone-post-founding.

## B — the parked hook (#134)

B stays parked as a locked direction. Un-park trigger: **real multiregion trading
exists** and entering a new market is demonstrably "wait-for-each-building" friction.
B then gets its own grill: define "income" (the Ledger has no income/revenue/profit
stream today), pick the earmark home (a building? the Headquarters?), and design the
auto-spend stream against the Reserve + agency guarantee — the second silent
automation on the purse after #122 auto-draw, so #122's "silent automation carries the
safety" lesson applies in full.
