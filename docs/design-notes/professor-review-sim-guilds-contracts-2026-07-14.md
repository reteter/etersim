# Professor review — src/sim guilds + contracts (2026-07-14, E3 close)

Epic-boundary architecture review (owner-invoked) of the subsystem E3 shipped:
`guild.ts`, `contract.ts`, the contract/enrollment command paths, the day-boundary
settlement integration, and the new Ledger kinds. Overall verdict: *"came to find
rot and found mostly good timber"* — determinism kept (substream quarantine, single
main-stream advance pinned by test), settlement compounding correct, state shape
scales. Four findings, one of them load-bearing for E13.

## Findings & routing

| # | Finding | Severity | Route |
| --- | --- | --- | --- |
| 1 | **Offer generator is structurally blind to active contracts** (`contract.ts:168,197,211,230`): a still-short (port, good) under contract regenerates a ghost offer every boundary — mainline state, not a corner; ghosts starve `OFFERS_PER_GUILD_MAX`; the accept-side guard (`commands.ts:351-354`) patches the symptom downstream; untested. The hidden coupling in the offer-gen ↔ settlement loop that E13's stock-mutating Storehouses would amplify. | HIGH | **Issue #200** — must land before E13. |
| 2 | **`enrollmentFee` omits `thalers`** (`ledger.ts:86-90`), contradicting the module's own invariant ("every thaler or goods movement", `ledger.ts:10`); every sibling flat-fee kind carries the amount. An E11 ledger-replay cash-flow undercounts ₸400/guild. Settled spec (spec line 206), so: | MEDIUM | **Grill** — carries the new fact (violates ledger.ts's documented contract). Rolls into the grammar question below. |
| 3 | **Settle→refresh→netWorth ordering asserted only by proxy** (`dayBoundary.test.ts:179` proves upkeep-before-snapshot; the spec-carrying "fees inside the day's curve point" for settlements has no direct test). Not a god-phase yet — six named pure phases — but the ordering law is prose + one proxy. | LOW | **Grill / test backlog** — direct assertion; consider a structural phase-list as boundaries stack (E13). |
| 4 | **`pickSource` recomputes frozen topology every boundary** (`contract.ts:121-133,199`): O(ports² · goods · shortestCourse) daily over a post-worldgen-static lane graph. Harmless at HEARTLAND scale; a tick-cost cliff at multiregion. | LOW | **Parked here** — memoize round-trip distances when it starts to matter; revisit at multiregion. |

Benign note (no action): mid-day-accepted contracts settle at the first boundary
*after* `periodEndTick`, so the first period runs slightly long; at most one period
elapses per boundary. Correct; the docstring's "settles on schedule" is aspirational.

## Routed architectural questions (Professor → owner)

1. State shape vs many concurrent contracts: **scales fine** — flat array, one
   contract max per (port, good) by structural id; the scaling risk lives in
   finding 4, not here.
2. Offer-gen ↔ settlement ↔ rank coupling: **not clean** — finding 1 is the
   coupling; close before E13.
3. `dayBoundary` god-phase risk: **not yet**; harden the ordering contract
   (finding 3) before stacking more phases.
4. **Ledger event grammar**: accreting (13 kinds, inconsistent fields — finding 2
   is the evidence). Proposed rule to settle at the next grill, before E13 adds
   store/withdraw kinds: *every thaler-moving kind carries `thalers`; every
   rank-moving kind carries `pointsDelta`.* Cheap at 13 kinds, a migration at 20.

## Grill queue additions

- Ledger sub-grammar rule (+ `enrollmentFee.thalers` retrofit) — findings 2 + 4Q.
- Day-boundary ordering: direct settlement-in-netWorth assertion, phase-list idea.

E3's closed status is undisturbed — the epic stands. Finding 1 is the plank the
next epic builds on.
