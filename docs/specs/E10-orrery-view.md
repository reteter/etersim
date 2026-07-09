# E10 — Orrery view

Feature spec for epic E10 (milestone M2 — Living Region, [PRD](../PRD.md)). Terms per
[CONTEXT.md](../../CONTEXT.md). Grilled and decided with the owner on 2026-07-07.
Status: **approved** (2026-07-07); **shipped** (#43, #25, #34, #44, #45 — epic complete).

Grill inputs: issue #25 (lane topology decision A, locked 2026-07-07), issue #34 (icon
handoff), [playtest-2026-07-07-market-legibility.md §5](../design-notes/playtest-2026-07-07-market-legibility.md).

Scope in one line: the region presented as a planetary system — ports on static orbit
rings around a central star — with geometry-aware lane topology (#25 decision A),
lane accents, and a tintable monochrome icon set (#34). Presentation and worldgen
geometry only: no new economy mechanics, no orbital motion (parked E5 candidate),
no star mechanics (aether currents are E5).

## Design

### Principle: the map is space (decision A)

A port's position is **information, not decoration**. Proximity means something; visual
distance is proportional to voyage time; crossing lanes are a readability bug and are
eliminated by construction. This resolves #25 and supersedes the half-geographic hybrid
of the E2 worldgen (combinatorial topology + geometric durations).

### Orrery geometry

- The region renders as a planetary system: a central **star** (pure decoration), one
  **orbit ring** per port, ports placed on their rings.
- **One port per ring.** Ring radii are deterministic — evenly spaced between the
  template's `orbitRadiusRange` bounds for the generated port count. Ring assignment is
  shuffled via the seeded RNG so radius does not correlate with archetype or generation
  order (radius must stay mechanically meaningless).
- **Angles are the randomness.** Each port draws a random angle on its ring; draws that
  violate `MIN_PORT_DISTANCE` against already-placed ports are rejected and redrawn
  (bounded attempts). Seed variety in topology flows entirely from angles: different
  angles ⇒ different distances ⇒ different lane graph.
  - **Implementation finding (2026-07-07, issue #43):** sequential per-ring angle
    placement has no backtracking, so an early ring can occasionally corner a later one
    into a genuine dead end — confirmed empirically (200k attempts on the stuck ring
    still failed; it's geometric, not a budget shortfall). Observed only at the
    template's max port count (6 rings across `[0.18, 0.46]`), ~1.3% of seeds. The old
    single-attempt guard (adequate for the free 2D placement it replaced) is therefore
    insufficient here. Fix: `placePorts` retries the **whole placement attempt** (fresh
    ring shuffle + fresh angle draws) up to a bounded number of times before the hard
    stop — still fully deterministic (same seed ⇒ same number of retries ⇒ same region)
    and invisible to the ~98.7% of seeds that succeed on the first attempt. Flagged for
    the owner: recalibrating `orbitRadiusRange`/`MIN_PORT_DISTANCE`/`portCountRange`
    could reduce or eliminate retries, but wasn't done here since those constants were
    locked in this same session — the retry keeps generation correct either way.
- **No star exclusion zone.** Lanes may in principle pass near the center, but the
  distance bias disfavors the long cross-system chords that would — YAGNI until a
  playtest shows an ugly seed.

### Lane topology (#25 lands here)

- `connectPorts` becomes geometry-aware and deterministic given positions:
  1. Euclidean **minimum spanning tree** over lane length (connectivity guaranteed,
     Euclidean MSTs never self-cross).
  2. Extra edges added **shortest first**, skipping any candidate that properly crosses
     an already-chosen lane, until the `laneDensity` target — now **best effort**: if
     planarity runs out of candidates first, the region simply has fewer lanes.
- Result: the lane network is **always planar** — zero crossing lanes by construction,
  not by probability.

### Voyage duration: purely proportional

- `voyageTicks = round(voyageTicksPerUnit × length)`. One coefficient, no floor, no
  clamp: time is proportional to distance, so the eye reads voyage times straight off
  the map.
- Correction to the #25 playtest note (spec'd here, synced to E2 spec): the old 48-tick
  floor never broke the triangle inequality — an affine cost with a positive intercept
  penalizes every extra hop. Its real harm was **compressing differences** (near-ties
  like 206 vs 207; half the length ≠ half the time), which contradicts "map is space".
- A future explicit docking/departure cost is a mechanics decision — not something to
  hide in geometry. (Landed: the per-archetype docking fee,
  [E9 spec](E9-fleet-and-routes.md) — approved 2026-07-09.)

### Lane presentation

- Default lanes are **subtle** — thin threads between planets, below planets in visual
  weight.
- **Accent triggers** (in scope): selecting a port accents its incident lanes; the
  Controlled Ship's active course is accented in a distinct style (directional/animated
  dash) while underway or selected.
- **`voyageTicks` labels render only on accented lanes.** The default map stays clean
  (metro-map numbers everywhere would be option-B language); exact numbers appear
  exactly when the player asks by selecting.
- Lane **hover** accents: out of scope for E10 (cheap polish, add after the base lands).

### Planets, star, glow

- **Planet** = disc tinted with its archetype color + archetype icon in a contrasting
  fill + name label above (as today). Color gives at-a-glance recognition; the icon
  carries the meaning (colorblind-safe, mono-screenshot-safe).
- **Archetype palette**: five colors, one per port archetype — a design token used
  consistently everywhere (map, panels, future charts).
- **Star**: disc with radial gradient + soft glow; no icon (decoration, not an entity
  to read). A game-icons star glyph stays as fallback if the gradient looks cheap.
- **Orbit rings**: thin, very faint circles. Visual hierarchy, strongest first:
  planets > accented lanes > default lanes > rings.
- **Aether glow package** (all CSS-only, no tick-driven animation):
  - Idle: soft glow around each planet disc in its archetype tint.
  - Star pulse: slow (~4–6 s) scale/brightness cycle — the map's only ambient motion;
    respects `prefers-reduced-motion`.
  - Planet hover: glow brightens (pure CSS `:hover`).
  - Selection: the golden glow, stronger than idle ambient so it always wins.
  - Risk: over-decoration — keep idle intensities low, tune in playtest.

### Icons (#34 lands here)

- **Boundary: game-world entities get SVG; UI chrome stays Unicode.**
  - SVG (vendored as TSX components, single-path monochrome, tinted via
    `fill: currentColor`; source: game-icons.net, CC BY 3.0): the ship (one icon shared
    by map and header), the five port archetypes. No runtime dependency — paths are
    copied into the repo.
  - Unicode stays for text-like chrome: `▲ ▼ – ⏸ ₸` (mono glyphs, tint with `color`).
- **Ship tint semantics: one color, one meaning — gold marks the Controlled Ship**
  (consistent with selection gold). Docked/underway is conveyed by position, motion and
  text (ETA), never by color. Reserved for later: neutral tint = own non-controlled
  ships (E9), muted = other companies' ships (E8 rich variant).
- **CC BY attribution**: a credits entry (game menu / start screen) linking
  game-icons.net and the icon authors — part of the issue's acceptance criteria.
- The strategy (boundary, tinting, attribution) is recorded as an **ADR**
  (docs/adr/0006-svg-icon-strategy.md) — every future icon (events, goods, guilds)
  follows the same path.

## Tech

### Worldgen (`src/sim/worldgen.ts`)

- `placePorts` → orbital placement: center `(0.5, 0.5)` on the unit plane;
  radii `r_i` evenly spaced across `template.orbitRadiusRange` for `portCount` rings;
  ring↔port assignment via `nextShuffle`; angle via `nextFloat` per port with
  `MIN_PORT_DISTANCE` rejection and a bounded-attempts guard per ring. Because
  sequential per-ring placement has no backtracking, a whole placement attempt can rarely
  corner itself (see the implementation finding above); the guard therefore retries the
  **whole attempt** (fresh ring shuffle + fresh angles) a bounded number of times before
  hard-stopping — deterministic and a no-op for the large majority of seeds that succeed
  first try. Ports keep plain `x`/`y` — serialized world shape unchanged; the orrery is
  derivable (radius = distance from center) so nothing new is persisted.
- `connectPorts` → sort candidates by Euclidean length ascending (ties broken by
  canonical candidate index, for determinism); Kruskal MST; then fill shortest-first
  with a proper-segment-intersection test (shared endpoints are not crossings) until
  `max(n − 1, round(laneDensity × candidateCount))`, best effort.
- All RNG draws remain in fixed generation order; same seed + template ⇒ deep-equal
  region (existing determinism law, ADR-0003).

### Template (`src/sim/template.ts`)

- `voyageTicksRange: [48, 120]` → **`voyageTicksPerUnit: 130`** (calibration: longest
  possible chord `2 × rMax ≈ 0.92` ⇒ ~120 ticks, matching today's ceiling; shortest
  lanes `≈ MIN_PORT_DISTANCE = 0.25` ⇒ ~33 ticks — short hops get snappier).
- New: **`orbitRadiusRange: [0.18, 0.46]`** (fits the unit plane with margin; ring
  spacing for 6 ports ≈ 0.056, so `MIN_PORT_DISTANCE` does real work between
  neighboring rings).
- **No save compatibility work**: saves store the full `World`, so old saves still
  load; regardless, pre-1.0 dynamic phase — no compat guarantees (owner, 2026-07-07).

### UI (`src/ui/`)

- `RegionMap.tsx`: render star (center), orbit rings (radii recovered from port
  positions), planet discs + archetype icons + labels, accented lanes + tick labels,
  ship icon. `mapProjection` unchanged (unit plane in, viewBox out).
- `src/ui/icons/` — vendored TSX icon components (`ShipIcon`, one per archetype);
  `fill: currentColor`.
- Archetype palette + glow styles in `src/index.css` (CSS variables for the five
  archetype colors → the design token).
- Credits entry for CC BY attribution (game menu or start screen).

### Docs sync

- CONTEXT.md: new entries **Orbit ring** (PL: pierścień orbity) and **Archetype
  palette** (PL: paleta archetypów); update **Orrery view** implementation note when
  shipped. (Star stays lowercase set dressing — no glossary entry until it gains
  mechanics.)
- E2 spec: worldgen section points here; triangle-inequality claim corrected.
- New ADR: icon strategy (SVG/Unicode boundary, currentColor tinting, CC BY credits).
- PRD §M2 E10 bullet: link this spec once approved.

## Testing

- Sim (Vitest, TDD): determinism (same seed ⇒ deep-equal region, including a seed that
  requires a whole-attempt retry — see the implementation finding above); one port per
  ring with expected radii; ring shuffle decorrelated from generation order; pairwise
  `MIN_PORT_DISTANCE` holds; a no-throw regression sweep across thousands of seeds (the
  retry fix's reason for existing); lane graph connected;
  **planarity** (no proper segment intersections across all lanes, many seeds);
  `voyageTicks === round(voyageTicksPerUnit × length)` for every lane; template
  invariants updated (`voyageTicksPerUnit > 0`, `orbitRadiusRange` ordered and within
  the unit plane).
- UI (Playwright E2E): star and rings render; selecting a port accents its lanes and
  shows tick labels (and hides them on deselect); ship icon present in map and header
  with the Controlled gold tint; credits entry reachable.
- Manual playtest: glow intensities, star pulse speed, label legibility.

## Issue cut

Milestone **E10 — Orrery view** (filed 2026-07-07); #25 and #34 moved here from E2.
Two parallel tracks:

| Issue | Track | Scope | Depends on |
| --- | --- | --- | --- |
| #43 | sim | `feat(sim)`: orbit-ring port placement in worldgen (placement, template `orbitRadiusRange`, determinism tests) | — |
| #25 | sim | `feat(sim)`: geometry-aware lane topology + proportional voyage ticks (MST + non-crossing fill, `voyageTicksPerUnit`, planarity tests, E2 spec correction) | #43 |
| #34 | ui | `feat(ui)`: tintable SVG icon set + ADR + credits (vendored icons, header swap, gold semantics) | — |
| #44 | ui | `feat(ui)`: orrery map rendering (star, rings, planet discs, archetype palette, glow package) | #43, #34 |
| #45 | ui | `feat(ui)`: lane accents + voyage tick labels (port selection, Controlled Ship course, labels on accent only) | #44 |

Sequencing note: E10 runs **before E8/E9** (owner, 2026-07-07) — it touches no economy
code, and the new geometry changes how routes feel, so it should sit under the E8/E9
playtests rather than reshuffle the map after them.
