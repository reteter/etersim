# Specs — index

One row per spec: the epic, its milestone state, and a digest of what it describes **as
built today** — written so a reader can absorb it without opening the file. Same contract
as [`docs/design-notes/README.md`](../design-notes/README.md) and
[`docs/incidents/README.md`](../incidents/README.md) §Log.

**No LIVE/HIST column.** Owner ruling (s13, sweep binding rule 5): every spec binds — there
is no HIST analogue here. A design note is a dated record that may age without harm; a spec
is an as-built description the spec-drift rule (`CLAUDE.md`) obliges us to keep true. A
disagreement between a shipped epic's spec and today's `CONTEXT.md` or code is a live
finding, not provenance. The useful axis is therefore *what this spec describes right now*,
not whether it's closed.

**Maintenance is part of adding a spec** (`docs/WORKFLOW.md` §Documentation law): whoever
adds a file to `docs/specs/` adds its row here in the same commit. Whoever resolves a
deferral or open item a row names updates the row in the same commit that resolves it — a
row that still calls something "open" after the code moved on is exactly the F6 defect this
index exists to catch (see the E8 row: found and fixed live while writing this index,
2026-07-21).

## Index

| Spec | Milestone state | What it describes as built today |
| --- | --- | --- |
| [E2 — Trade Loop](E2-trade-loop.md) | Shipped (milestone closed) | The founding trade loop: buy/sell at a port, price walks the marginal curve, single Controlled Ship. No known open deferrals in the spec text. |
| [E8 — Living economy](E8-living-economy.md) | Shipped (milestone closed) | Osmosis drift between ports, ambient pulses, the region price board overlay (TopBar button + hotkey). Parked: fog of information (E6), ship upkeep (moved to E3), full per-good chart depth. Fixed live while indexing: line 169's hotkey-configurability note still read as open against #56, though line 251 of the same file already reconciles it as landed 2026-07-13 — corrected 2026-07-21. |
| [E9 — Fleet & routes](E9-fleet-and-routes.md) | Shipped (milestone closed) | Multi-ship fleets, Route editor (Stops, Trasy tab), auto-execution. Parked: ship upkeep (spec'd later in E3), "supplier" ship automation, full loop-path drawing on the map, remappable route-editor bindings. |
| [E10 — Orrery view](E10-orrery-view.md) | Shipped (milestone closed) | The system map / orrery: lane topology, port icons, camera. Non-goal, still parked: orbital motion (E5 candidate), new economy mechanics. |
| [E12 — Region v2](E12-region-v2.md) | Shipped (milestone closed) | Expanded region generation: more ports, archetype/shortage diversity, neutral (Free) port. Parked: real orbital motion (E5), information fog (E6). |
| [E3 — Contracts & guilds](E3-contracts-and-guilds.md) | Shipped (milestone closed) | Guild contracts, reputation/rank, upkeep. Refreshed at the 2026-07-14 spec-currency grill (Professor findings B/C folded in, upkeep insolvency gap resolved). Parked: crew wages, save migration (pre-1.0), guild-building *consumption* (ranks only gate it here — the buildings themselves are E13). |
| [E13 — Guild buildings](E13-guild-buildings.md) | Sim shipped 2026-07-21 (#100/#372, on `main`); **#101 (UI) as-built below, on branch `feat/101-storehouse-ui`, pending merge** — its merge closes the milestone (#102, the guardrail, already closed, folded into #100's test suite) | Building permits gated by guild rank; the Granary (agrarian Storehouse variant) with store/withdraw Route orders; E9 construction machinery generalized to buildings. UI as-built (pending merge): Headquarters panel's Budowa tab grows a Statek/Budynek commission choice (the guild Building side gated on `hasStorehousePermit`, its port dropdown limited to `isLegalStorehousePlacement`), sharing the ship side's own progress/stall/rush widgets; PortPanel gains a Storehouse section (fill/capacity + manual store/withdraw for a docked ship); the route editor's Stop table grows store/withdraw chips, shown only for a Stop at a port with a Company storehouse. OQ8 is **resolved** (2026-07-21) and written into this spec's §Ledger: the Storehouse's netWorth value gets its own `buildingStoreValue` `NetWorthBreakdown` field, `SAVE_VERSION` bumps to 14 backfilling zero ([grill record](../design-notes/oq8-buildingStoreValue-grill-2026-07-21.md)) — the decision is in the spec and shipped into #100's code 2026-07-21 (#372). The typed site-registry design in this file's §Tech is superseded by [ADR-0008](../adr/0008-one-goods-store.md) — see the file's own "§The site registry — superseded" section. |
| [E13.0 — One Goods store](E13.0-goods-store.md) | Shipped (milestone #13 closed 2026-07-21) | Behavior-preserving sub-epic ahead of E13: one opaque `GoodsStore` type + a `Transfer` primitive replaced the four hand-maintained store shapes (ADR-0008), guarded by a value-neutrality invariant rather than an enumeration. #306 merged first as the behavior-preservation cover (golden-run digest + phase-order snapshot); #307 migrated the four stores, extracted `resolveDeliveryTarget`, walked `computeNetWorth` over `companyStores`, and rewrote the ~127 access sites. As-built addendum (spec §Issue cut): #307 also added `src/sim/e13-0-golden-scenario.ts` — `runGoldenScenario` pulled out of #306's digest test as a plain module so `persistence.test.ts`'s C2 round-trip reuses the same scripted command sequence. |
| [E14 — Shipyard & Refit](E14-shipyard-and-refit.md) | Shipped (milestone closed) | Company-owned Shipyard building: ship commissioning as a construction site, Refit orders that change a ship's Hold. No open deferrals found in the spec text. |
| [E9.1 — Route qty + Margin Gate](E9.1-route-qty-and-margin-gate.md) | Shipped (milestone closed) | Per-Stop quantity caps and a margin gate on Route auto-buys, plus the forced-ordering rule for gated-buy groups (ADR-0007). §Open items lists three items explicitly **already routed** to their own issues/epics (per-order qty extension, indefinite-wait "route rot" UX escalation) — routed, not still open here. |
| [E15 — Processing](E15-processing.md) | **Open** (milestone #12) — not yet started; hard-sequenced after E13 → E11 | Company-owned processing plants converting delivered inputs into processed goods (provisions, clearwood). Depends on E13.0's `GoodsStore`/`StorePolicy` (plant input/output stores) and on OQ8's resolution (plant stores fold into the same `buildingStoreValue` field, no second version bump — see this file's §Ledger). Chain 3 (superconductor) explicitly deferred to the events+ice epic. |
| [E11 — Proving grounds](E11-proving-grounds.md) | **Open** (milestone #9) — v1 not yet started | Headless evaluation harness: policy contract, `advanceDays` seam, Batch runner + `harness run` CLI, metrics/reports. v1 scope is explicitly Batch core + the CLI; `harness play`/`replay` and an MCP adapter are named **v2-deferred / parked** in the spec text itself, not dangling prose. |
| [TEMPLATE.md](TEMPLATE.md) | — (not a spec) | The feature-spec template, codified 2026-07-07 from E10's structure. Copy it when starting a new epic spec; don't read it for content. |

## Method note

Built by reading each spec's header/status line plus a grep for deferral markers
(`defer`, `parked`, `Open`, `TBD`) against its own text — not a full line-by-line audit
(#309's own non-goal: this index is read-only-plus-routing, like the sweep). The one
contradiction found (E8's hotkey line) was small enough to fix in the same commit rather
than routing it; a future finding of that shape should be recorded and routed the same way
the design-surface sweep did, not folded silently into an index update.
