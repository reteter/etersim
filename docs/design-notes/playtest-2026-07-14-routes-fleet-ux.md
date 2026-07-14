# Playtest 2026-07-14 — routes, fleet visibility, price-board UX

Owner playtest (multi-ship, route-driven mid-game), analysed the same day. Analyst
gate: every observation verified against code before classification; routes below,
decisions stay with the owner. Verification citations from the read-only sweep are
inline.

## Verified observations & routing

| # | Observation | Verdict (code) | Route |
| --- | --- | --- | --- |
| 1 | Osmosis skiffs look chunky / low-FPS; too prominent | **Works as designed, reads badly.** Skiff position is a function of integer `World.tick` only (`skiffPosition.ts:67-78`, no interpolation, per the #161 sim-time-anchoring lock); at 1x that is one discrete jump per real second (`MS_PER_TICK_AT_1X = 1000`, `speed.ts:12`). Styling: full-opacity `#7fb4e0` + drop-shadow (`index.css:712-715`). | Issue (feat, ui): render-side easing between tick positions **preserving the pause/speed law** + opacity/contrast toning. #173 |
| 2 | Ships beyond the first are invisible on the map | **Confirmed defect.** `App.tsx:47` hard-codes `ship={world.company.ships[0]}`; `RegionMap` renders exactly one ship. The Controlled Ship can be literally invisible (gold styling applies only if `ships[0]` happens to be controlled); map-click designation (CONTEXT.md Controlled Ship) cannot work for a fleet. | Issue (bug, ui): render the whole fleet. #174 |
| 3 | Need a keybind for the routes tab | Confirmed gap: hotkeys are Space/1/2/3/B/Esc only (`TopBar.tsx:43-64`); nothing opens Headquarters or its Trasy tab. | Issue (feat, ui). #175 |
| 4+6 | Route editing is painful without price data next to it (screenshot workaround) | UX composition question — the route editor and the Price Board are separate overlays; no per-port price context in the editor. | **Grill cluster B** (below). |
| 5 | Route planning should be more automated: pick producer ports, then either explicit consumers or an auto mode "sell at the region's best price" | **Collides with a settled decision**: E9 lock "Routes carry no price or wait conditions — a route is a frozen bet" (CONTEXT.md Route; [route-conditionals](route-conditionals.md) is parked awaiting its own grill). Auto-sell-at-best is dynamic routing, a step beyond even the parked conditionals. New playtest evidence → owner grill, not a quiet override. | **Grill cluster A** (below). |
| 7 | Budowa tab never says *what* is being built | Confirmed: the tab shows recipe lines and progress but the word "ship" appears nowhere (`HeadquartersPanel.tsx:52-65,110-126`, `BuildProgress.tsx`). | Folded into open **#128** (HQ must explain its own mechanics) as an observation comment. |
| 8 | Route planner clips with many stops; no scroll; zoom-out is the only workaround | **Confirmed usability bug.** `.overlay__panel` has no max-height/overflow (`index.css:109-116`) — unlike `.price-board` (60vh + scroll) and the Ledger (50vh). A long Stop list grows past the viewport; vertically centered ⇒ both ends clipped, Save/Cancel unreachable. | Issue (bug, ui). #176 |
| 9 | Selecting a ship should show its current route + a pause control | Confirmed gap: `ShipPanel.tsx:53-93` renders name/status/hold only — never reads `ship.assignment`; suspend/resume lives exclusively in `HeadquartersPanel` `RouteRow`. | Issue (feat, ui). #177 |
| 10 | Changing a ship's route wiped its cargo | **Not a wipe — no code path clears cargo on route commands** (`assignRoute`/`unassignRoute`/`resumeRoute` are pure assignment setters, `commands.ts:115-148`). Mechanism: the next docking executed a Stop `sell` order, which sells the *entire* held quantity (`tick.ts:108-110`, per the locked Stop semantics "sell — sell all at bid"). Works as designed; **legibility gap** — the player had no way to see why. | Grill cluster B footnote (legibility of route order execution; kin of the pause-cause-note pattern, #130). |
| 11 | Price board needs a readability redesign | Current shape verified: rows=ports × cols=goods, each cell stacks bid/trend/ask, best-ask/best-bid highlights, archetype row tint (`PriceBoardOverlay.tsx:104-164`). Overlaps open #127 (trend legend) and #74 (good icons). | **Grill cluster B**. |

## Grill cluster A — route automation (owner grill required)

Playtest input: manual producer→consumer wiring is tedious at fleet scale; the owner
wants "pick producers, then explicit consumers or auto-sell at the region's best
price". This relitigates the E9 frozen-bet lock **with new facts**, exactly the case
CONTEXT.md/WORKFLOW reserve for a grill. Inputs to carry: [route-conditionals
parking note](route-conditionals.md) (parked 2026-07-09, "its own grill"), the E9
lock rationale (routes rot visibly, the Ledger makes rot legible), and E3's
contract layer (contracts already answer *where demand is* — does auto-sell
duplicate or complement them?). No grill scheduled yet — owner's call on timing
(candidate: after E3 sim waves, when contract gameplay is feelable).

## Grill cluster B — the region's economic surface vs the route editor

One UX cluster, three symptoms: the route editor lacks price context (4/6), the
Price Board wants a readability pass (11, overlaps #127/#74), and route order
execution is illegible in the moment (10 — "sell all" reads as a cargo wipe).
Common question: what single surface shows "what to haul where, and what my routes
are doing about it"? E3's Kontrakty tab (#96) is about to make the Price Board the
region's economic surface — grill B should ride the same wave or immediately after.

## Issue log

Filed this session: #173 (skiff easing + toning), #174 (render whole fleet — bug),
#175 (routes-tab keybind), #176 (overlay scroll — bug), #177 (ShipPanel route
status + suspend). Comment added to #128 (Budowa names its output). Clusters A/B
parked here, awaiting owner grill scheduling.
