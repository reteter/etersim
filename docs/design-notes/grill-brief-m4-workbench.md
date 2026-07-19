# Grill brief — M4 Workbench (Clusters A+B)

A **grill brief** is the scenario for a future owner grill: the questions that grill
must resolve, the rails already locked, and the known traps. It hands the *questions*,
not the answers — the owner answers at the table. Written at the fantasy-roadmap
grill (2026-07-16) for whichever orchestrator leads the M4 grills.

**This grill decides:** how the Price board becomes the game's control center — route
planning, dispatch and reading in one surface — and what the region map keeps.

## Rails (locked, don't relitigate — link, build on)

- Price board = the post-HQ workbench; route planning integrated into it; ship
  dispatch from it; the map's role shifts to *check the fleet + enjoy what you
  built* (fantasy-roadmap grill 2026-07-16, lock 1).
- M4's success measure: a master spends more time on the Price board than in the
  route editor.
- Keybinds are settled — extend the existing scheme, don't redesign it.
- One color = one meaning (ADR-0006); Polish player-facing strings; readable depth
  (pillar 4).
- Route semantics stay E9/E9.1: frozen bets + Margin Gate as the one wait condition
  (ADR-0007). Automation is *surface* (where you plan), not new route conditionals —
  those have their own parked note (route-conditionals.md) and their own grill.

## Questions the grill must resolve

1. What does "route planning in the board" concretely mean: create/edit a Route
   from board cells (click cheapest ask + highest bid → a Stop pair)? A route
   overlay row per good? Where does the editor live afterwards — does the HQ Trasy
   tab remain the canonical editor or become a fallback?
2. Dispatch-from-board: which verbs? (assign ship to route / one-off sailTo+buy —
   remember order equivalence, ADR-0007.)
3. The offer label system (#227): which labels, driven by which signals (pilne /
   okazja / rzadkie were the parked candidates)?
4. What stays on the map: fleet glyphs, osmosis skiffs, build progress — what else
   must remain for the "enjoy what you built" role to feel earned?
5. Board information density at 7–9 ports × 5+ goods (+ Aether ice, + processed
   goods later): filtering, pinning, per-good focus?
6. Which of the parked automation inputs (Cluster A notes/issues, e.g. #173, #177
   family) fold in, which stay parked?

## Traps

- Scope creep into route conditionals ("hold the sale until…") — separate grill,
  separate note; the E9 route-rot law is load-bearing.
- Killing the map: if the board does everything, the map dies — the lock demands
  the map keeps the *pleasure* role, so every board feature should name what the
  map keeps.
- UI grills correct by playtest, not speculation: cut small, playtest, iterate
  (milestone playtest law).

## Inputs

- PRD §M4 (beat + Workbench entry), fantasy-roadmap-grill-2026-07-16.md lock 1.
- #227, #173, #177; Cluster A parked inputs in design-notes. (#255 was on this list
  until 2026-07-19 — it had shipped; dropped by sweep F11.)
- `PriceBoardOverlay.tsx`, `HeadquartersPanel.tsx` (Trasy tab), `KontraktyTab.tsx`
  — the surfaces being merged or bridged.
