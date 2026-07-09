# E12 — Region v2

Feature spec for epic E12 (milestone M3 — Guilds & obligations, [PRD](../PRD.md)). Terms
per [CONTEXT.md](../../CONTEXT.md). Grilled and decided with the owner on 2026-07-09.
Status: **approved (2026-07-09)**.

Grill inputs: M3 grill (contract geometry wants more ports and shortage diversity; owner
raised the port-count question and the neutral-port idea), E10 spec §orbit rings
(ring-packing retry finding and the anticipated recalibration decision).

Scope in one line: HEARTLAND grows to 7–9 ports including exactly one **Free port** (the
sixth archetype — the region's neutral ground), with orrery geometry recalibrated and
E8/E9 calibration tests re-anchored to the new template.

Explicit non-goals: a second region or multi-region anything (PRD Horizon); a second
region template; real orbital motion (parked E5); information fog (parked E6); guilds
themselves (E3 — the Free port's guild meaning is *defined* here but *consumed* there);
save migration (pre-1.0 precedent — old saves and the old playtest seed are invalidated,
a new standard playtest seed is picked after worldgen settles).

## Design

### Why this epic runs first

The E10 precedent, repeated deliberately: geometry lands *under* the playtests that
follow it. E3's contract generator is sized from real distances and E13's storehouse
siting is a geography decision — calibrating them on 5–6 ports and re-calibrating on
7–9 would mean doing the work twice. E12 is small and strictly enabling.

### Port count 7–9

`portCountRange` is template data by design — no ADR freezes it. 7–9 ports gives:
archetype duplicates (two agrarian ports differing only by jitter — the first time the
player compares *siblings*), longer hauls, more simultaneous shortages for the E3
generator to read, and a real choice of guild geography. Known cost: ring packing (see
Tech) and invalidated calibrations (see Testing).

### The Free port

The sixth Port archetype (glossary: Free port). Exactly one per region.

- **Economy**: no production, light balanced consumption (stock breathes, no gradients
  originate here), price bias 1.0 across all goods (no jitter — neutrality is the
  identity), docking fee ₸10 (mid-table).
- **Meaning (consumed by E3/E13)**: no guildhouse, no contracts originate here; the one
  port where *any* guild building may be built. The design value is contrast: a place
  outside every guild's geography makes "whose turf do I operate on" a real question.
- **Fantasy**: an entrepôt — a crossroads harbor that lives off passage, not production.

## Tech

### Template & archetypes (`src/sim/template.ts`, `region.ts`, `goods.ts` untouched)

- `PortArchetype` union += `"freeport"`. `HEARTLAND.portCountRange` → `[7, 9]`.
- Worldgen guarantees **exactly one** freeport per region: `drawArchetypes` assigns one
  freeport slot outright, the remaining ports draw from the five weighted archetypes as
  today (the freeport is not in the weights table).
- `ARCHETYPE_PROFILES.freeport = { productionPerDay: {}, consumptionPerDay: { grain: 6,
  textiles: 2 } }` (tuning ≠ spec drift; the intent is "breathes, but originates no
  gradient").
- `ARCHETYPE_BIAS.freeport` = 1.0 for every good; worldgen skips the per-port jitter for
  freeports (bias exactly 1.0 — neutrality is exact, not approximate).
- `DOCKING_FEE.freeport = 10`.

### Orrery recalibration (`src/sim/worldgen.ts`)

- Widen `orbitRadiusRange` (candidate `[0.14, 0.48]`) and retune `MIN_PORT_DISTANCE` so
  9 rings pack with an acceptable placement-retry rate. The E10 spec explicitly
  anticipated this as an owner decision — this epic is that decision.
- The bounded-retry guard from #43 stays; recalibration only moves constants.
- Sample-based test: over N seeds (e.g. 500), worldgen succeeds without hitting the
  hard retry cap; retry rate stays under a stated bound (constant in the test).

### UI (`src/index.css`, icon per ADR-0006)

- Archetype palette gains the freeport design token (neutral grey-gold reads well
  against the five existing hues; final value is tuning); tintable monochrome icon via
  the ADR-0006 pipeline (candidate motif: a signal beacon / harbor lantern);
  archetype label shown in PortPanel as for the other five.

### Docs sync

- CONTEXT.md: Port archetype + Free port entries (done live at the grill sweep — verify).
- PRD M3 bullet links this spec (done in the same sweep — verify).
- After merge: pick and record the new standard playtest seed (used by E3/E13 guardrail
  tests and manual playtests).

## Testing

- Worldgen invariants: port count within `[7, 9]`; exactly one freeport; freeport bias
  exactly 1.0; determinism (same seed ⇒ identical region).
- Placement: retry-rate sample test (bound asserted).
- Re-anchoring, explicitly in scope: E8 autonomy/dominance suites and the E9 economics
  guardrail re-run against the new template — updating their expectations **is part of
  this epic**, not drift. M2 success criteria must still hold on HEARTLAND v2.
- Playwright: map renders 7–9 ports with rings; freeport disc/icon/label render;
  PortPanel shows the freeport archetype.

## Issue cut (proposal — file on spec approval)

| Track | Scope | Depends on |
| --- | --- | --- |
| sim | `feat(sim)`: freeport archetype + HEARTLAND v2 template + worldgen guarantee | E9 shipped |
| sim | `chore(sim)`: orrery recalibration + placement sample test + E8/E9 test re-anchoring | template issue |
| ui | `feat(ui)`: freeport palette token, icon, labels | template issue |
