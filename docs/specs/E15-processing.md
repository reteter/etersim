# E15 — Processing

Feature spec for epic E15 (M4's first epic — the depth engine of the 8–12 h pacing
anchor, PRD §Where 1.0 ends). Terms per [CONTEXT.md](../../CONTEXT.md). Grilled and
decided with the owner on 2026-07-16 (frontier pre-grill — the one (c)-track topic of
the fantasy-roadmap session; all other M4 topics ship as grill briefs).
Status: **approved (2026-07-16** — owner merge of PR #280; issues #281–#284 filed
into milestone "E15 — Processing"**)**.

Grill inputs: [fantasy-roadmap-grill-2026-07-16.md](../design-notes/fantasy-roadmap-grill-2026-07-16.md)
(locks 4–5: Arcana-split amendment, building dichotomy, guild cartel); PRD §M4
(Processing entry); E13 spec (CompanyBuilding union, store/withdraw orders — hard
dependency); #99/E14 ConstructionSite seam (shipped, PR #278); `region.ts`
archetype profiles.

Scope in one line: **Company-owned processing plants** — continuous works that
convert delivered input Goods into **processed goods** the world consumes but never
produces; value-add is created in the plant, profit is created on the route.

Explicit non-goals: **chain 3 (aether superconductor)** — depends on Aether ice and
lands with the events+ice epic (its machinery slot is designed here, its data ships
there); **recipe switching** (a plant's chain is fixed at construction — want another
chain, build another plant); **plant demolition/sale/relocation** (E9/E13 non-goals
stand); **deeper chains** (processed goods as inputs — reserved for M5/M6 growth);
**auto-sell of outputs** (the plant cannot trade); **rush during operations** (rush
exists only while the plant is under construction); **plant upgrades/capacity tiers**.

## Design

### Core: the industry loop

The guilds are a cartel — at each other's throats individually, jointly letting no
outsider near the table (*honour amongst thieves*). They tolerate your construction
(local labor takes a day's wage), but they will not supply a competing industry: the
plant has **no auto-draw in operation** — every input unit arrives aboard a Company
ship (`deliver`), and every output unit leaves aboard one (`withdraw`). **The plant
never spends thalers.** Value-add is created in the plant; profit is created on the
route. A ship docked at the plant's port may buy locally and deliver in place — legal
by design: it costs the ship's time and upkeep (the cartel makes you use *your*
people; it cannot stop you buying).

This is the deliberate asymmetry with the Build Order: **construction auto-draws,
operation does not.** The construction site is local wage labor; the operating plant
is your industry, and the quay between the market and your gate is crossed only by
your own crews.

### The plant — a continuous works

- One Building type, `ProcessingPlant`, **chain fixed at construction** — one
  implementation, chain variants (the E13 Storehouse pattern: variant = recipe +
  skin).
- **At most one plant per port** (per Company); total count unlimited — economics
  limits it (build cost, two supply lines, narrow markets).
- **Siting is free** (any port, no permits — the Company track; the cartel does not
  license what it merely tolerates). Input geography + consumption geography is the
  siting puzzle, with no extra rule.
- Own **input store** and **output store**, finite (tuning). Once per world day the
  plant converts: `output = min(rate, floor(available inputs / recipe), free output
  space)` — integers, deterministic, no RNG.
- Two symmetric, legible stalls: **starved** (PL: *głód surowca* — inputs missing)
  and **backlogged** (PL: *magazyn pełny* — output store full). The panel names the
  active stall and since when (the HQ legibility lesson, #128 family).
- **Daily building upkeep** (same machinery and Reserve clamp as ship upkeep, E3):
  industry should run or hurt the cash flow — the anti-spam is economic, not a cap.
- Construction: a normal Build Order through the ConstructionSite seam
  (commission → site → auto-draw/deliver/rush → opens). Auto-draw dies the day the
  plant opens.

### Chains v1 (owner locks, 2026-07-16)

Flat 2→1 recipes; processed goods are never inputs in v1. Ratios and rates are
tuning; the shape is spec.

| # | Chain | Recipe (first shot) | Output | PL name | Ships in |
| --- | --- | --- | --- | --- | --- |
| 1 | Provisions | 3 grain + 1 textiles → 1 | `provisions` | prowiant | E15 |
| 2 | Clearwood | 2 aetherSalt + 1 timber → 1 | `clearwood` | przezroczyste drewno | E15 |
| 3 | Superconductor | 1 electronics + 2 aetherIce → 1 | (aether superconductor) | eterowy superprzewodnik | events+ice epic |

- **Provisions** — preserved rations; the workaday chain. Fiction: hard-labor ports
  eat tinned, not fresh.
- **Clearwood** — delignified living wood, transparent, UV-blocking, warm (real
  material science with the aether written in): the super-luxury good. Premium hull
  material of the future Expedition — *the player flies into the unknown first
  class* (M5 funnel).
- **Superconductor** — aether ice as industrial coolant; the perishable **input**
  makes it the advanced-logistics chain (fresh, frequent deliveries — ice decays in
  plant stores like everywhere else; decay law owned by the events+ice epic). Its
  machinery slot (ChainId, recipe table row) is designed here; its data, good and
  tests land there.
- Polish vocabulary law (owner, 2026-07-16): **eteryczny** for nature (eteryczny
  lód), **eterowy** for industrial products (eterowy superprzewodnik) — the
  asymmetry is deliberate.

### Processed goods on the market — "listed everywhere, hungry somewhere"

- **Full market citizens at every port**: quotes, spread, trends, Price board
  columns — zero special cases in `market.ts`. Osmosis carries them, flow drift
  moves their flows, storing is allowed. (The only law-breaker in the game remains
  Aether ice, a raw good. The cartel happily *distributes* what it cannot produce —
  the player's exclusivity is productive, not distributive.)
- **No port production, anywhere — ever.** The defining trait of the category: the
  world's only producer is industry, i.e. the player.
- **Narrow consumption — exactly two archetypes per good** (first shot, tuning):

| Good | Consumers | Fiction |
| --- | --- | --- |
| provisions | mining, industrial | shift labor eats tinned |
| clearwood | urban, mining | metropolitan elite; mining magnates (nouveau riche) |
| superconductor | industrial, urban | machinery; institutes (lands with chain 3) |

- **Shortage as invitation**: an unsupplied consumer port sits at near-zero stock
  and ceiling price — the board *standing invitation* that industry would pay here.
  Elasticity works normally: flood a market and the price walks down; narrow
  consumption = bounded absorption = each chain's natural scale ceiling.
- The Free port stays neutral (E12 lock): no processed-good consumption there.

### UI surfaces

- **PortPanel** gains a Processing section (Storehouse-section pattern): commission
  flow with **chain choice** + estimate (the one-per-port gate explained when
  taken); site progress + stall reason + rush while under construction; when
  operating — input/output stores, rate, and the active stall (*głód surowca* /
  *magazyn pełny*) with duration.
- **Route editor**: existing `deliver` chips feed the plant; `withdraw` chips
  (E13 machinery) appear at plant ports for output goods.
- **Price board**: +2 columns (v1). Density stays healthy at 7–9 ports × 7 goods.
- Player-facing strings Polish: *przetwórnia*, *prowiant*, *przezroczyste drewno*.
- Map: no new glyph in v1 — the PortPanel is the surface (map keeps its "check the
  fleet + enjoy" role; the M4 workbench grill owns any board/map growth).

## Tech

> Engineer pass drafted inline by the session driver against the locked grill
> decisions. Nothing here is settled until the spec is approved.

### Goods (`goods.ts`)

- `GoodId` += `"provisions" | "clearwood"` (superconductor + aetherIce land with the
  events+ice epic, own SAVE_VERSION bump there).
- `GOOD_IDS` order stays base-price-sorted; first-shot prices: provisions 120,
  clearwood 650 (top of the ladder — luxury above timber). Value-add first shots:
  provisions ~1.7× raw input cost, clearwood ~1.75× — enough to pay the haul, thin
  enough that carry trade stays alive; E11 calibrates (tuning ≠ spec drift).
- `PROCESSED_GOODS: readonly GoodId[]` — the category marker worldgen and guardrail
  tests key on (no production profile may name a processed good: asserted).

### Region & worldgen (`region.ts`, `worldgen.ts`)

- `ARCHETYPE_PROFILES`: consumption rows per the table above (first shot: provisions
  8/day at each consumer; clearwood 2/day — luxury trickle); production rows —
  **none** (guardrail-asserted).
- `ARCHETYPE_BIAS` rows for the new goods (consumers ~1.25–1.3, others ~1.0–1.1;
  freeport exactly 1.0 as always).
- Worldgen: market rows for processed goods at every port — consumer equilibria
  modest (first shot 40), non-consumer small (15), initial stock 0 (the region
  starts hungry; the invitation is visible from day one).

### Plant model (`processing.ts`, new)

```
ChainId = "provisions" | "clearwood"            // += "superconductor" (events+ice epic)
Chain { id, inputs: Partial<Record<GoodId, number>>, output: GoodId, outputPerDay }
CHAINS: Record<ChainId, Chain>                  // ratios/rates are tuning
PLANT_INPUT_CAPACITY = 60, PLANT_OUTPUT_CAPACITY = 60      // tuning
PLANT_UPKEEP_PER_DAY = 15                                   // tuning
PLANT_RECIPE, PLANT_LABOR_FEE = 400                          // construction; tuning
processDay(plant): { consumed, produced }   // pure: min(rate, inputs/recipe, space)
plantStall(plant): "starved" | "backlogged" | null           // derived, not stored
```

- State: extends E13's `CompanyBuilding` union —
  `{ type: "processingPlant"; chain: ChainId; portId: PortId;
  inputStore: Record<GoodId, number>; outputStore: Record<GoodId, number> }`.
  **Hard dependency: E13 ships the union + store/withdraw first.**
- Conversion runs at the **day boundary** (integer batch — deterministic, no RNG),
  ordered before the `netWorth` snapshot so the day's output counts; plant upkeep
  joins the existing upkeep phase (same `min(upkeep, purse − Reserve)` clamp).
- Commands: `commissionProcessingPlant(portId, chain)` — requires a founded
  Headquarters; rejects a second plant at the port; labor fee up front,
  Reserve-checked; creates a ConstructionSite (#99 seam). No manual "process"
  command — the works run themselves.
- **Deliver targeting rule** (needed once a port can host a site *and* a plant):
  `deliver(good)` fills, in order — (1) the port's active construction site's
  remaining need, (2) the local plant's input store if `good` is one of its chain
  inputs. Deterministic, documented, tested. Withdraw draws from the Company
  building at the port that holds the good — plant **output store only** (inputs
  are committed, the E14 no-cancel precedent; no overlap with Storehouse goods in
  v1 by construction).
- Ledger: `plantBuilt` (thalers = labor fee, grammar law), daily `processed`
  (goods moved, no thalers — the store/withdraw precedent); deliveries and
  withdrawals already have kinds via E13. `netWorth` adds plant stores at mid
  (buildings themselves keep no book value — the honest-dip law).

### Persistence

- SAVE_VERSION 13 (or next free after E13's bump): migration adds market rows for
  the new goods at every port (archetype-table equilibria, stock 0) and their
  `priceBias` **without per-port jitter** (re-drawing worldgen jitter inside a
  migration would touch the RNG stream; migrated saves get exact archetype bias —
  the one documented asymmetry with fresh worlds).

## Testing

- Sim (TDD): conversion math (rate/input/space min; integer exactness); both stalls
  derived correctly; day-boundary ordering (output counted in that day's netWorth);
  commission gates (no HQ / second plant at port / Reserve); deliver targeting
  priority (site before plant; non-input goods rejected by the plant); withdraw
  from output store only; upkeep clamp at the Reserve (agency: a stalled plant
  slows the game, never kills); no processed good in any production profile
  (category guardrail); determinism (same seed + same commands ⇒ deep-equal with
  operating plants); SAVE_VERSION migration (market rows + bias backfill, lossless
  round-trip mid-operation).
- **No-dominance guardrails, two-way** (`e15-guardrails.test.ts`, standard seed):
  a scripted plant strategy must not strictly dominate carry trade **and** carry
  trade must not strictly dominate a competently-run plant — both loops stay alive.
  Calibration evidence comes from E11 batches (E11 ships before E15 tuning
  finalizes — owner directive 2026-07-15).
- E2E (Playwright): commission flow with chain choice; operating panel shows
  stores + stall; board shows the new columns; a route with deliver/withdraw
  feeding a plant executes in a seeded scenario.
- Manual playtest (milestone playtest law): does keeping a plant fed feel like
  orchestration or like a chore; does the first plant's payback read on the Ledger
  chart (visible dip → steeper growth).

## Sequencing & issue cut

Filed 2026-07-16; milestone **E15 — Processing**. Hard order: **E13 → E15** (union +
store/withdraw), **E11 before E15 tuning finalizes** (two-way guardrails need batch
evidence). Chain 3 + Aether ice: the events+ice epic (grill brief ready).

| Issue | Track | Scope | Depends on |
| --- | --- | --- | --- |
| #281 | sim | `feat(sim)`: goods +2, profiles/bias/worldgen rows, SAVE_VERSION bump + migration | E13 shipped |
| #282 | sim | `feat(sim)`: ProcessingPlant — commission, ConstructionSite build, conversion phase, stores, deliver/withdraw targeting, upkeep, Ledger kinds | #281 |
| #283 | tests | `test(sim)`: two-way no-dominance guardrail + agency check | #281, #282 |
| #284 | ui | `feat(ui)`: PortPanel Processing section, route-editor withdraw chips at plant ports, board columns, E2E | #282 |

### Docs sync (with this spec's PR)

- **CONTEXT.md**: *Processing plant* (PL: przetwórnia) entry; *Provisions* +
  *Clearwood* good entries; stall vocabulary (starved/backlogged — głód
  surowca/magazyn pełny); amend the *Processing* entry (spec exists) and the
  *Building* entry (third Company type); record the eteryczny/eterowy law on the
  *Aether ice* entry.
- **PRD**: M4 Processing entry → `procedural`, spec link.
- **Events+ice grill brief**: add the two locks this grill produced for it — ice
  decays in building stores too (no exceptions), and chain 3's recipe/consumers
  land there.
- No new ADR: plants are ordinary Commands + the existing construction and
  store/withdraw grammar — no equivalence or determinism exception anywhere.
