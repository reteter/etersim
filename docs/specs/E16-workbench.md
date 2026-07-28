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

#### The market-free kinds — deliver / store / withdraw (#404 grill, 2026-07-28)

Inference reads the *market*, and `deliver` / `store` / `withdraw` have no market to read. They are
authored on the board too — the board is the only authoring surface after (b) removes the Trasy list
editor — but through a **deliberately asymmetric** gesture, so the frequent case does not pay for the
rare one.

1. **The default click is unchanged.** One click, kind inferred, `⇄` flips buy↔sell and stays
   **binary**. Extending `⇄` into a five-way menu was rejected: it would tax every routine buy with a
   choice the player almost never wants.
2. **Market-free kinds live behind "więcej"** — the same progressive-disclosure drawer that already
   holds `qty` and `minMargin`. No third gesture is introduced.
3. **The drawer is the complete truth about kind.** It lists *every* kind legal in that cell,
   including `buy` and `sell`; `⇄` is a **shortcut** for the frequent flip, never a rival source of
   truth. A model where two controls partition the kinds along an unwritten market/market-free line
   is exactly the structure a reader without this conversation cannot infer.
4. **A cell already carrying a market-free order is inert to the plain click.** Removal is the chip's
   `×` only. The plain click keeps its add/toggle-off meaning for `buy`/`sell`, where the player can
   restore the order with the same gesture that removed it — a `store` order cannot be restored that
   way, so a blind click must not be able to destroy it. Changing kind out of a market-free order
   goes through the drawer (point 3), which is why that path has to be complete.
5. **Legality mirrors the Trasy editor one-to-one, with no board-side tightening.** `deliver` is
   offered everywhere (a deliver order at a port with no active build is a documented no-op —
   CONTEXT.md §Stop order); `store` / `withdraw` appear only where the Company has an **activated
   Storehouse** and only for goods inside that Building's own `storehouseFilter`.
   **`deliver` is deliberately *not* gated on an active build site.** Storehouse legality is
   monotonic — a built Storehouse does not disappear — but a build site does, so gating `deliver` on
   it would strand an existing order in a cell that no longer offers its kind: unremovable through
   the drawer, and invisible for the same reason #413 describes (#413 shipped a "Ukryte kolumny"
   strand badge for the hidden-column case; a vanished-cell case has no equivalent affordance and
   would need its own). E15 also moves the target (its
   plants are "fed only by Company deliveries"), so a build-site gate would need rewriting one epic
   later.
6. **Market-free kinds take no fields.** `deliver`, `store` and `withdraw` carry neither `qty` nor
   `minMargin` (`route.ts`), so for them the drawer holds the kind picker and nothing else, and the
   cell's chip renders label + `×` with **no** `⇄`.

**Storehouse discoverability — a port-row marker.** With the kinds behind a drawer, nothing on the
board would reveal *where* `store` / `withdraw` are possible; the Trasy editor answered this
structurally, by growing two extra columns on a Stop whose port had a Storehouse. The board's columns
are region-wide goods and cannot do that. So the **port row header** carries a marker (glyph +
`title`, beside the existing `★` pairing hint) whenever the Company has a Storehouse at that port.
Port-level, not cell-level: the cells already carry trend glyph, ask, best-ask/bid highlight, signal
intensity and focus emphasis, and #414 (resolved 2026-07-28: `role="columnheader"` + focus emphasis
moved to opacity/weight) was a finding about exactly that channel load — the
per-good precision belongs in the drawer, where the choice is made anyway. **Visible always, not only
in authoring mode**: this is a fact about your own holdings, not a market suggestion, so §Signal
boundary's *data ≠ suggestion* line puts it on the permitted side. Hue-free glyph, so ADR-0006 is
untouched.

**Why this was a blocking decision (#404).** The board does not merely *lack* these kinds today — it
**silently destroys them**. `handleCellClick` falls through to `inferOrderKind` for any kind that is
not `buy`/`sell` (`PriceBoardOverlay.tsx:221-222`), `setStopOrder` then *replaces* rather than merges
(`routeAuthoring.ts:118-121`), and no chip renders for the market-free kinds at all
(`PriceBoardOverlay.tsx:473`) — so one click turns a `store` order into a `buy` with no cue that
anything was there. The path is **unreachable today** (the board only ever builds fresh drafts:
`nextRouteId`, `stops: []`, `createRoute`), and **(b)'s "Edytuj →" seam is precisely what makes it
reachable.** Hence the ordering law in §Issue cut: (h) merges before (b).

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

**The selector grades three tiers; the rendering is binary** (as-built #392/#394/#396, ratified
2026-07-28 via #409 option (a)). `computeMarketSignal` returns `strong` / `mid` / `weak` — `mid`
being the near-best band, `NEAR_BEST_BAND = 0.08` — but every surface renders **`strong` bright,
`mid` and `weak` plain**. The middle level is computed and deliberately not drawn: two levels
already carry "is this the market to act in", and a third shade competes with the existing color
load for a distinction the player does not act on differently. Rendering it later is a rendering
change, not a selector change — the tier is already there to read.

1. **Board — cell emphasis.** The `strong` tier is the current best-ask/best-bid highlight; `mid`
   and `weak` render plain. (Generalizes `columnExtremes`.)
2. **PortPanel — action shading** (the owner's TODO): the buy / sell actions shade by carried Cargo
   and free Hold — **bright** = this is the best market for the action, **faded** = possible
   but better ports exist. Buy is meaningless with no free Hold; sell is meaningless with nothing to
   sell — those read as unavailable, not merely faded.
3. **Offer labels (#227) — the word.** Where a label reads better than a shade: *okazja* (bright end
   of the buy gradient), *rzadkie* (good tradable at few ports), *pilne* (time/contract-driven — the
   one label that reads a signal beyond pure spread).

   **As-built (#397, 2026-07-28, tier-2 review-confirmed).** Every port's market carries every good
   (worldgen), so "tradable at few ports" cannot mean market presence — *rzadkie* reads **producer
   scarcity** instead: the good's producing archetype (`ARCHETYPE_PROFILES.productionPerDay`) has
   ≤1 port region-wide (`RARE_PRODUCER_PORT_MAX`). *pilne* reads an accepted `ActiveContract` at
   that (port, good) with quota still outstanding this period, not period-end proximity —
   `periodEndTick` is a private `src/sim/contract.ts` export E16's UI+store-bridge-only boundary
   doesn't allow surfacing. `okazja`/`rzadkie` render on the buy/ask side, `pilne` on sell (delivery
   quota only credits on a sale, `commands.ts` `applyTrade`). Implementation: `src/store/offerLabels.ts`.
   **Naming collision, unresolved:** "Pilne" already names a different concept in `KontraktyTab.tsx`
   (#226 desperation-clause offer cards, `requiredRank === 1`) — same Polish word, different meaning,
   both player-visible at different points in the flow. CONTEXT.md sanctions both entries separately;
   neither acknowledges the other. Flagged for a Designer look, not blocking.

**Visual channel — intensity, not hue.** The signal rides **opacity + weight (bright ↔ faded)** and
is deliberately **hue-free**. This keeps one-color-one-meaning (ADR-0006, incident 0002): a new
quality hue would collide with archetype tints, the trend up/down colors, best-ask/bid, and gold
(Controlled Ship). "Bright = best market" then means exactly the same thing on every surface,
enforced by construction. The signal is **informational only** — it never trades or wires anything.

### Information density — contextual focus + pinning (surviving E15)

The board must stay readable as goods multiply (E15 adds provisions + clearwood; Aether ice comes
with the events epic). Two tools, over full data (no fog):

- **Contextual focus.** While attaching or editing an order for good X (attach, flip kind, or open
  the qty/Margin-Gate "więcej" panel), the board emphasizes X's column and dims the rest —
  legibility follows the task — reverting when not building. Also invokable manually (focus one
  good).
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
Shape: a function of `(ports)` returning, per (port, good), the buy-quality and
sell-quality tier (strong / mid / weak) plus the best-ask/best-bid port ids for pairing. (As-built
#392: the tier reads only the current cross-port quotes at qty 1; `priceSnapshots` feeds the board's
trend arrows, not the quality tier, so it is not a selector input.) This
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

**Market-free kinds (h).** The eligibility rule is not net-new logic — it already exists in
`RoutesTab.tsx` and moves surface: a `CompanyBuilding` looked up by `stop.portId` over
`world.company.buildings` (line 78), narrowed per good by `storehouseFilter(building.variant)` (line
168). Extract it beside the other shared draft helpers in `src/ui/routeAuthoring.ts` (the module
#394 created for exactly this — one copy consumed by both surfaces) rather than re-deriving it in
the board; the board and the editor must not drift on legality while both exist. Three code-level
consequences of the §Attaching orders lock, each named so the diff is checkable against it:
`handleCellClick` must **return early** when the good's existing order is a market-free kind instead
of falling through to `inferOrderKind`; the chip at `PriceBoardOverlay.tsx:473` must render for all
five kinds, omitting `⇄` for the market-free three; and the drawer's kind picker is built from the
cell's legal-kind set, not from a constant. **No `src/sim` change** — the five `StopOrder` kinds,
`storehouseFilter` and the no-op semantics all already exist (epic non-goal upheld).

**Reaching the workbench (keybinds are settled — extend, don't redesign; M4 rail).** The board opens
via its existing `B` hotkey, unchanged. #175 (a keybind to open the Trasy tab) is **closed (owner,
2026-07-22)**: Headquarters is the un-suggested operational-oversight room, so inspecting a register
is meant to be a conscious, slightly effortful act — a frictionless hotkey to a read-only roster
works against that intent. The board (authoring) keeps `B`; the roster needs no hotkey. This epic
adds no new keybinding scheme.

**Signal boundary (owner framing, 2026-07-22).** The market-quality signal renders only on the
*action* surfaces — the board and the PortPanel — never inside the Headquarters registers. HQ is the
raw operational-data room where nothing is suggested; it may grow rich *analytics* (route
profitability — total / last-30-days / current / ROI, parked as a follow-up issue) but those are
**data, not suggestions**. Data ≠ suggestion is the line: the roster shows what your routes *are*,
the board signals where the *opportunity* is.

### Trasy roster (`src/ui/HeadquartersPanel.tsx`)

The Trasy tab's list-based Stop editor is **removed**; the tab becomes a read-only roster of
`RouteRibbon` rows (one per Route) with per-row metadata (assigned Ship count, suspend/resume) and an
**"Edytuj →"** entry point that opens that Route in the board editor (the roster→board seam — without
it, editing an existing Route has no home). Route-domain code already cleaved out of build-domain in
the #321 refactor, which eases this.

**Hard precondition (#404, 2026-07-28): (h) merges before this removal.** The list editor is the only
surface that authors `deliver` / `store` / `withdraw` today, and the board both fails to render them
and silently overwrites them (§Attaching orders → §The market-free kinds). Removing the editor before
the board can hold those kinds would leave a Route needing a Storehouse Stop unauthorable *and*
corruptible. This is written as an ordering between two PRs rather than as a promise inside one,
because a promise inside one diff is unverifiable — a merged commit order is a fact.

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
- **#404's decision adds no glossary entry** (checked 2026-07-28, glossary-first law): all five
  `StopOrder` kinds, **Storehouse** and **Stop** are already in CONTEXT.md, and the decision
  introduces no new domain concept — only a new authoring surface for concepts that exist. Recorded
  because "no entry needed" is a checked result, not a skipped step.
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
- **Market-free kinds survive a board edit (the #404 regression guard):** a Route carrying a `store`
  order, opened in the board editor, renders that order as a chip; a plain click on its cell changes
  nothing; and saving round-trips the order unchanged. This is the assertion that would have failed
  before (h) — write it as a regression test, not only as a feature test.
- **Market-free authoring:** at a port with an activated Storehouse, the drawer offers `store` /
  `withdraw` only for goods in the Building's `storehouseFilter`; `deliver` is offered at every port,
  including one with no active build.
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
`docs/owner-framings-PARKED.md` §Watch items in transit (it was HANDOFF §Watch until 2026-07-28).

---

## Issue cut

Filed after approval; milestone = epic E16. Prefer parallel, file-disjoint packages. Numbers filled
after `gh issue create`. Final acceptance criteria live in each issue's newest criteria comment
(WORKFLOW §Pipeline step 4).

**On #376, #177, #227.** #376 is a *grill+spec* meta-ticket ("needs its own grill+spec before any
code", HANDOFF's then-existing §Queue) — this spec is its deliverable. **Owner decision (2026-07-22): #376 closes as
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
| (h) | ui | `feat(ui)`: market-free order kinds on the board — drawer kind picker, click-inert market-free cells, chips for all five kinds, Storehouse port-row marker (#404's decision) | (c) |

Sequencing note: E16 is **UI-only**, so it is file-disjoint from the sim-heavy E11/E15 and can run in
parallel with them — but its priority slot against the owner-agreed order in HANDOFF (E11 v1 → E15)
is an **owner call**, made when this spec is approved. It is not a blocker for either. (a) is the enabling package;
(b)–(h) fan out from it, with (c) the largest and the true heart of #376.

**Ordering law (#404, 2026-07-28): (h) merges before (b).** Not a preference — (b) removes the only
surface that authors the market-free kinds, and (h) is what gives them a new one *and* closes the
silent-overwrite path (§Trasy roster, §Attaching orders). Kept as two issues rather than folded into
(b) so the ordering is a fact in the merge history instead of an unverifiable promise inside one
diff — the same reasoning incident 0030 records about detectors that encode a law without being
wired to anything that runs.

Engineer-pass note (2026-07-22, Carl at the table — incident 0029): (a) #392 is not purely
`store` — extracting the signal selector forces a **behavior-neutral** swap of
`PriceBoardOverlay.tsx`'s local `columnExtremes` for the selector, and that same file is edited
heavily by (c) #394. So **(a) → (c) is a sequential dependency edge, not a parallel pair** — merge
(a) with its minimal consume-site edit first, then (c) adds authoring. Two further open questions
for #390 part 2 (the profitability register) live in #390's issue, not here: the Total/30d derivation
must not be O(full-retention Ledger) per render (memoize or accumulate), and net margin's docking is
exact only from the #391 tag forward (older saves need a "net accounted from day N" signal).
