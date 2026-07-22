# E16 — Workbench

Feature spec for epic E16 (milestone M4 — Region mastery, [PRD](../PRD.md)). Terms per
[CONTEXT.md](../../CONTEXT.md). Grilled and decided with the owner on 2026-07-22.
Status: **approved (2026-07-22)**.

Grill inputs: #376 (fuse route planning into the Price Board — the parent ask),
[grill-brief-m4-workbench.md](../design-notes/grill-brief-m4-workbench.md) (the questions this
grill had to resolve + the locked rails), [playtest-2026-07-14-routes-fleet-ux.md](../design-notes/playtest-2026-07-14-routes-fleet-ux.md)
§Grill cluster B (the three symptoms this epic answers) and its cluster-A resolution
[route-automation-grill-2026-07-21.md](../design-notes/route-automation-grill-2026-07-21.md) (what
stays **locked out**), #227 (offer labels), #177 (ShipPanel route status), #173 (skiff easing —
stays map-side), and Professor ui-store review
[Finding 4](../design-notes/professor-review-ui-store-2026-07-14.md) (the "re-derive per surface vs.
one selector" anti-pattern this epic's signal must not repeat). Visual reference: the grill mockup
(`m4-workbench-mockup.html`, published as an Artifact 2026-07-22) — a working demo of the
port-centric build gesture, the ribbon, and the signal's three renderings.

Scope in one line: the Price Board becomes the game's **workbench** — routes are authored on it by
placing port Stops and attaching orders against live prices, ships are dispatched from it, a single
**market-quality signal** reads across the board / PortPanel / offer labels, and the Headquarters
Trasy tab shrinks to a read-only **route ribbon** roster.

Explicit non-goals (each parked with its home):
- **No new route conditionals / auto-sell-at-best / wait-until-full.** Route semantics stay frozen
  at E9/E9.1 (frozen bets + the single Margin Gate wait, ADR-0007). Rejected and reaffirmed at the
  route-automation grill (2026-07-21); this epic is **surface, not new automation**.
- **No `src/sim` changes.** E16 is a **UI + store-bridge epic** — it re-surfaces route semantics and
  market data that already exist (`route.ts`, `commands.ts`, the market pricing). No new Commands, no
  new sim state, no `SAVE_VERSION` bump. (If a signal input turns out to need a sim-side value that
  isn't already exposed, that is a scope flag to raise, not to absorb silently.)
- **No information fog.** Full-information board stays (fog is a parked E6 candidate); Q7's focus and
  pinning are *legibility tools over full data*, never hiding.
- **No map redesign.** The map keeps its read-only pleasure role; skiff easing (#173) is map-side
  cosmetic, tracked on its own.

---

## Design

### Core principle — the board is the workbench; the map keeps the pleasure

M4's success measure (PRD §M4, fantasy-roadmap lock 1) is behavioral: **a master spends more time on
the Price Board than in the route editor.** E16 earns that by moving route *authoring* onto the
board, where the prices already are, and demoting the separate list editor. The dividing line with
the map is sharp and load-bearing:

- **Board / ribbon = editable, price-dense, no decorative motion.** Everything you *decide* — what to
  haul, where, in what order, which ship — happens here.
- **Map = read-only, spatial, cosmetic, "look at what you built."** Fleet glyphs in motion, osmosis
  skiffs, build progress, orbit cosmetics, archetype port icons; designating the Controlled Ship by
  map-click stays (an inherently spatial gesture); the selected Route's Stops still highlight on the
  map (reading, not editing).

The ribbon (below) is deliberately **schematic** — an umowna, distance-hinting rail, *not* real
orrery geometry — so it never competes with the map's spatial beauty. Two languages, two jobs.

### The route ribbon — one visual language for authoring and inspection

A **Route ribbon** (PL: *wstążka trasy*) renders a Route as its ordered Stops laid along a rail:
each Stop is a planet-style node in its port's archetype color, connected by the route line, with
the assigned Ship gliding along it. The ribbon is the single visual language for two surfaces:

- **Editable** in the board (the authoring canvas — this section + the next three).
- **Read-only** in the Headquarters Trasy tab (the roster — one ribbon per Route).

A master learns *one* idiom — "planet-Stops in order, ship sails the line" — and reads it everywhere.

**Loop closure.** A Route is a loop, so the ribbon must read as a cycle, not a dead-end line: the
return leg (last Stop → Stop 1) is drawn as a subtle return arc plus a **↻** marker. The gliding
Ship actually *returns* home along that arc — it does not only travel left→right. For a Route with
**more than two Stops**, during the return phase the **intermediate Stops dim** while the Ship
travels back to the origin, so the return reads as a direct trip home (passing over, not stopping
at, the middle Stops). (Owner production note, 2026-07-22.)

### Construction is port-centric (the crux)

**A Route is authored as an ordered sequence of ports; orders attach per Stop.** This is the spine;
good-centric wiring is *reading assist only*, never the construction gesture. Locked hard after the
owner validated the gesture in the mockup.

Why port-centric wins (the two phrasings "fuse into the price board" [good-columns] and "port-icon
editor" [port-sequence] collided here; this resolves it):

1. **Order is load-bearing, not cosmetic.** The Margin Gate's reference port is *the next sell-stop
   in Route order* (CONTEXT.md Stop / Margin Gate, ADR-0007). A good-centric "wire cheapest-ask to
   highest-bid" gesture leaves order and direction implicit — it cannot express E9.1 semantics
   unambiguously.
2. **A Stop is one port + many orders.** Port-centric makes that structure fall out (port = node,
   orders = chips on it). Good-centric produces per-good fragments that must be *merged by port* —
   the "buy Grain and Timber at the same producer" case has no clean gesture.
3. **It matches the ribbon and the mockup** — thinking in a sequence of ports is what the surface
   already shows.

**The gesture:** click a port's row (its name / left header) in the board → the port appends to the
ribbon as a Stop. Then attach orders to it (next section). A Route needs ≥ 2 Stops over ≥ 2 distinct
ports to be assignable (unchanged, `route.ts`).

### Attaching orders — inferred kind, progressive disclosure, highlight-only pairing

Click a good's cell for a Stop's port → an order attaches to that Stop. The gesture is *guided, not
dumb, not magic*:

- **Kind inferred from economic context, always overridable.** Clicking in a *best-ask* context
  defaults to **buy**; a *best-bid* context defaults to **sell**. The common case is one click; the
  player can flip the kind.
- **Qty ceiling and Margin Gate are progressive-disclosure fields.** Hidden behind a "więcej"
  affordance so the frequent case (greedy buy / sell-all) stays a single click, and the E9.1 knobs
  (`qty` cap, `minMargin`) are there when wanted without cluttering.
- **Pairing assist = highlight only, never auto-wire.** When you add a **buy** order for good X, the
  board *highlights* the best-bid port for X as a suggested next Stop — but **you** click to add it.
  This preserves the port-centric spine, the load-bearing order, and player agency. Auto-pairing is
  explicitly rejected: it is the "auto-sell-at-best" the route-automation grill locked out.

### Dispatch from the board

The board owns **route dispatch**; the PortPanel keeps **transactional trade**. The boundary
prevents rebuilding the whole trade UI in the board:

- **On the board (first-class, via the ribbon / roster):** assign / unassign a Ship to a Route,
  suspend / resume. These fold in #177 (a selected Ship shows its assigned Route + suspend control) —
  it is simply the ribbon-inspector for that Ship.
- **A lightweight one-off "sail here now"** for the Controlled Ship (= `sailTo`, suspends an assigned
  Route per existing semantics) — the ad-hoc escape hatch that satisfies "dispatch from the board".
- **Full manual buy/sell stays in the PortPanel**, reached after docking. No duplication. (Order
  equivalence holds either way — a manual buy is the same Command a Stop dispatches, ADR-0007.)

### The market-quality signal — one signal, three renderings

There is **one** concept — *how good is this (port, good, direction) relative to the region, on a
gradient* — computed once and rendered in three places. This is the unification the owner spotted
mid-grill; it is the same shape Professor Finding 4 named for ship-resolution ("re-derived inline in
each surface" vs. "one selector"), applied here so the signal is not re-computed three ways.

**Market-quality signal** (PL: *sygnał jakości rynku*): a per-(port, good, direction) rank derived
from the region's price spread — generalizing the board's existing best-ask / best-bid extremes into
a graded scale (best / near-best / possible-but-worse). Three renderings:

1. **Board — cell emphasis.** The strong end is the current best-ask/best-bid highlight; near-best
   and the rest step down. (Generalizes `columnExtremes`.)
2. **PortPanel — action shading** (the owner's TODO): the buy / sell actions shade by carried Cargo
   and free Hold — **bright** = this is the (near-)best market for the action, **faded** = possible
   but better ports exist. Buy is meaningless with no free Hold; sell is meaningless with nothing to
   sell — those read as unavailable, not merely faded.
3. **Offer labels (#227) — the word.** Where a label reads better than a shade: *okazja* (bright end
   of the buy gradient), *rzadkie* (good tradable at few ports), *pilne* (time/contract-driven — the
   one label that reads a signal beyond pure spread).

**Visual channel — intensity, not hue.** The signal rides **opacity + weight (bright ↔ faded)** and
is deliberately **hue-free**. This keeps one-color-one-meaning (ADR-0006, incident 0002): a new
quality hue would collide with archetype tints, the trend up/down colors, best-ask/bid, and gold
(Controlled Ship). "Bright = best market" then means exactly the same thing on every surface,
enforced by construction. The signal is **informational only** — it never trades or wires anything.

### Information density — contextual focus + pinning (surviving E15)

The board must stay readable as goods multiply (E15 adds provisions + clearwood; Aether ice comes
with the events epic). Two tools, over full data (no fog):

- **Contextual focus.** While attaching an order for good X, the board emphasizes X's column and
  dims the rest — legibility follows the task — reverting when not building. Also invokable manually
  (focus one good).
- **Pinning / collapsing.** The player can hide columns for goods they don't trade, keeping the grid
  narrow as columns grow. A master handles a handful of goods; the board should show that handful.

### Runtime execution legibility (cluster B symptom c)

Playtest obs #10 — a Stop's "sell all" read as a *cargo wipe* because the player couldn't see why
the hold emptied. This is a runtime-feedback gap, not a planning-surface one, and it ships **in this
epic** (not parked):

- The sell order chip on the ribbon reads legibly as **"sprzedaj całość · {good}"**, not an opaque
  "sell" — the greedy semantics are visible at authoring time.
- At execution, a note in the pause-cause pattern (#130 kin) records what a Stop did:
  *"{Port}: sprzedano całość {good} ({n} szt.) — Stop {k}"* — so a routed sale is legible in the
  moment, the same way a pause explains itself.

---

## Tech

E16 is UI + store-bridge only. No `src/sim` module changes. The route model, Commands, Margin Gate,
and market pricing are all reused as-is.

### Store bridge — the market-quality signal selector (`src/store`)

Compute the signal **once**, in a store-bridge selector, not inline per surface (Professor Finding 4
discipline; the fleet-resolution selector shipped in the #319 refactor is the precedent to follow).
Shape: a function of `(region, priceSnapshots)` returning, per (port, good), the buy-quality and
sell-quality tier (strong / mid / weak) plus the best-ask/best-bid port ids for pairing. This
subsumes and replaces `PriceBoardOverlay.tsx`'s local `columnExtremes` (that inline helper becomes a
consumer of the selector, or is deleted in its favor). PortPanel action shading and any offer-label
computation read the *same* selector — three renderings, one source.

### Route ribbon component (`src/ui`)

A reusable `RouteRibbon` component rendering an ordered Stop list as archetype-colored nodes + route
line + loop arc/↻ + optional gliding Ship. Two modes: **read-only** (roster rows) and **editable**
(board authoring — add/remove Stops, attach/edit orders, reorder). Ship animation honors
`prefers-reduced-motion` and the sim-time/pause law (no motion while paused — kin to the skiff
anchoring #161). The return-leg intermediate-dimming is a render state of this component. Shares the
planet/archetype icon set already vendored (`icons/index.ts`; ADR-0006).

### Board fusion (`src/ui/PriceBoardOverlay.tsx`)

The "Ceny" surface gains the authoring layer: port-row click → append Stop; good-cell click → attach
order; contextual focus + column pinning; the editable ribbon docked below the grid. Reuses the
`OverlayShell` + `Tabs` shells (Professor Finding 2 extraction, shipped) rather than growing a new
frame. The `activeOverlay` store field (#320) governs its open state. Consider whether the board's
tab set changes ("Ceny" now implies "Ceny · Trasa").

**Reaching the workbench (keybinds are settled — extend, don't redesign; M4 rail).** The board opens
via its existing `B` hotkey, unchanged. #175 (a keybind to open the Trasy tab) shifts meaning now
that Trasy is a read-only roster — repoint it at the roster or reconsider it at filing; either way
this epic does not add a new keybinding scheme.

### Trasy roster (`src/ui/HeadquartersPanel.tsx`)

The Trasy tab's list-based Stop editor is **removed**; the tab becomes a read-only roster of
`RouteRibbon` rows (one per Route) with per-row metadata (assigned Ship count, suspend/resume) and an
**"Edytuj →"** entry point that opens that Route in the board editor (the roster→board seam — without
it, editing an existing Route has no home). Route-domain code already cleaved out of build-domain in
the #321 refactor, which eases this.

### PortPanel action shading (`src/ui/PortPanel.tsx`)

Buy/sell action affordances read the market-quality selector and shade bright/faded by signal, gated
by Cargo + free Hold for availability. No trade-logic change — presentation only.

### Docs sync

- **CONTEXT.md** — two **new** glossary entries (added with this spec, glossary-first law): **Route
  ribbon** (PL *wstążka trasy*) and **Market-quality signal** (PL *sygnał jakości rynku*). Forward
  pointers added to the **Price board**, **Route**, and **Stop** entries noting that E16 makes the
  board the authoring+dispatch surface and demotes the Trasy tab to a roster — these entries are
  *rewritten as-built only when E16 ships*, not now.
- **PRD §M4** — the Workbench bullet gains its epic number (E16) + spec link.
- **specs/README.md** — new row for E16 (added in the same commit as this file, Documentation law).
- Supersedes nothing outright; E9's route-editor description (Trasy list editor) gets a pointer to
  E16 when E16 ships (the list editor is replaced).

---

## Testing

UI epic → **Playwright E2E** is the gate (no sim TDD; nothing in `src/sim` changes).

- **Port-centric build flow:** port-row click adds a Stop; good-cell click attaches an order with
  the context-inferred kind; the pairing highlight appears on the best-bid port; adding it creates
  the second Stop; the ribbon shows the loop + ↻.
- **Order equivalence (regression):** a Route authored on the board produces the same assignment /
  Commands as one authored the old way (guard against the surface drifting from `route.ts`
  semantics).
- **Roster → board edit seam:** "Edytuj →" opens the correct Route in the board editor.
- **Signal single-source:** the same (port, good) reads the same tier on the board and in the
  PortPanel (one selector, asserted across surfaces).
- **Density tools:** contextual focus dims non-target columns; pinning hides a column.
- **Execution legibility:** a Stop sell-all writes the runtime note; the chip label reads "sprzedaj
  całość · {good}".
- **Reduced-motion / pause:** ribbon Ship animation stops under `prefers-reduced-motion` and while
  paused.

**Manual playtest (milestone law):** the real test is the M4 success measure — does authoring on the
board *feel* faster than the old editor, and does the master stop opening Trasy? Cut small, playtest,
iterate (the UI-grill-corrects-by-playtest rule). Also eyeball the intensity-only signal for
legibility against the existing color load, and the refit-violet/mining-violet proximity flagged in
HANDOFF §Watch.

---

## Issue cut

Filed after approval; milestone = epic E16. Prefer parallel, file-disjoint packages. Numbers filled
after `gh issue create`. Final acceptance criteria live in each issue's newest criteria comment
(WORKFLOW §Issues).

**On #376, #177, #227.** #376 is a *grill+spec* meta-ticket ("needs its own grill+spec before any
code", HANDOFF §Queue) — this spec is its deliverable. **Owner decision (2026-07-22): #376 closes as
fulfilled, and implementation is filed as fresh E16 issues** (not a rename). #177 (ShipPanel route
status + suspend) is a genuine implementation ticket and folds into (b). #227 (offer labels) becomes
(f).

Milestone **E16 — Workbench** (to be filed).

| Issue | Track | Scope | Depends on |
| --- | --- | --- | --- |
| (a) | store | `feat(store)`: market-quality signal selector (subsumes `columnExtremes`) + `RouteRibbon` read-only component | — |
| (b) | ui | `feat(ui)`: Trasy tab → read-only ribbon roster + roster→board "Edytuj →" seam (#177 folds in) | (a) |
| (c) | ui | `feat(ui)`: board authoring — port-row/good-cell gestures, editable ribbon, order attach (inferred kind + progressive disclosure), highlight-only pairing (the board-fusion core the #376 grill asked for) | (a) |
| (d) | ui | `feat(ui)`: contextual focus + column pinning on the board | (c) |
| (e) | ui | `feat(ui)`: PortPanel action shading from the signal (owner TODO) | (a) |
| (f) | ui | `feat(ui)`: offer labels (#227 — okazja/rzadkie/pilne) from the signal | (a) |
| (g) | ui | `feat(ui)`: runtime execution-legibility note + "sprzedaj całość" chip label (cluster B symptom c) | — |

Sequencing note: E16 is **UI-only**, so it is file-disjoint from the sim-heavy E11/E15 and can run in
parallel with them — but its priority slot against the HANDOFF §Queue (E11 v1 → E15) is an **owner
call**, made when this spec is approved. It is not a blocker for either. (a) is the enabling package;
(b)–(g) fan out from it, with (c) the largest and the true heart of #376.
