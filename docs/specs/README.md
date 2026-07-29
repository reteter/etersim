# Specs — index

One row per spec:
the epic, its milestone state, and a digest of what it describes **as built today**.
Same contract as [`docs/design-notes/README.md`](../design-notes/README.md) and
[`docs/incidents/README.md`](../incidents/README.md) §Log —
the row is a pointer, not a retelling.

**The state column carries state, not history.** Which PRs shipped in which wave is `git log` and
`gh`;
a decision the spec records belongs in the spec.
A row that reproduces either goes stale on its own and turns the index into a second document (it
did — rows averaged 637 characters, the longest 3116, before the 2026-07-28 trim).

**No LIVE/HIST column.** Owner ruling (s13, sweep binding rule 5):
every spec binds.
A design note is a dated record that may age without harm;
a spec is an as-built description the spec-drift law obliges us to keep true, so a disagreement
between a shipped epic's spec and today's `CONTEXT.md` or code is a **live finding**, not
provenance.

**Maintenance is part of adding a spec** ([documentation.md](../workflows/documentation.md)):
whoever adds a file to `docs/specs/` adds its row here in the same commit, and whoever resolves a
deferral a row names updates the row in the commit that resolves it.

## Index

| Spec | Milestone state | What it describes as built today |
| --- | --- | --- |
| [E2 — Trade Loop](E2-trade-loop.md) | Shipped | The founding trade loop: buy/sell at a port, price walks the marginal curve, single Controlled Ship. No open deferrals in the spec text. |
| [E8 — Living economy](E8-living-economy.md) | Shipped | Osmosis drift between ports, ambient pulses, the region price-board overlay. Parked: fog of information (E6), full per-good chart depth. |
| [E9 — Fleet & routes](E9-fleet-and-routes.md) | Shipped | Multi-ship fleets, the Route editor (Stops, Trasy tab), auto-execution. Parked: "supplier" ship automation, full loop-path drawing on the map, remappable route-editor bindings. |
| [E9.1 — Route qty + Margin Gate](E9.1-route-qty-and-margin-gate.md) | Shipped | Per-Stop quantity caps and a margin gate on Route auto-buys, plus the forced-ordering rule for gated-buy groups (ADR-0007). Its §Open items are all routed to their own issues, not dangling here. |
| [E10 — Orrery view](E10-orrery-view.md) | Shipped | The system map: lane topology, port icons, camera. Non-goal, still parked: orbital motion, new economy mechanics. |
| [E12 — Region v2](E12-region-v2.md) | Shipped | Expanded region generation: more ports, archetype/shortage diversity, the neutral Free port. Parked: real orbital motion, information fog. |
| [E3 — Contracts & guilds](E3-contracts-and-guilds.md) | Shipped | Guild contracts, reputation/rank, upkeep. Refreshed at the 2026-07-14 spec-currency grill. Parked: crew wages, save migration (pre-1.0), guild-building *consumption* — ranks only gate it here. |
| [E13.0 — One Goods store](E13.0-goods-store.md) | Shipped | Behavior-preserving sub-epic ahead of E13: one opaque `GoodsStore` type plus a `Transfer` primitive replacing four hand-maintained store shapes (ADR-0008), guarded by a value-neutrality invariant rather than an enumeration of stores. Carries `runGoldenScenario` as a reusable scripted command sequence. |
| [E13 — Guild buildings](E13-guild-buildings.md) | Shipped. Multi-seed hardening of the no-dominance guardrail deferred to **#374**. | Building permits gated by guild rank; the Granary (agrarian Storehouse variant) with store/withdraw Route orders; E9 construction machinery generalized to buildings. UI: a Statek/Budynek commission choice in the Budowa tab, a PortPanel Storehouse section, store/withdraw chips in the Stop table. The Storehouse's net-worth value has its own `buildingStoreValue` field (OQ8, `SAVE_VERSION` 14). The typed site-registry design in §Tech is **superseded by [ADR-0008](../adr/0008-one-goods-store.md)**. |
| [E14 — Shipyard & Refit](E14-shipyard-and-refit.md) | Shipped | Company-owned Shipyard building: ship commissioning as a construction site, Refit orders that change a ship's Hold. Its three-step `deliver` chain carries an in-place **superseded** marker: E13/ADR-0008 made targets explicit `StoreRef`s and added `guildBuild` as a fourth site. |
| [E16 — Workbench](E16-workbench.md) | **In progress** (M4). Fan-out remaining: **#393** (Trasy → read-only roster), its gate satisfied. | The Price Board becomes the game's workbench: Routes authored on it **port-centric**, Ships dispatched from it, one **market-quality signal** rendered across board / PortPanel shading / offer labels, the Trasy tab demoted to a read-only Route-ribbon roster with an edit-in-board seam, plus contextual focus, column pinning and sell-all legibility. Market-free kinds (`deliver`/`store`/`withdraw`) are authored through the "więcej" drawer; cells carrying one are inert to the plain click. **UI + store only — no `src/sim`**, so file-disjoint from E11/E15. Route semantics stay frozen at E9/E9.1 (ADR-0007) — surface, not new automation. |
| [E15 — Processing](E15-processing.md) | **Open** (M3), not started; sequenced after E13 → E11. | Company-owned processing plants converting delivered inputs into processed goods (provisions, clearwood). Builds on E13.0's `GoodsStore`/`StorePolicy`; plant stores fold into the same `buildingStoreValue` field. Chain 3 (superconductor) deferred to the events+ice epic. Deliver targets are addressed explicitly (§Addressing — the priority chain is deleted, not extended), and the `SAVE_VERSION` bump is stated relative to as-built rather than as a fixed number. |
| [E11 — Proving grounds](E11-proving-grounds.md) | **v1 code-complete** (M2 tooling) — all three v1 slices shipped (#232, #233, #234); milestone close still gated on the general owner playtest, #440 (owner decision 2026-07-28). Plus #446/#449/#450: top-level `harness/` (own tsconfig project, run with `tsx`, outside the Vite bundle), the `Policy<M>` contract with `doNothing`/`gradientLoop` reference policies, the `advanceDays` seam in `src/sim/scenario.ts` (the E3 guardrail suites run on it), the Batch runner (`harness/batch.ts`), per-Run metrics derived purely from the Ledger + daily fleet snapshots (`harness/metrics.ts`) — now including **world-days to milestone** (#446, per-Run + batch median/spread, explicitly not wall-clock hours — see §Evaluation model), head-to-head policy comparison generalizing the #60 dominance guardrail (`harness/compare.ts`), and the `harness run` CLI writing per-Run JSONL Ledgers + a JSON/Markdown Batch report (`harness/cli.ts`, `harness/report.ts`). The thaler reconciliation (`reconcileThalers`, `harness/metrics.ts`) now covers all ten `THALER_MOVEMENT_KINDS` — a synthetic fixture plus a per-kind sign-flip test (#449) close the gap where only 3 of 10 kinds were guarded against a real Run; `harness/batch.ts`'s doc comment states which three a real reference-policy Run actually exercises. §Ledger schema corrected (#450): `thalers` is a positive magnitude, not a signed total — direction lives in `signedThalers` (`harness/metrics.ts`), the reference implementation. **#234 shipped for real this wave**: `harness/invariants.ts`'s runtime checks (desperation clause, offer cap, offer-ID uniqueness, tier/requiredRank range, and haulability against `e3-guardrails.test.ts`'s feasibility property) run at every day boundary when a Run is started with `harness run --enable-assertions` (`runCommand.ts` → `runPolicyBatch` → `runOne` → `runBatchRun`'s `options.enableAssertions`, default off); violations dedupe by reason across the whole Run (`dedupeViolationsByDay`) and populate `report.json`'s `anomalies`, verified end to end by a deliberately-broken-World fixture through the real `runOne` → `buildReport` path (`harness/batch.test.ts`), not just `checkInvariants` in isolation. `docs/experiments/` now has its first two dated entries (W1 price variance, W5 saturation census) plus a bug-hunt worked example (`harness/policies/greedyContractor.ts`, zero anomalies found at seeds 1/2/3/7/42 over 100 days as of 2026-07-29). Outstanding (v2-scoped, does not block v1 close): **#448** (session recording + deterministic replay, the wall-clock-hours half of the PRD's pacing anchor that world-days alone cannot answer). | Headless evaluation harness: policy contract, `advanceDays` seam, Batch runner + `harness run` CLI, metrics/reports. v1 scope is Batch core + CLI; `harness play`/`replay` and an MCP adapter are v2-deferred in the spec itself. §Ledger schema binds the shipped `src/sim/ledger.ts` union — the harness serialises it, it does not define its own shape; `thalers` is a positive magnitude, direction implied by `kind`/`side`. |
| [TEMPLATE.md](TEMPLATE.md) | — (not a spec) | The feature-spec template. Copy it when starting a new epic spec; don't read it for content. |

## Method note

Built by reading each spec's header/status line plus a grep for deferral markers (`defer`, `parked`,
`Open`, `TBD`) against its own text —
not a line-by-line audit.
A contradiction found while indexing gets recorded and routed, never folded silently into an index
update.
