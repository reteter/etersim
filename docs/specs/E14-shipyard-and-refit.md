# E14 — Shipyard & Refit

Feature spec for epic E14 (post-M3 pull-forward — owner call 2026-07-16, see Sequencing
note). Terms per [CONTEXT.md](../../CONTEXT.md). Grilled and decided with the owner on
2026-07-16.
Status: **approved (2026-07-16** — owner merge of PR #271; issues cut into milestone
"E14 — Shipyard & Refit"**)**.

Grill inputs: owner request 2026-07-16 (ship upgrade — cargo Hold size — via a new
Building unlocked after the Headquarters); [#99](https://github.com/reteter/etersim/issues/99)
(commissionBuilding generalization, adopted as this epic's first issue);
E9 Build Order machinery (`src/sim/building.ts`) as the reused construction pattern.

Scope in one line: a **Shipyard** — one Company Building per Company, built after the
Headquarters via the Build Order pattern — where a docked ship can undergo a **Refit**:
a mini Build Order that raises its Hold along a fixed multiplier ladder from the ship's
`baseHold`. Explicit non-goals: **other refit kinds** (speed, docking-fee modifiers —
future ship-type work, the ladder's `baseHold` foundation deliberately anticipates them);
**refit cancellation** (v1 has none — save-compatible extension); **multiple concurrent
refits** (one active RefitOrder per Shipyard, v1); **new ship types** (only `baseHold`
lands now); **Building permits / rank gating** (E13's mechanic — the Shipyard is not a
guild Building).

## Design

### Core: why a Shipyard

CONTEXT.md's standing principle — **buildings introduce mechanics** — means Hold growth
arrives as a place, not a button. The Shipyard is the Company's second Building (after
the Headquarters), placed once at a port of the player's choice, and it introduces the
Refit: the first way to change a ship after launch. "Sail your ship to the yard, feed
the site, wait" reuses the construction grammar the player already knows from ship
building, and adds a logistics decision (where to put the yard, when to take a ship off
its route).

### The Hold ladder

- Every ship has a **`baseHold`** — the Hold it launched with, characteristic of its
  (future) type. All current ships: 50.
- Refit thresholds are **multipliers over `baseHold`**, cumulative: ×2 → ×1.5 → ×1.25.
  Each threshold is computed **once from `baseHold`** and rounded to the nearest
  integer — never iterated from prior rounded values. For `baseHold` 50:
  **50 → 100 → 150 → 188**. Three refit levels, then a hard cap.
  *Erratum (2026-07-16, #274 wave review):* for THIS multiplier set the two rounding
  schemes are mathematically indistinguishable for any integer `baseHold` (rungs 1–2
  are exact integers), so no test can discriminate them — round-once stays as the
  spec'd convention, enforceable only if the multipliers ever change.
- The ladder multipliers are **tuning constants** (tuning ≠ spec drift); the *shape*
  (fixed multiplier ladder from `baseHold`, hard cap at the end) is spec.
- A ship's refit level is **derived** from `hold` vs its ladder — no stored level field.

### Refit — a mini Build Order

- Requirements to start: the Company has a Shipyard; the target ship is **docked at the
  Shipyard port**; no RefitOrder is active (one at a time per Shipyard, v1); the ship is
  not at the ladder cap.
- Starting a Refit **auto-suspends** the ship's Route assignment (the existing manual
  `sailTo` semantics — known escape-hatch grammar); resume is manual after completion.
- The ship is **locked in port** for the duration: no `sailTo`, no route assignment, no
  trading commands against its cargo. **Cargo stays aboard** (the Hold only grows).
- Materials: a **Refit Recipe** scaled from `SHIP_RECIPE` by the Hold gained relative to
  `baseHold` (formula in Tech), plus a per-level **labor fee** — all tuning constants.
  The site fills from the same three sources as ship construction: **auto-draw**
  (rate-capped market buys at the Shipyard port, stalls at the Reserve), **deliver**
  (any Company ship, including a Route's deliver Stop), and **rush**. The Reserve
  (#122) binds every spend.
- Completion is instant when the recipe fills: `hold` jumps to the next threshold, the
  lock lifts. **No cancellation in v1** — materials in the site are built in.

### UI surfaces (owner decisions, grill Q7)

- Shipyard controls live in a **PortPanel section** at the Shipyard port, following the
  Storehouse-section pattern: commission the building (when absent), start a Refit
  (pick a docked ship, see target Hold + estimate), site progress + stall reason +
  rush quote when a Refit is active.
- A ship under Refit shows on the **map as a bubble with a small progress bar**;
  details (target Hold, per-good remaining) in its tooltip.
- Fleet/ship status gains a "w przebudowie" state (one color = one meaning, ADR-0006 —
  a new status color, no overloading).
- Player-facing strings in Polish (Stocznia, przebudowa).

## Tech

> Engineer pass drafted inline by the session driver (LCM, 2026-07-16) against the
> locked grill decisions. Nothing here is settled until the spec is approved.

### #99 first: the construction-site seam

The Build Order machinery in `src/sim/building.ts` (siteStore, `remainingNeed`,
`isRecipeComplete`, `applyDeliveryToSite`, auto-draw walk, rush quote/execute) is
Headquarters-shaped: it reads `world.company.headquarters.buildOrder` directly. Issue 1
extracts a **`ConstructionSite`** seam — `{ recipe, siteStore, portId }` plus pure
helpers parameterized on the site instead of the HQ — so ship construction and Refit
are two callers of one engine. `commissionBuilding` from #99 lands here as the generic
"place a construction" command shape. No behavior change; existing tests must stay
green unmodified (the E9.1 byte-identity discipline).

### `src/sim/ship.ts`

- `Ship.baseHold: number` — required. SAVE_VERSION 11 → 12; `migrateV11ToV12` backfills
  `baseHold: 50` (every existing ship launched at 50 — lossless by construction).
- `launchIfComplete` sets `baseHold: 50` explicitly (today's constant becomes the
  starting rung of the ladder).
- Refit lock: a ship is locked iff it is the target of the active RefitOrder — derived,
  no stored flag (`isUnderRefit(world, shipId)` predicate; `commands.ts` gates `sailTo`,
  route assignment, and cargo commands on it).

### `src/sim/shipyard.ts` (new)

```
HOLD_LADDER: readonly number[] = [2, 1.5, 1.25]   // tuning
holdLadder(baseHold): number[]      // cumulative, rounded once from base: [100, 150, 188] for 50
nextHoldStep(ship): number | null   // null at cap
refitRecipe(ship): Record<GoodId, number>   // ceil(SHIP_RECIPE[g] × holdGained / baseHold × REFIT_MATERIAL_FACTOR)
REFIT_MATERIAL_FACTOR = 1.0, REFIT_LABOR_FEE = 500, SHIPYARD_COST = 3000   // tuning
Shipyard { portId: PortId, refitOrder?: RefitOrder }
RefitOrder { shipId: ShipId, targetHold: number, siteStore: Record<GoodId, number> }
isUnderRefit(world, shipId): boolean   // derived lock predicate, no stored flag
computeRefitRushQuote(world): RushQuote   // computeRushQuote's Refit counterpart
```

`world.company.shipyard?: Shipyard` — absent until commissioned (same optional shape as
`headquarters`). Commands: `commissionShipyard(portId)` (requires Headquarters, no
existing Shipyard; instant and flat-cost, Reserve-checked — the `foundHeadquarters`
analog, reusing `commissionBuilding` only for its reserve-gated fee check, since
`Shipyard` carries no `siteStore` of its own — *erratum, #275 implementation: earlier
drafted as "flat cost + recipe", corrected once the `Shipyard` type settled to
`{ portId, refitOrder? }` with no site field*); `commissionRefit(shipId)` (gates above;
charges the labor fee up front, Reserve-checked; auto-suspends the assignment — the
recipe-bearing step, `placeBuildOrder`'s analog); `rushRefit()` (the Refit site's rush,
`rushBuild`'s analog — not named explicitly in the original Tech draft, added here for
completeness). The Shipyard site's auto-draw runs in the same tick phase as the HQ's,
after it in `tick()`, through the shared ConstructionSite engine. Completion applies
`hold = targetHold` and clears `refitOrder`. Ledger kinds: `shipyardBuilt`,
`refitStart`, `refitComplete`.

Refit lock (#275): `isUnderRefit` gates `sailTo`, `assignRoute`, `resumeRoute` (blocked
for the whole refit so "resume is manual after completion" holds — the route pass never
needs its own lock check as a result) and `buy`/`sell` (the locked ship's own cargo
trades). `deliver` is deliberately NOT gated — any Company ship, including the locked
target itself, may deliver into the refit site; that is one of its three fill sources.
`unassignRoute` is also not gated (a decision, not an oversight — detaching a suspended
assignment moves nothing and grants no escape from the lock).

### UI

- `PortPanel.tsx`: Shipyard section (commission button / refit picker + estimate /
  active-site progress, stall reason, rush) — mirror the Storehouse section's structure
  and the Budowa tab's site widgets.
- Map (`RegionMap`): refit bubble with progress bar on the docked ship's port; tooltip
  with target Hold + per-good remaining. Progress = filled/required over the recipe.
- `FleetList.tsx` / `ShipPanel.tsx`: "w przebudowie" status.

### Docs sync

- **CONTEXT.md** (entries land with this spec's PR, glossary-first): **Shipyard**
  (PL: stocznia), **Refit** (PL: przebudowa), **baseHold** folded into the Ship/Hold
  entries; amend the **Building** entry ("E9 has exactly one type" → Headquarters +
  Shipyard). PL UI strings recorded there.
- **PRD**: E14 blurb in the epic roadmap (post-M3 pull-forward, owner call 2026-07-16).
- No new ADR: the Refit introduces no equivalence/determinism exception — it is ordinary
  Commands plus the existing construction pattern. (#99's seam is design-internal.)
- E13 spec: pointer note that #99 moved to E14 as its first issue.

## Testing

- Sim (TDD): ladder math (rounded-once thresholds, cap ⇒ `nextHoldStep` null);
  commission gates (no HQ ⇒ reject, second Shipyard ⇒ reject); refit gates (not docked
  at yard / at cap / already active ⇒ reject); auto-suspend on start; lock enforcement
  (`sailTo`/assign/trade rejected mid-refit); cargo untouched across completion;
  completion sets the exact threshold Hold; Reserve respected by fee/auto-draw/rush;
  determinism (same seed ⇒ deep-equal with an active refit); SAVE_VERSION 12 migration
  backfills `baseHold` losslessly; save/load mid-refit identity through `persistence.ts`
  (the E9.1 lesson — envelope layer, not `JSON.stringify`).
- #99 refactor: existing `building.ts`/HQ tests green **unmodified**.
- E2E (Playwright): commission flow at a port; refit start → progress visible in
  PortPanel; map bubble renders with progress; "w przebudowie" in FleetList; locked
  ship's sail action disabled.
- Manual playtest: does hauling refit materials feel like a plan or a chore (watch for
  route-deliver synergy); ladder pacing vs upkeep pressure.

## Issue cut

Filed 2026-07-16; milestone **E14 — Shipyard & Refit**.

| Issue | Track | Scope | Depends on |
| --- | --- | --- | --- |
| #99 | sim | `refactor(sim)`: ConstructionSite seam + `commissionBuilding` generalization, zero behavior change — **shipped** (PR #278) | — |
| #274 | sim | `feat(sim)`: `baseHold` + SAVE_VERSION 12 + hold ladder (`shipyard.ts` pure parts) — **shipped** (PR #279) | #99 |
| #275 | sim | `feat(sim)`: Shipyard building + RefitOrder lifecycle (commands, lock, auto-draw phase, ledger) | #274 |
| #276 | ui | `feat(ui)`: PortPanel Shipyard section + map refit bubble + "w przebudowie" status + E2E | #275 |

Sequencing note: E14 is pulled ahead of E13's remaining work (owner call 2026-07-16):
#99 was cut for E13 but is file-disjoint from E13's permit/storehouse scope and unblocks
both epics; the Shipyard needs no E13 mechanic (deliberately not rank-gated).
