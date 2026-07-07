# SVG icon strategy: vendored, tintable, gold = Controlled Ship

Game-world entities (the Ship, the five Port archetypes) need icons that read clearly at
small sizes and can be tinted by state. Text-like UI chrome (`▲ ▼ – ⏸ ₸`) doesn't need
this — it's mono glyphs already, and tinting it is a plain CSS `color` change. Decided
with the owner alongside docs/specs/E10-orrery-view.md (#34, 2026-07-07).

## Decision

- **Boundary**: game-world entities (Ship, Port archetypes) get vendored SVG icons as
  TSX components in `src/ui/icons/`. UI chrome stays Unicode.
- **Vendoring, not a runtime dependency**: each icon is a single monochrome `<path>`
  copied into a small TSX component (source: game-icons.net, CC BY 3.0). No icon-font or
  icon-library package is added to `package.json` — one `<path>` per icon is cheap to
  vendor and keeps the dependency surface at zero.
- **Tinting via `fill: currentColor`**: the SVG root sets `fill="currentColor"`; callers
  tint by setting the CSS `color` property on (or above) the icon, the same mechanism
  already used for text-glyph chrome. No per-instance fill prop plumbing.
- **Color semantics — one color, one meaning**: gold (`#e0a840`, the same hex already
  used for port/selection accents) marks the Controlled Ship, full stop. Docked vs.
  underway is never color — it's conveyed by position on the map, motion, and status
  text (ETA). Reserved for later, not implemented yet: a neutral tint for the player's
  own non-controlled ships (E9), a muted tint for other companies' ships (E8 rich
  variant). Every future ship-state color follows this one-color-one-meaning rule rather
  than accreting ad-hoc tints.
- **CC BY attribution is part of the acceptance criteria**, not an afterthought: a
  Credits entry, reachable from the UI, credits the icon authors and links the CC BY 3.0
  license text.
- **This path is the default for every future icon** (events, goods, guilds, etc.):
  vendored single-path TSX, `currentColor` tinting, credited in the same Credits entry.

## Considered Options

- **Emoji glyphs (status quo)** — rejected: not tintable (browsers render full-color
  emoji glyphs regardless of `fill`/`color`), so state can't be shown by color at all;
  rendering varies by OS/font, undermining "map is space" legibility (docs/specs/E10).
- **Icon font (e.g. a custom webfont)** — rejected: adds a build step and a font-loading
  dependency for a handful of icons; SVG-in-TSX needs neither.
- **npm icon library (e.g. a general-purpose icon package)** — rejected: pulls in far
  more icons than used, adds a runtime dependency, and doesn't match the itemized CC BY
  attribution this specific icon set requires.
- **Vendored single-path SVG as TSX, `currentColor` tinting (chosen)** — matches the
  existing Unicode-chrome tinting model (`color`), zero runtime dependencies, and each
  icon is a small, auditable, individually-credited file.

## Consequences

- Adding an icon means adding one TSX file with one `<path>` and a source/author/license
  comment — no build-time SVG pipeline, no `.svg` imports to configure in Vite.
- Tinting any icon is a CSS `color` rule; no component prop threading for color.
- The Credits entry must be kept in sync as icons are added — CC BY 3.0 requires
  attribution per source, so each new vendored icon adds an entry.
- Color is now a scarce, meaningful signal: only Controlled Ship = gold today. Adding a
  new tint (E8/E9) is a one-color-one-meaning decision, not a free choice of any hex.
