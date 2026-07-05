# Trade-loop follow-ups — design-session inputs

Parking lot for owner feedback gathered while playtesting E2 (PR #29, issue #16).
**Not yet grilled or spec'd** — this is the agenda for a dedicated Designer session.
Each item, once decided, becomes either a spec update to
[E2-trade-loop.md](../specs/E2-trade-loop.md) + a GitHub issue, or a new epic.

Terms per [CONTEXT.md](../../CONTEXT.md); process per [WORKFLOW.md](../WORKFLOW.md).

---

## 1. Port click priority on the map
**Tracked in [#28](https://github.com/reteter/etersim/issues/28)** (retitled "Map click
interaction: port-click priority"). Owner's call: clicking a port node should open the
**port panel directly**, even when the ship is docked there (today the ⛵ is drawn on top
and wins the click; the "Open market" button in `ShipPanel` is an interim stopgap).
Open question: how the ship is then selected/reached. See #28 for the full note.

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

Design questions: which "unit price" to surface (next-unit marginal vs. average-per-unit of
the current lot)? Does "max" recompute live as prices drift? Layout in the 320px panel.
Likely: spec drift on E2 "UI layout" + a `type:feat area:ui` issue extending `PortPanel`.

## 4. Auto-pause on arrival
Owner: when the ship **docks at its destination**, auto-pause the game so time doesn't keep
running (e.g. at 100×) while the player is away and prices run off. Default **On**,
overridable in options (item 5).

Design questions: pause only on destination arrival (not on passing intermediate ports —
those don't dock anyway)? No-op if already paused. Where the setting lives and how it
persists (localStorage; ties to #17 save/load and item 5). This likely touches the store /
game loop, not `src/sim` (determinism: a pause is a speed change, already in the store).

## 5. Options / settings view
A place for user settings — first tenant is the item 4 auto-pause toggle. **Overlaps
[#17](https://github.com/reteter/etersim/issues/17)** (start screen + menu with export/import).
Decide in session: is "options" a modal, a distinct screen, or part of the #17 menu? Should
save/load (export/import JSON) and settings live together? Persistence shape for settings
(separate localStorage key vs. folded into the save).

---

### Orchestrator notes (dependencies)
- 3 is independent and closest to issue-ready (pure `PortPanel` extension).
- 4 depends on 5 for its toggle; 4's default-On behaviour can ship before the options UI.
- 5 should be reconciled with #17 before either is issued (avoid two menus).
- 1 (#28) is orthogonal to the rest.
