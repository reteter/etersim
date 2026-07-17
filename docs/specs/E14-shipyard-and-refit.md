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
REFIT_MATERIAL_FACTOR = 1.0, REFIT_LABOR_FEE = 500   // tuning
SHIPYARD_RECIPE: Record<GoodId, number>, SHIPYARD_LABOR_FEE = 700   // tuning (#286 fix)
Shipyard { portId: PortId, site?: BuildOrder, refitOrder?: RefitOrder }
RefitOrder { shipId: ShipId, targetHold: number, siteStore: Record<GoodId, number> }
isUnderRefit(world, shipId): boolean   // derived lock predicate, no stored flag
computeRefitRushQuote(world): RushQuote   // computeRushQuote's Refit counterpart
computeShipyardRushQuote(world): RushQuote   // computeRushQuote's Shipyard-construction counterpart (#286 fix)
```

*Counter-erratum (2026-07-17, #286, owner-ratified post-#285-merge audit finding 1):*
the `#275 implementation` erratum immediately below (kept verbatim, struck through in
spirit not in text, for the paper trail) resolved the wrong way. It corrected the
Tech draft's self-contradiction ("flat cost + recipe" naming a recipe for something
"instant") by deleting the recipe — but the Design section above ("built via the Build
Order pattern") and CONTEXT.md's **Shipyard** entry ("built via the Build Order
pattern") were never wrong, and never in question. The building-family pattern is
unambiguous once you read past this one Tech paragraph: **HQ is the only instant
Building** (CONTEXT.md — Headquarters: "active immediately"); Storehouse (E13 spec —
"a Build Order exactly like a hull") and the Processing plant (E15 spec — "a normal
Build Order through the ConstructionSite seam") both construct. A Shipyard bought in
one click was the outlier, not the rule — the #275 erratum fixed the type to match a
one-off Tech slip instead of fixing the Tech slip to match the rule. This fix (#286)
restores the correct shape: `Shipyard` gains `site?: BuildOrder` (the `Headquarters.
buildOrder` shape, reused — recipe is the new `SHIPYARD_RECIPE` tuning constant,
`portId` is `Shipyard.portId`, nothing to duplicate). `commissionShipyard` is now the
`placeBuildOrder` analog, not the `foundHeadquarters` one: it charges `SHIPYARD_LABOR_FEE`
up front (Reserve-checked, `laborFee` Ledger kind — reused rather than a new kind, same
"why" as the ship's) and opens an empty site; `commissionRefit` additionally gates on
`!shipyard.site` (the building must have activated); a new `rushShipyard()` command is
the site's `rushBuild`/`rushRefit` analog. `runShipyardConstructionAutoDraw` draws the
site each tick, between the HQ's `runBuildSiteAutoDraw` and the Refit's
`runShipyardAutoDraw` (the two are mutually exclusive by construction — a Refit cannot
start before the Shipyard itself has built, so their relative order never actually
matters, but a fixed order keeps the tick phase list honest). Completion
(`completeShipyardIfDone`) clears `site` (activating the building) and appends
`shipyardBuilt` — which now fires at **activation**, not commission, carrying no
`thalers` (the fee was already logged by `laborFee`; unlike the pre-fix instant model
where `shipyardBuilt` fired at commission carrying the flat cost).

*Original #275 implementation erratum (superseded by the above, kept for the paper
trail):* "earlier drafted as 'flat cost + recipe', corrected once the `Shipyard` type
settled to `{ portId, refitOrder? }` with no site field" — `commissionShipyard(portId)`
was implemented instant and flat-cost, reusing `commissionBuilding` only for its
reserve-gated fee check.

`world.company.shipyard?: Shipyard` — present from the moment `commissionShipyard`
succeeds (same optional shape as `headquarters`), but the building only *activates*
once `site` clears (#286 fix). `commissionRefit(shipId)` (gates above — no Shipyard, an
un-activated `site`, or an already-active `refitOrder`; charges the labor fee up front,
Reserve-checked; auto-suspends the assignment — the recipe-bearing step,
`placeBuildOrder`'s analog); `rushRefit()` (the Refit site's rush, `rushBuild`'s analog
— not named explicitly in the original Tech draft, added here for completeness). The
Shipyard's own construction site and its Refit site's auto-draw run in the same tick
phase as the HQ's, after it in `tick()`, through the shared ConstructionSite engine.
Refit completion applies `hold = targetHold` and clears `refitOrder`. Ledger kinds:
`shipyardBuilt` (now at activation, #286 fix), `refitStart`, `refitComplete`, plus the
reused `laborFee` (the Shipyard's own construction labor fee, #286 fix). **Net worth
counts an active refit's `siteStore` exactly like the HQ build site's** (owner decision
2026-07-16, resolving the #285 review flag) **and, by the same logic, the Shipyard's
own construction site's `siteStore` too** (#286 fix, extending the pattern to the
Shipyard's own build): in-progress materials keep their book value at region-average
mid, so the company-value chart shows the same honest dip-then-growth shape for
Shipyard construction as for a Refit or a ship build.

**Scarcity (#286, E13 spec §Construction generalized):** one active Build Order per
Company, ship or building — `placeBuildOrder` (ship) now also rejects while
`shipyard.site` is active, and `commissionShipyard` rejects while
`headquarters.buildOrder` is active. E13's own generalized `BuildOrder` target-kind
union (`{kind:"ship"}|{kind:"building",...}`) is not implemented yet (E13 hasn't
shipped this slice), so this fix establishes the enforcement point directly at the two
call sites rather than waiting for that refactor — the Refit's own "one active
RefitOrder per Shipyard" rule is unaffected and stays separate (a Refit is gated on the
Shipyard already being built, so it can never coincide with the Shipyard's own site).

Refit lock (#275): `isUnderRefit` gates `sailTo`, `assignRoute`, `resumeRoute` (blocked
for the whole refit so "resume is manual after completion" holds — the route pass never
needs its own lock check as a result) and `buy`/`sell` (the locked ship's own cargo
trades). `deliver` is deliberately NOT gated — any Company ship, including the locked
target itself, may deliver into the refit site; that is one of its three fill sources.
`unassignRoute` is also not gated (a decision, not an oversight — detaching a suspended
assignment moves nothing and grants no escape from the lock).

**Deliver targeting rule, three sites deep (#286 fix, generalizing the #285/#286 audit
finding — same port can now host an HQ build, the Shipyard's own site, and a Refit
site):** `deliver(good)` fills, in priority order — (1) a same-port HQ build's
remaining need, (2) a same-port Shipyard construction site's remaining need, (3) a
same-port Refit site's remaining need. Falls through per good when an earlier site in
the chain needs none of it (rather than swallowing the delivery), same as the #285
two-site precedent; a completed recipe still resolves (`launchIfComplete`/
`completeShipyardIfDone`/`completeRefitIfDone`) even when nothing moved.

**Persistence:** `Shipyard.site?` is additive and absent-safe — SAVE_VERSION 12 → 13,
`migrateV12ToV13` is a documented identity (a v12 `Shipyard`, if present, was always
fully built under the old instant-purchase model, exactly what "no `site`" still means
at v13).

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
