# Trade-loop follow-ups — design-session inputs

Parking lot for owner feedback gathered while playtesting E2 (PR #29, issue #16).
High-level decisions locked (2026-07-07). Spec notes added to
[E2-trade-loop.md](../specs/E2-trade-loop.md); GitHub issues filed (#25, #28, #32–#37).
Implementation tracked per issue — none of the follow-ups below are shipped yet (see spec
**Implementation status** table).

Terms per [CONTEXT.md](../../CONTEXT.md); process per [WORKFLOW.md](../WORKFLOW.md).

---

## 1. Port click priority on the map
**Tracked in [#28](https://github.com/reteter/etersim/issues/28)** (retitled "Map click
interaction: port-click priority"). 

**Grilled (2026-07-06)**: Port always receives the click first. 

Introduced:
- **Harbor** (see CONTEXT.md): when a Port is selected, a Harbor section (list of docked Ships) is always shown above the market. Player's ships are separated from others; hover shows summary (Hold + Cargo).
- **Controlled Ship** (see CONTEXT.md): the designated Ship that receives player Commands (`sailTo` etc.). A small always-visible header will show it. Opening ShipPanel designates it.
- Direct sail affordance lives in the remote port view (not as extra map gesture for now): "Sail [Controlled Ship name] here (~N)" button.
- Docked player Ships are reached via the Harbor list (map clicks on docked ships do not win over port).

**Grill follow-up status (2026-07-07):**
- [#28](https://github.com/reteter/etersim/issues/28) + [#32](https://github.com/reteter/etersim/issues/32) + [#33](https://github.com/reteter/etersim/issues/33) — Map/Controlled Ship/Sail follow-ups: **locked**.
- [#35](https://github.com/reteter/etersim/issues/35) — Better buy/sell UI: **locked** (high-level). 
- [#36](https://github.com/reteter/etersim/issues/36) — Auto-pause on arrival: **locked** (high-level).
- [#37](https://github.com/reteter/etersim/issues/37) — Options/settings view: **locked** (high-level). Reconciled with #17.
- Additional E2: [#34](https://github.com/reteter/etersim/issues/34) (UI icons), #25 + #2 + #3: **locked** (A + mapping + connectPorts). 

**#25 + #2 + #3** — decyzja A potwierdzona, high-level kierunki zablokowane. Reszta jako follow-upy.

See #28 for full context and the grill log. All E2 follow-up items locked high-level (incl. #25 A + #2/#3). Spec notes added for 3–5 + #25.

## 25. Worldgen: geometry-aware lane topology
**Locked (2026-07-07, #25):**
- **A** (map as space): topology geometry-aware. `connectPorts` favors short connections (distance-biased, reduced crossings). Positions matter for readability.
- #2: Voyage ticks mapping more proportional to distance (smaller floor, better triangle inequality).
- #3: Geometry-aware `connectPorts` (distance-biased selection).

Follow-ups (implementation, tracked in #25):
- Determinism tests for new topology.
- Placement review (if needed for better geometry support).
- Playtest verification / map readability check.
- (ADR not needed — recorded in #25 + follow-ups + spec.)
- Spec decision text synced ✓ (E2 worldgen section).

## 2. Marginal pricing — make it legible (not a change, a clarification)
How trading already works today (`src/sim/market.ts`): buying/selling is **marginal, per
unit**. Selling 50 walks the price *down* one unit at a time (total = Σ price at stock+1,
stock+2, … stock+50), not 50 × the starting price; buying walks it *up* symmetrically.
This is intended (spec — "dumping a full hold into a small market is self-limiting").
No mechanic change wanted — but the UI should make it obvious. Feeds directly into item 3.

## 3. Better buy/sell UI
Owner asks for:
- **Buy max / Sell max** buttons. Candidates for "max":
  - Buy max = `min(stock available, hold space left, thalers ÷ marginal cost)`.
  - Sell max = cargo of that good held.
- **Unit price always visible** somewhere (the marginal price of the next unit), alongside
  the existing lot-total quote on the Buy/Sell buttons — so item 2's behaviour is legible.
- **Clamp the qty input** to the max tradable amount (no typing an arbitrary number that the
  command will just reject).

**Locked high-level (2026-07-07):**
- Max buttons implemented per the formulas above.
- Next-unit marginal price always surfaced (makes marginal pricing legible).
- Qty input clamped live to current max tradable.
- Max values and unit price recompute live with market changes.
- Compact layout inside existing market-row (no bloat to 320px panel).

Spec note added to E2-trade-loop.md. GitHub issue: [#35](https://github.com/reteter/etersim/issues/35).

## 4. Auto-pause on arrival
Owner: when the ship **docks at its destination**, auto-pause the game so time doesn't keep
running (e.g. at 100×) while the player is away and prices run off. Default **On**,
overridable in options (item 5).

**Locked high-level (2026-07-07):**
- Trigger only on final destination arrival (not intermediate ports).
- Default **On**; no-op if already paused.
- Toggle in options/settings (item 5); persists via localStorage tied to save/load.
- Lives in store/game loop layer only (no sim changes).

Spec note added. GitHub issue: [#36](https://github.com/reteter/etersim/issues/36). Default-On behaviour can ship before full options UI.

## 5. Options / settings view
A place for user settings — first tenant is the item 4 auto-pause toggle. **Overlaps
[#17](https://github.com/reteter/etersim/issues/17)** (start screen + menu with export/import).

**Locked high-level (2026-07-07):**
- Reconciled with #17: options extend the existing menu structure (no separate/duplicate menu).
- Settings and save/load (export/import) live together in one place.
- Persistence: separate localStorage key for settings (simple and independent of game saves; can fold later).

Spec note added. GitHub issue: [#37](https://github.com/reteter/etersim/issues/37). Reconciled
with #17 at design level (options extend existing menu; save/load + settings together).

---

### Orchestrator notes (post-lock)
All high-level decisions locked. Spec/docs synced (2026-07-07); implementation open.
- **#28 + #32** first — Controlled Ship store field + header + Harbor unblock #33, #36.
- **#25** sim-only — geometry-aware `connectPorts`; independent of UI follow-ups.
- **#35, #36, #37** can proceed in parallel once #28 store model exists (#36 default-On can
  ship before #37 settings UI).
- E2E (`e2e/ui.spec.ts`) covers baseline #15 UX; update when #28 ships. E2E not yet in CI.
