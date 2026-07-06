# Icon / Glyph Implementation Handoff

**Created**: 2026-07-07 (during E2 follow-up design session)  
**Origin**: Controlled Ship header design (follow-up to #28 / issue #32)

## Current State (as of now)

- The project uses **only Unicode glyphs/emojis** for all visual icons. No icon libraries, no SVG icon set, no font icons.
- **Map (SVG in RegionMap.tsx)**:
  - Ships: `⛵`
  - Ports: archetype glyphs (`🌾` agrarian, `⚙` industrial, `🏙` urban, `⛏` mining, `🌳` verdant)
- **UI panels**:
  - Price trends: `▲` `▼` `–`
  - Speed controls: `⏸`
  - Currency: `₸`
- Styling: `.ship__glyph` and `.port__glyph` in SVG `<text>`. Selection uses only `filter: drop-shadow(0 0 1px #e0a840)`.
- No tinting / recoloring of glyphs is implemented beyond the golden glow on selection.

## Why This Came Up

During Designer grilling of the **Always-visible Controlled Ship header** (Branch 2.4.x):

- Need a small, always-visible glyph in the header (top of right column).
- Discussed glyph alternatives for the ship: ⛵ (current), 🚢, 🛳️, ⛴️, ⚓.
- Strong interest in **applying color tints** (red / blue / gold / etc.) for:
  - Indicating the ship is the **Controlled Ship**
  - Showing status (underway vs docked)
  - Semantic / thematic meaning in aether-punk UI

## Key Technical Findings (so far)

- Unicode emojis have **limited color control**:
  - `color` / `fill` works inconsistently (many emojis carry their own colors).
  - Best practical method: CSS `filter` (combinations of `hue-rotate()`, `sepia()`, `saturate()`, `brightness()`).
  - SVG `<text>` gives slightly better control than HTML text nodes.
- Cross-platform rendering of colored emojis is unreliable.
- For reliable, semantic coloring (especially small header + future icons), we will likely need to move beyond pure emoji for some elements.
- Goal: keep things lightweight. No desire for heavy icon libraries.

## Goals for Dedicated Work

- Decide on an icon/glyph strategy for the game (Unicode vs limited SVG icons vs hybrid).
- Enable **reliable tinting / coloring** of ship (and potentially other) glyphs.
- Support use cases from header design:
  - Always-visible Controlled Ship indicator
  - Status-aware coloring
- Maintain consistency between map and side panels.
- Keep implementation simple and maintainable (no new runtime deps if possible).
- Document the chosen approach (possibly new ADR if significant).

## Open Questions (to be resolved in the separate work)

- Primary purpose of color in the header? (Controlled indicator / status / general theme / all of the above?)
- Should the map ship glyph also become tintable, or only the header?
- Prototype options:
  - Pure CSS filter on emoji
  - Small inline SVG for ship icon (in header first)
  - Monochrome base + tint
- How to handle "docked here" vs "docked elsewhere" vs "underway" visually?
- Future-proofing for more icons (events, goods, etc.)?
- Any impact on E2E tests or visual consistency?

## References

- Current header design discussion: Branches 2.4.1–2.4.5 (Controlled Ship header location, content, interactions, Harbor coexistence, styling)
- `docs/specs/E2-trade-loop.md` — UI layout section
- `src/ui/RegionMap.tsx` — current glyph usage
- `src/index.css` — `.ship__glyph`, `.port__glyph`, filters
- `src/ui/PortPanel.tsx` / `ShipPanel.tsx` — existing panel patterns
- `docs/design-notes/trade-loop-followups.md` — original playtest follow-ups
- Issue #32 — Always-visible Controlled Ship header design

## Handoff Notes for Separate Conversation

This doc is intended as a clean starting point for a focused session on icon implementation.

Recommended starting persona: **Engineer** (with Designer input on the color semantics).

Suggested first steps for the handoff session:
1. Review current glyphs and the header spec needs.
2. Prototype 2–3 approaches for tintable ship representation.
3. Evaluate cross-browser rendering (especially on Windows/macOS).
4. Propose concrete changes for the Controlled Ship header.
5. Decide whether this stays a small UI tweak or requires a mini-spec / ADR.
6. Update #32 (or new follow-up issues) and the header design in E2 spec if needed.

When done, feed decisions back into the main trade-loop follow-up work.

---

**Status**: Ready for separate focused work. Main design session paused on this subtopic.
