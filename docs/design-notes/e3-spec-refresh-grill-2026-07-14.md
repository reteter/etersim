# E3 spec-currency grill — 2026-07-14

Pre-implementation refresh of the approved E3 spec (2026-07-09) against today's
`src/sim`, folding in Professor findings B and C
([review](professor-review-src-sim-2026-07-13.md); finding A closed via PR #149,
finding D routed to the E13 grill). Verified current before the grill: bid/ask
language, `GuildId = EconomicArchetype`, guild domain goods vs `ARCHETYPE_PROFILES`,
equilibrium, the single `applyTrade` seam.

## Locked

1. **Finding C — day-boundary seam.** The inline boundary block in `tick()`
   (tick.ts:219-241) is extracted into a pure `dayBoundary(world)` as a **separate
   behavior-preserving `refactor(sim)` issue**, merged before the E3 sim wave.
   Proof: byte-equal Ledger on a seed sample. E3 phases (upkeep → settlements →
   offer refresh) then slot into a named seam; the ordering law gets one home.

2. **Finding B — RNG substream.** New helper `deriveSubstream(state, tag)` in
   `rng.ts` (hash-mix of state + per-consumer tag): day-boundary consumers get
   isolated streams and never perturb one another's draws. Ships in the refactor
   issue (pure addition, unit-tested); the drift step migrates to its own substream
   in #93, when the second consumer arrives. Rejected alternative: one linear
   stream with a frozen-and-tested draw order (fragile — every future consumer
   reshuffles world evolution and repins the test). ADR-0003 extended, not
   challenged.

3. **Upkeep × agency guarantee (the #122 named gap).** Upkeep never takes the
   purse below the **Reserve (₸500, the same `CONSTRUCTION_RESERVE`)**:
   `min(fee, max(0, purse − RESERVE))`, unpaid remainder evaporates — no debt, no
   arrears, no penalty. Rationale: upkeep is a *standing* drain, reachable by
   inaction; at ₸0 with empty holds no income path exists, which would be the
   game's first true dead state (defect per the #122 lock). The Reserve's meaning
   widens: construction spend *and standing costs* never cross it. Docking fees
   stay as shipped (active player choice, outside the Reserve). Rejected: stall at
   ₸0 (contradicts #122); floor for all fixed costs including docking (retroactive
   E9 change, weakens "docking costs").

4. **#95 scope confirmed** — ship upkeep is in E3, first sim wave, depends on the
   dayBoundary refactor.

5. **#116 folded in** — CONTEXT.md Ledger prose and E9 spec prose aligned with the
   shipped shape (`routeId` on `trade` events only; other kinds correlate by
   ship + time window) in this refresh's docs PR.

6. **#98 × the #115 lesson.** The loss-leader guardrail runs on **2–3 explicitly
   pinned seeds, seed 1 among them** (the seed that bit #115), scripts tailored per
   seed, each pin commented. Generality is carried by the feasibility property
   test's seed sample, not by the scripts. Rejected: single "standard seed"
   (untested generality claim — the exact #115 failure mode); adaptive mini-policy
   over N seeds (drags E11 Policy machinery into E3).

## Docs touched

`docs/specs/E3-contracts-and-guilds.md` (status line, upkeep §, substream §,
day-boundary §, testing §, issue cut), `CONTEXT.md` (Reserve, Upkeep, Ledger),
`docs/specs/E9-fleet-and-routes.md` (routeId prose sweep, closes #116), this note.

## Follow-ups

- New issue to file: `refactor(sim)` dayBoundary + deriveSubstream (E3 milestone,
  merges first).
- AC-refresh comments on #92–#98 after the owner re-approves the spec (PR merge).
