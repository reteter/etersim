# Grill record — OQ8: Storehouse/Plant value in netWorth, 2026-07-21

Owner-led, run in parallel with the #307 coder dispatch. Closes the one open decision the
E13 grill (`goods-store-grill-2026-07-19.md`) had left for later: does a building's standing
goods store (Storehouse in E13, Plant in E15) join the existing `siteStoreValue`
`NetWorthBreakdown` field, or get its own?

Outputs: this note; `docs/specs/E13-guild-buildings.md` §Ledger & netWorth (OQ8 line
resolved); `docs/specs/E13.0-goods-store.md` §Open questions (OQ8 line resolved);
`docs/specs/E15-processing.md` §Ledger (netWorth note extended); `docs/HANDOFF.md` queue
item 3 (owner call pending — see Process observations).

## The question and the four decisions

**1. New field, not a join.** `computeNetWorth`'s `siteStoreValue`
(`ledger.ts:193-199, 210-219`) sums only construction-site WIP — HQ build site, Shipyard's own
site, active refit — and its docstring frames this as part of an explicit design law: *"a
build is a visible dip, then steeper growth"*, i.e. the field is meant to trend toward zero as
a build completes and its materials convert into a ship/building that carries no book value.
A Storehouse's contents never convert into anything and never go to zero — they're a durable,
standing inventory, semantically closer to `cargoValue` (a ship's liquid goods) than to WIP
being consumed by an active build. Joining it into `siteStoreValue` would break the "dip, then
growth" narrative the field exists to tell: a growing warehouse would hold the field
permanently positive, misrepresenting how much capital is actually tied up in construction.
Decided: separate field.

**2. Generic name, not `storehouseValue`.** `docs/specs/E15-processing.md:197` already commits
E15's Plant to the identical pattern — *"netWorth adds plant stores at mid (buildings
themselves keep no book value)"* — so this is not a one-building special case but a recurring
shape: any completed building with a standing `GoodsStore` needs its value counted the same
way. Naming the field after the first building to use it (`storehouseValue`) would force E15
into a second netWorth-shape change and a second version bump for the same concept. Decided:
`buildingStoreValue`, walked over every building-kind `StoreRef` in `companyStores`
(ADR-0008) — Storehouse now, Plant later, no shape change at E15.

**3. Version bump, backfill zero.** `SAVE_VERSION` is 13 (`persistence.ts:76`); the existing
`migrateVxToVy` precedent backfills fields with values that are *facts*, not guesses, about
older saves (`migrateV8ToV9`'s `thalers`, `migrateV9ToV10`'s `requiredRank`). A save from
before the Storehouse existed genuinely had zero building-store value — not an approximation.
Decided: `SAVE_VERSION = 14`, `migrateV13ToV14` backfills `buildingStoreValue: 0` on every
persisted `netWorth` ledger event; `total` on those events is unchanged by the backfill. This
is also the version `E15-processing.md:202` already earmarked as "next free after E13's bump"
for its own reasons (new market rows) — no conflict, E13's #100 consumes v14, E15 consumes
v15 later.

**4. Record scope.** This note plus the three spec citations of OQ8, sized to match the
decision (four short calls, not a reopened architecture) — not a CONTEXT.md entry, since
`siteStoreValue`/`cargoValue` were never individually glossaried either (checked: CONTEXT.md
mentions netWorth only in passing, `CONTEXT.md:886, 1019`); this is an implementation-shape
decision, not new domain vocabulary.

## Confirmed, not asked (found while grilling, not itself a decision point)

`LedgerOverlay.tsx`'s company-value chart (`ValueTab`, `LedgerOverlay.tsx:232-254`) plots only
`total`, never the breakdown fields — so adding `buildingStoreValue` costs no UI work beyond
folding it into the sum at `computeNetWorth`'s return. Checked before asking a question about
it, per the grilling skill's "explore the codebase instead" instruction.

## Process observations

- Run as a genuinely parallel grill while a coder worked #307 in an isolated worktree —
  first time this repo has run a grill and a coder wave concurrently rather than
  sequentially. No friction: the grill touches only docs, the coder touches only
  `src/sim`/`src/ui`/`src/store` on its own branch.
- `docs/HANDOFF.md`'s queue item 3 update is deliberately **not** included in this note's
  commit — HANDOFF is ceremony-gated ("updated only on owner request", 2026-07-16), and
  resolving OQ8 is not itself that request. Flagged back to the owner separately.
