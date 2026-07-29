# Grill record — #404: where deliver/store/withdraw route authoring lives, 2026-07-28

Owner-led (s27).
Closes the one open decision blocking **#393** (E16 b):
#394's board authoring covers only `buy`/`sell`, because it infers the order kind from market
context —
and `deliver` / `store` / `withdraw` have no market to infer from.
#393 removes the Trasy list editor, which is the only surface authoring those three today.

Outputs:
this note;
`docs/specs/E16-workbench.md` §Attaching orders (new subsection **The market-free kinds**), §Board
fusion, §Trasy roster, §Issue cut, §Testing, §Docs sync;
`docs/specs/README.md` (E16 row); **#419**
filed as the implementation; **#393**
new acceptance-criteria comment; **#404**
closed;
`docs/HANDOFF.md` §Queue + the s24 header line struck in place (Documentation-law corollary — a
falsified line is struck immediately, which is not a refresh, so the owner-request rule stands).

## The finding that reframed the ticket

#404 was filed as *"these kinds lose their authoring home"*.
The code says something worse:
the board **silently destroys them**.

- `PriceBoardOverlay.tsx:221-222` —
  `existingKind === "buy" || existingKind === "sell" ? existingKind : inferOrderKind(entry)`.
  For `store` the guard is false, so it falls through to market inference — and `inferOrderKind`
  returns `null` only when the good has no market at that port at all
  (`routeAuthoring.ts:169-175`). It essentially always yields `buy` or `sell`.
- `routeAuthoring.ts:118-121` — `current?.kind === kind ? withoutGood : [...withoutGood, {kind, good}]`.
  `"store" !== "buy"`, so it **replaces**, not merges.
- `PriceBoardOverlay.tsx:473` — the chip renders only for kinds other than the market-free three,
  so the player never saw there was an order to lose.

One click converts a `store` order into a `buy`, with no cue. **Unreachable today**:
the board only ever builds fresh drafts (`nextRouteId`, `stops: []`, `createRoute` — lines 161/172),
so there is no path that opens an existing Route. **#393's "Edytuj →" seam is exactly what wakes it.**
The guard at line 473 was already describing the hole;
nothing obliged anyone to act on it.

This is what turned the answer from "add a picker" into "add a picker *and* order the merges".

## The six decisions

**1. Explicit kind choice on the board — asymmetric, not a five-way picker.** Option A in spirit,
not in letter.
The default click stays inference-driven and one-click;
`⇄` stays a **binary** buy↔sell toggle;
the market-free kinds enter only through the existing **"więcej"** progressive-disclosure drawer,
and only in cells where they are legal.
Rejected:
widening `⇄` into a five-way menu, which taxes every routine buy with a choice the player almost
never wants.
No third gesture is introduced —
the drawer already exists to hold `qty` and `minMargin`.

**2. Market-free cells are inert to the plain click; `×` removes.** Today the plain click is
symmetric —
it adds an order, and clicking again toggles it off (`setStopOrder` removes on an identical kind).
That symmetry only works when the player can *restore* what they removed with the same gesture.
A `store` order cannot be restored that way;
it needs the drawer.
So the asymmetry is deliberate and one-directional:
creation stays cheap, destruction of a market-free order costs an explicit `×`.
Rejected:
uniform toggle-off —
one rule instead of two, but it buys that simplicity with the sequence
*"player clicks to add a buy at a Granary port, silently removes the `store` order with the first click, adds `buy` with the second, and walks away believing they added rather than replaced"*.

**3. Legality mirrors `RoutesTab` one-to-one, with no board-side tightening.** `deliver` at every
port;
`store`/`withdraw` only where the Company has an **activated** Storehouse (`world.company.buildings`
by `portId`, `RoutesTab.tsx:78`) and only for goods inside that Building's
`storehouseFilter(variant)` (line 168).

**`deliver` is deliberately *not* gated on an active build site**, though the "don't render dead
controls" argument that justifies the Granary goods filter appears to apply.
The difference is **permanence**:
a Storehouse's legality is monotonic —
once built it stays —
while a build site *completes and disappears*.
Gating `deliver` on it would strand an existing order in a cell that no longer offers its kind:
unremovable through the drawer, invisible for the same reason #413 describes, and without #413's
saving grace that the player can undo their own hiding.
E15 also moves the target ("plants fed only by Company deliveries"), so a build-site gate would need
rewriting one epic later.
The sim already absorbs the case:
a deliver order at a port with no active build is a documented no-op (CONTEXT.md §Stop order).

*The general shape, worth carrying forward:* **a UI rule derived from permanent state does not transfer to transient state unchanged — applied to something that disappears, "hide what is illegal" inverts into "strand what exists".**

**4. Storehouse marker on the port row header, visible always.** With the kinds behind a drawer,
nothing would reveal *where* `store`/`withdraw` are possible;
the Trasy editor answered this structurally by growing two extra columns on a Stop whose port had a
Storehouse, and the board's columns are region-wide goods that cannot do that.
So:
a hue-free glyph + `title` on the port row, beside the existing `★` pairing hint. **Port-level, not cell-level**
—
cells already carry trend glyph, ask, best-ask/bid highlight, signal intensity and focus emphasis,
and #414 is an open finding about exactly that channel load;
the per-good precision belongs in the drawer, where the choice is made anyway. **Always visible**,
not authoring-only:
it states what you own rather than suggesting a market, which is the permitted side of §Signal
boundary's *data ≠ suggestion* line.
Rejected:
a cell-level cue (more precise, saves one drawer opening, pays with a sixth channel on the densest
surface in the game).

**5. The drawer is the complete truth about kind.** It lists *every* legal kind for that cell,
`buy`/`sell` included;
`⇄` is a **shortcut** for the frequent flip, never a rival source of truth.
Two reasons:
a split model requires knowing that two controls partition the kinds along an unwritten
market/market-free line —
precisely the structure a reader without this conversation cannot infer (ENGINEER §Golden Record) —
and it gives decision 2 its exit path, since an inert cell otherwise forces `×`-then-click as a
third rule.
Cost:
a plain port's drawer shows a partly redundant three-item picker.
Redundancy behind progressive disclosure is close to free;
nobody opens it to play the common case.

**6. A separate issue, hard-ordered before #393.** Not folded into #393.
The destructive path is in the board and #393 is what makes it reachable, so "fix first, then remove
the editor" must be *checkable*.
Inside one diff it is an author's promise;
as two merges it is a fact in the history.
Also #393 already owns a distinct surface (`HeadquartersPanel.tsx` / `RoutesTab.tsx` vs
`PriceBoardOverlay.tsx`) and closes #177.
Cost:
one more PR in the E16 fan-out —
not a price worth negotiating at this wave size.

## Process observations

- **The Engineer hat was announced before the feasibility claims, not after** (ENGINEER §Invocation
  — the incident-0029 trigger). Every fork here turned on derivability: *can the board know which
  cells are legal?* (yes — `RoutesTab` already computes it), *is that legality transient?* (no for
  Storehouses, yes for build sites — and that answer decided fork 3), *can `inferOrderKind` extend?*
  (no, structurally). Locking fork 3 as a Designer preference would have shipped the strand-trap.
- **The grill's most valuable output was not a decision but a code read.** The silent-overwrite path
  was in none of #404's four options; all four were framed around *absence*, and the real defect was
  *destruction*. The options survived intact — the floor underneath them was what changed.
- **Hat switching mid-session had no written procedure** — the driver initially reported the
  Designer/Orchestrator conflict as an owner decision rather than simply changing hats. Filed as
  **#418**; `docs/HATS.md` describes donning a hat and never mentions that the pipeline it serves
  requires changing hats at least twice per epic.
