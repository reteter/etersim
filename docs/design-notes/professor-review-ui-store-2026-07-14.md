# Professor review — UI layer & store bridge

*Dispatch: 2026-07-14, owner-invoked, mid-M3 (E3 sim waves in flight; `src/sim`
excluded — covered by the 2026-07-13 review). Subsystem: `src/ui/**`, `src/store/`,
`src/index.css`, `src/App.tsx` @ main `958e45e`. Verbatim report below; routing
actioned the same day (§Routing actioned at the end).*

---

## The Dramatic Opening

*Watch it carefully now!* Here is a UI that was **born single-ship and grew a fleet underneath it** — and the seams show. The joinery is honest where the sim taught it discipline: pure derivation helpers in `src/store/`, a clean command bridge, a Ledger overlay that already typechecks against E3's event union. But E3 is about to lean its whole weight on **three load-bearing beams that were never poured** — a notice pattern the spec swears exists (it does *not*), a tab shell copied by hand three times over, and a color law that no one has yet asked "where does a guild's face go?" *Why is it so?!* Because each was added just-in-time for one overlay, and E3 is the first epic to demand they be *systems*.

## The Immediate Analysis

### Finding 1 — The phantom toast pattern. E3 cites a precedent that does not exist. **[CROWN JEWEL]**

The E3 spec leans on it three times: settlement + rank changes "surface as transient notices (the pattern used for save/load toasts)" (`E3-contracts-and-guilds.md:143`, `:210`). **Search the subsystem — there is no toast.** Save/load feedback is `window.alert("Could not import that file…")` (`GameMenu.tsx:41`) — a *blocking* browser modal — and a silent Blob download for export (`GameMenu.tsx:23-32`). The nearest living relative is the pause-cause note: a single nullable store field `pauseCause` (`gameStore.ts:72`) rendered as one inline `role="status"` paragraph (`TopBar.tsx:90-94`). **One slot. One cause. No queue, no history.**

Now weigh the load E3 puts on it. At a single day boundary — `dayBoundary(world)` — upkeep, *N* contract settlements, and rank changes across up to **five** guilds all fire at once. Worse: `advance()` folds many ticks into one frame and keeps only the *final* world — `for (let i = 0; i < ticks; i++) next = tick(next, [])` then a single `set({ world: next })` (`gameStore.ts:212-213`). At 100× a frame folds ~100 ticks, so **several day-boundaries collapse into one render**, and every intermediate settlement is recoverable *only* from the Ledger's `contractFee`/`upkeep` entries — which already flow (`LedgerOverlay.tsx:99,104`). A `pauseCause`-shaped single field cannot hold "3 contracts settled, 1 rank up, 2 upkeep unpaid," and a flash-and-gone toast cannot be the "look at the board" beat the spec promises at 10×/100× (`:143`).

This is a **settled spec resting on a false premise** — the exact case reserved for the grill. The new fact: the named pattern isn't there, and the notice *model* (queue? persistent history strip? Ledger-diff as the event source? how does it survive tick-folding at speed?) is an unbuilt architectural decision, not a widget to hammer out mid-issue.

### Finding 2 — Three hand-rolled tab shells, and #176's scroll bug is the symptom. **[CROWN JEWEL]**

Count them: `LedgerOverlay.tsx:262-281` (`type Tab`, `role="tablist"`, `.ledger__tab--active`), `HeadquartersPanel.tsx:465-484` (`.headquarters-tab--active`), each with its own `Tab` union, its own active-class ternary, its own CSS family. E3 #96 grows PriceBoardOverlay a **fourth** copy ("the E9 LedgerOverlay tab pattern"). Every overlay also re-hand-rolls the frame: `.overlay > .overlay__panel--wide > {title, body, Close}` (`PriceBoardOverlay.tsx:94-101`, `LedgerOverlay.tsx:252-260`, `HeadquartersPanel.tsx:455-463`).

The playtest's overlay-scroll bug (#176) is not a paint defect — it is *this* structure failing. `.overlay__panel` has `max-height`/`overflow` **nowhere** (`index.css:109-116`); only the *inner* `.price-board` (`:796`) and the ledger list (`:995`) got the `60vh`/`overflow-y:auto` treatment, bolted on per-overlay. There is no shared scroll region because there is no shared overlay body. Fix #176 in place and you fix one of four; grow the fourth (#96) and it inherits the bug. **Extract an `OverlayShell` + `Tabs` before #96** and the scroll fix lands once, in the seam, and copy #4 is never written.

### Finding 3 — Where does a guild's *face* go? ADR-0006 has the answer; no one has stated it. (Settled-decision guidance)

E3 hangs new visual entities on the color law: a guild **badge** on Kontrakty rows, a guild **icon + rank badge** in the PortPanel guildhouse section. ADR-0006 fences this ground — gold (`#e0a840`) marks the Controlled Ship, *full stop*; "color is now a scarce, meaningful signal" (`0006-svg-icon-strategy.md:22-25,53-54`) — and it explicitly names guilds as a vendored-icon consumer (`:29`).

The clean joinery is already in the drawer: **guilds are 1:1 with economic archetypes** (`GuildId = EconomicArchetype`), and the five archetype icons already exist — `AgrarianIcon`, `IndustrialIcon`, `MiningIcon`, `UrbanIcon`, `VerdantIcon` (`icons/index.ts:5-8`) — alongside the archetype palette. Guild identity should ride *those*: no new color axis, one-color-one-meaning intact. The trap to fence now: the four-step **rank badge** must not reach for gold and must not overload the archetype hue with a *second* meaning — rank wants shape/number/a neutral ramp, not color. Settled (ADR-0006) — a constraint attached to the E3 UI issues, not a fresh debate.

### Finding 4 — The `ships[0]` hardcode is not one bug; it is a systemic single-entity habit.

`App.tsx:47` (`ship={world.company.ships[0]}`) is filed as #174 — but the *shape* recurs. `PortPanel.tsx:406`: `world.company.ships.find(controlled) ?? world.company.ships[0]` — the same "resolve *the* ship" fallback, and MarketRow trades against whatever it returns. `PriceBoardOverlay.tsx:78-80` derives the docked row from the single controlled ship. Each surface **re-derives ship resolution inline**; there is no fleet-aware selector that answers "which of my ships is relevant *here*." E3/E13 make that a first-class question — contracts carry a `basis.sourcePortId` and "nearest source", which is inherently "which hull hauls this, from where." The map bug is owned (#174); the *structural* gap — no shared fleet-resolution layer in the store bridge — is the thing that will keep minting `ships[0]`-shaped assumptions.

### Finding 5 — Overlay orchestration is three loose booleans with no coordinator.

`TopBar.tsx:39-41` holds `priceBoardOpen`, `ledgerOpen`, `headquartersOpen` as three independent `useState` flags, each rendered independently (`:110-112`) with **nothing preventing all three stacking**. The `B` hotkey toggles one (`:60`); #175 wants a Headquarters/Trasy hotkey; each overlay owns its own `useOverlayDismiss` with no cross-overlay "Esc closes the topmost." This is *open* — no ADR/spec governs overlay orchestration. As E3 adds tabs and hotkeys, N-booleans-in-TopBar becomes a tangle; a single `activeOverlay: 'priceBoard' | 'ledger' | 'hq' | null` in the store would give hotkeys and mutual-exclusion one home.

### Finding 6 — Whole-World subscription. (Preserve — one line, no cliff.)

Every component subscribes to the entire `world` (`App.tsx:35`, `PortPanel.tsx:396`, `PriceBoardOverlay.tsx:70`, `FleetList.tsx:40`). One `set` per folded frame (`gameStore.ts:213`) = one render per rAF, not per tick — perfectly fine at five ports. No selector layer, and none needed yet. **Preserve; revisit only if profiling ever complains.**

### Finding 7 — The UI speaks two languages, and the guild UI forces a choice.

User-facing strings mix English and Polish incoherently: HeadquartersPanel is Polish ("Zleć budowę" `:107`, tab names "Budowa/Trasy" `:472,:481`, stall labels `:28-31`), PortPanel founding is Polish (`:351`), TopBar's pause note is Polish (`:92`) — while LedgerOverlay, PriceBoardOverlay, FleetList are English. E3 authors English guild flavor names ("Granary Guild") under Polish-named tabs ("Kontrakty"/"Ceny"). A small owner decision, not a structural flaw — but the guild UI is where it can no longer be dodged.

### Finding 8 — `HeadquartersPanel.tsx` at 493 lines, seven components. (Non-blocking.)

One file holds `ConstructionTab`, `StopRow`, `RouteEditor`, `RouteRow`, `nextRouteId`, `RoutesTab`, `HeadquartersPanel` — build-domain and route-domain concerns fused (the playtest flagged the same). E3 doesn't touch it (guild UI lands in PortPanel + PriceBoard), so this is a hygiene design-note, not a blocker. The natural cleave is route-domain out from build-domain.

## The "Why is it so?!" Dilemmas

1. **What is the notice *model*?** A transient queue, a persistent history strip, or a Ledger-diff view? What survives tick-folding at 100× — do we replay `contractFee`/`upkeep` entries appended since the last frame, or emit UI events from the store's advance? This decides whether "settlement day is a beat" is real or a blur. (Finding 1 — the review's spine.)
2. **Do we pour the shared overlay/tab beam before #96, or ship copy #4 and refactor four at once later?** The scroll bug (#176) makes this urgent, not cosmetic. (Finding 2.)
3. **Is fleet-resolution a store-bridge concern?** Should "the relevant ship for port P / contract C" be one selector, or keep re-deriving it per component and accept the next `ships[0]`? (Finding 4.)

## The Routing Table

| # | Finding | Channel |
| --- | --- | --- |
| 1 | Notice pattern cited by E3 doesn't exist; single-slot `pauseCause` can't hold day-boundary bursts folded at speed | **Owner grill** — settled spec on a false premise; blocks #97's notice AC |
| 2 | Three hand-rolled tab shells + no shared overlay body; #176 scroll bug is the symptom | **Issue (refactor, ui)** — extract `OverlayShell`+`Tabs`, **gates #96/#176** |
| 3 | Guild badge/icon/rank must ride archetype palette+icons, not new color; rank badge avoids gold & hue-overload | **Settled-decision constraint** (ADR-0006) — attached to #96/#97 |
| 4 | `ships[0]` habit systemic; no fleet-resolution selector | **This design-note** — candidate enabling refactor when #174/#177 are picked up |
| 5 | Overlay orchestration = 3 loose booleans, no exclusion/hotkey home | **This design-note** — `activeOverlay` candidate, natural to fold into the Finding-2 refactor or #175 |
| 6 | Whole-World subscription → per-frame renders | **Preserve, don't fix** |
| 7 | EN/PL user-string mix; guild names force a decision | **Owner** — UI-language call at the E3 UI grill |
| 8 | `HeadquartersPanel.tsx` 493 lines, 7 components | **This design-note** — non-blocking hygiene; cleave route-domain from build-domain |

---

## Routing actioned (Orchestrator, 2026-07-14)

- Finding 2 → issue filed: OverlayShell + Tabs extraction; gates #96 and supersedes
  the in-place fix path of #176.
- Finding 3 → constraint comments posted on #96 and #97 (ADR-0006 guidance).
- Findings 1 + 7 → queued as the **E3 UI grill** (notice model + UI language), to run
  before the #96/#97 wave; the grill also inherits playtest cluster B
  ([playtest-2026-07-14](playtest-2026-07-14-routes-fleet-ux.md)).
- ~~Findings 4, 5, 8 → parked in this note. Unpark triggers: #174/#177 pickup
  (fleet-resolution selector), #175 pickup or the Finding-2 refactor
  (`activeOverlay`), post-E3 hygiene pass (HeadquartersPanel cleave).~~
  **Superseded 2026-07-19 — see below.**

## Parked findings unparked (sweep F5, s14, 2026-07-19)

All three unpark triggers had **fired**, and all three findings were still live in the code
at `main @ c62bb27`. Owner ruling: take them out of this note and give each an issue.

| Finding | Trigger | Fired | State when unparked | Now |
| --- | --- | --- | --- | --- |
| 4 — no fleet-resolution layer | #174/#177 pickup | **yes** — #174 closed 2026-07-15 (#177 still open) | symptom fixed (`App.tsx` no longer renders only `ships[0]`); structural gap open — `PortPanel.tsx:837`, `gameStore.ts:139` | **#319** |
| 5 — three loose overlay booleans | #175 pickup **or the Finding-2 refactor** | **yes** — the Finding-2 refactor shipped: `OverlayShell.tsx` + `Tabs.tsx` exist, all three overlays use them | `TopBar.tsx:49,58,59` unchanged; the refactor named as the trigger went straight past it | **#320** |
| 8 — `HeadquartersPanel` cleave | post-E3 hygiene pass | **yes** — E3 closed | file at **605 lines**, up from the 493 recorded here — it grew 23% while parked | **#321** |

**Why this note is now honestly HIST.** Nothing in it waits on anything; the index's promise
that HIST is safe to skip is true again. It was not true for five days, and the reason is
worth keeping: **parking a finding in a note creates a stock with no outflow.** An issue has
an outflow — it appears in `gh issue list`, so someone meets it whether or not they think to
open the right note. A trigger written in prose has none; it relies on a reader arriving at
the right paragraph in the right week. Three readers did not, and Finding 8 is the proof
that the cost is not zero while nobody arrives: the file the hygiene pass was meant to
shrink grew instead.

The repo had already stated the remedy — **#304**: *"This issue holds the deferred half,
with its trigger, so the deferral is a decision with a home rather than a note that
decays."* Written 2026-07-19, five days after this note parked three findings the other way.
