# E3 — Contracts & guilds

Feature spec for epic E3 (milestone M3 — Guilds & obligations, [PRD](../PRD.md)). Terms
per [CONTEXT.md](../../CONTEXT.md). Grilled and decided with the owner on 2026-07-09.
Status: **approved (2026-07-09); refreshed at the 2026-07-14 spec-currency grill**
([grill record](../design-notes/e3-spec-refresh-grill-2026-07-14.md)) — Professor
findings B/C folded in, upkeep insolvency gap resolved, guardrail seeds pinned.

Grill inputs: M3 grill (owner's core reframe: contracts are *continuous* — "keep doing X
for at least Y", not "do X by Y" — and loss-leaders played for reputation are the
fantasy), PRD v3 statement, parked hook "Company running costs" (upkeep precondition —
legible costs — shipped with the E9 Ledger), 60-tick lane distances on the playtest seed
(owner input: contract cadence must be sized from real geometry).

Scope in one line: five per-archetype guilds with guildhouses offer continuous freight
contracts — quota per settlement period, flat fee per met period, reputation as the only
consequence — read from real shortages and settled from the Ledger; plus daily ship
upkeep.

Explicit non-goals: guild ships or simulated guild trades (institutions, not agents —
the E8 no-agent decision extends); contract types beyond continuous freight (one-shot
errands, escort, passengers); price negotiation or dialog systems; guild-vs-guild
rivalry; recurring guild dues (rejected at the grill: they double-tax the loss-leader
relationship); thaler penalties of any kind (reputation is the only currency of
consequence — no-debt precedent); information fog (offers are fully visible, M2 stance);
route wait/price conditionals ([design-notes/route-conditionals.md](../design-notes/route-conditionals.md)
— parked, its own grill); guild buildings and permits' *consumption* (E13 — ranks only
gate them here); crew wages (parked); save migration (pre-1.0).

## Design

### Guilds: institutions, not agents

Five guilds, one per non-freeport archetype, each with a **domain** — the good its
archetype produces (per `ARCHETYPE_PROFILES`):

| Guild (working name, tunable flavor — Polish per the 2026-07-14 UI-language lock) | Archetype | Domain good |
| --- | --- | --- |
| Gildia Spichlerzy (Granary Guild) | agrarian | grain |
| Zgromadzenie Tkaczy (Weavers' Assembly) | urban | textiles |
| Bractwo Solowarów (Saltworkers' Brotherhood) | mining | aetherSalt |
| Liga Odlewników (Foundry League) | industrial | electronics |
| Konsorcjum Żywodrzewu (Livingwood Consortium) | verdant | timber |

A guild has a **guildhouse** at every port of its archetype (world-side, NPC-owned —
the region's first institutions with addresses). Guilds own no ships, make no trades,
and read the same living economy the player reads: everything they do is a pure,
deterministic function of world state.

### Enrollment: five separate decisions

Joining a guild requires a founded Headquarters (companies deal with guilds; lone
shippers don't) and a one-time **enrollment fee**, paid via a command — paperwork, no
ship presence (the founding precedent). Enrollment grants rank 1 and makes the guild's
offers visible on the contract board. With limited early thalers, *which guild to join
first* is the opening M3 decision: it picks whose geography you start building.

### Ranks: four steps, discrete on purpose

Rank is the facade over hidden progress points (the same design move as settlement
periods and E9's ranks-not-curves precedent: discrete thresholds are *visible*):

- Points per guild: settled period **+1**, missed period **−1**, breach or resignation
  **−3**; floor at 0.
- `RANK_THRESHOLDS = [0, 4, 10, 18]` → rank 1–4 derived from points (never stored —
  derived state can't drift). Ranks fall when points fall.
- Rank gates **contract tiers** (higher tiers: bigger quotas, longer terms, better
  fees) and — consumed in E13 — **building permits**.
- Rank-up/down is announced in the UI (a beat, not a silent stat).

### Contracts: continuous obligations read from real shortages

A contract offer is generated, never authored: at each day boundary a guild looks at
ports of its archetype whose stock of some good sits far below Equilibrium (beyond a
threshold), and posts an offer to *keep supplying it*:

> deliver ≥ **quota** units of **good** to **port** per **settlement period** of
> **L world days**, for at least **K periods**; flat **fee** per met period.

- **Feasible by construction** (owner input — 60-tick lanes): the generator computes
  what the player would: nearest viable source of the good (net-producer or cheapest
  ask), round-trip `shortestCourse` ticks, hold capacity. Period length ≥ 2× the best
  round trip; quota ≤ ~70% of what one ship can haul in a period. The offer *shows its
  basis* ("expected ~2 trips/period, nearest source: …") — the player sees the guild's
  arithmetic, not a dice roll.
- **Offers live causally**: each guild keeps up to 2–3 open offers; an offer is
  withdrawn at the day boundary if its shortage healed (osmosis, the player, anyone).
  The board is a barometer, not a quest log.
- **No artificial cap on active contracts**: fleet capacity and reputation risk
  self-regulate better than a counter.
- Distance is the difficulty axis: higher tiers reach further and last longer — the
  bet against the living market gets genuinely riskier.

### Fulfilment and settlement

- **Qualifying units**: any sale of the contract good at the target port by the Company
  — manual or routed, same quotes, same purse (the E9 equivalence guarantee extends:
  contracts add no special math to trades).
- At each period's final day boundary: quota met → fee paid (Ledger `contractFee`) +1
  point; missed → no fee, −1 point. **Two consecutive missed periods → the guild
  terminates the contract** (breach, −3). The player may **resign at any time** at the
  same −3 cost, shown before confirming — an obligation, not a trap.
- The market pays bid for the goods as in any sale; **the market pays for goods, the
  guild pays for reliability, reputation prices history**. A contract whose fee doesn't
  cover the loop's spread-and-fees loss can still be rational — that loss, held
  knowingly, is the loss-leader play the epic is built around.
- **No waiting mechanics** (locked at this grill): ships on Routes execute orders and
  depart; fulfilment is read from the Ledger after the fact. No contract ever tells a
  ship to stay.

### Upkeep: the cost of existing

A flat daily fee per ship (`upkeep` Ledger kind), charged at the day boundary. **Upkeep
never takes the purse below the Reserve (₸500, the same `CONSTRUCTION_RESERVE`)**: the
charge is `min(fee, max(0, purse − RESERVE))`, and whatever cannot be paid simply
evaporates — no debt, no penalty, no arrears. A ship costs thalers even when idle: fleets should sail or
shrink, and "does the third hull pay for itself" becomes a break-even question, not just
a margin question. Calibration principle (tuning ≠ spec drift): **a lone starter ship
stays comfortably viable** — upkeep lands only now because the E9 Ledger finally makes
it a legible line, not an unexplained penalty.

**Resolved (2026-07-14 grill; was the named gap from the #122 grill):** upkeep is a
*standing* drain — reachable by inaction — so it must not be able to kill (agency
guarantee: the game may slow down, never die). The Reserve extends its meaning: "no
construction spend crosses ₸500" becomes "no construction spend *and no standing cost*
crosses ₸500". Below the Reserve, upkeep goes unpaid with no consequence; trading is
always affordable again. Docking fees stay as shipped (`min(fee, purse)`, outside the
Reserve) — docking is an active player choice, not a standing cost. CONTEXT.md Reserve
and Upkeep entries carry the clause.

### UX skeleton

- **PriceBoardOverlay grows tabs**: **Ceny** (today's board, unchanged) and
  **Kontrakty** — same overlay, same `B` hotkey; the board becomes the region's
  economic surface. Kontrakty lists: open offers of enrolled guilds (row: guild badge,
  good → port, quota/period, periods, fee, basis line) and active contracts (period
  progress "42/50 — settles in 2 d", consecutive-miss warning, resign button with the
  cost stated).
- **PortPanel gains a guildhouse section** at guild-seat ports: guild name + icon,
  enroll button with fee (disabled pre-Headquarters or when unaffordable), rank badge
  and points progress once enrolled.
- Rank changes and settlements surface on a **persistent notice strip** (2026-07-14
  UI grill — the previously cited "save/load toast pattern" never existed): the UI
  derives notices from Ledger events appended since a `lastSeenTick` (immune to
  tick-folding at speed), shown as a compact strip with a count badge, click → the
  board. Settlement outcomes are visible in the Ledger via the `settlement` kind
  (met **and** missed). Settlement day stays a "look at the board" beat at 10×/100×.

## Tech

### Guild state (`src/sim/guild.ts`, new)

- `type GuildId = EconomicArchetype`; `GUILDS: Record<GuildId,
  { name: string; domain: GoodId }>`. (`EconomicArchetype` = the five producing
  archetypes, split from `PortArchetype` in E12 — a Guild exists per economic archetype,
  never at the Free port.)
- `Company.guilds: Partial<Record<GuildId, { points: number }>>` — enrolled iff key
  present; rank derived via `rankOf(points)` (pure; `RANK_THRESHOLDS = [0, 4, 10, 18]`).
- Constants (tuning ≠ spec drift): `ENROLLMENT_FEE = 400`; `UPKEEP_PER_DAY = 10`;
  points deltas `+1 / −1 / −3`; `OFFERS_PER_GUILD_MAX = 3`;
  `SHORTAGE_THRESHOLD = 0.5` (stock < threshold × equilibrium qualifies);
  period slack `≥ 2×` round trip; quota slack `≤ 0.7×` single-ship throughput.

### Contracts (`src/sim/contract.ts`, new)

- `ContractOffer = { id, guildId, portId, good, quotaPerPeriod, periodDays, minPeriods,
  feePerPeriod, tier, basis: { sourcePortId, roundTripTicks, expectedTrips } }`;
  `World.contractOffers: readonly ContractOffer[]`.
- `ActiveContract = offer fields + { startTick, periodIndex, deliveredThisPeriod,
  consecutiveMisses }`; `Company.contracts: readonly ActiveContract[]`.
- New Commands (all player mutations stay Commands — determinism + E11 replay):
  `enroll(guildId)` (rejected without Headquarters / already enrolled / unaffordable),
  `acceptContract(offerId)` (rejected unless enrolled at rank ≥ tier),
  `resignContract(contractId)`. Invalid commands drop unchanged.
- Sale attribution: the sell paths (manual command + docking-phase route sell — both
  already share one code path per E9) increment `deliveredThisPeriod` of matching
  active contracts (good + port). The generator never emits two open offers for the
  same (good, port); asserted.
- Generation & expiry run at the day boundary. RNG isolation (2026-07-14 grill —
  Professor finding B): `deriveSubstream(state, tag)` in `rng.ts` hash-mixes the
  world RNG state with a per-consumer tag; the drift step consumes
  `deriveSubstream(rng, "drift")` and the main stream advances exactly once per
  boundary (test-pinned). **As shipped (#93), the generator itself is fully
  deterministic** — largest-shortfall selection with canonical tie-breaks, zero
  draws — so the `"offers"` substream is *reserved*, not consumed; derive it only
  when generation gains a random element. Offers are deterministic functions of
  (world state, day) — ADR-0003 extended, not challenged.

### Tick day-boundary order (extends E8/E9)

**Enabling refactor (2026-07-14 grill — Professor finding C):** the day-boundary
sequence, today inline in `tick()`, is extracted first into a pure named phase
`dayBoundary(world)` — a behavior-preserving `refactor(sim)` issue merged before the
E3 sim wave (proof: byte-equal Ledger on a seed sample). The ordering law then has a
single home to be asserted in, and E3 phases slot into a named seam instead of a
growing inline block. The `deriveSubstream` helper lands in the same refactor issue
(pure addition, unit-tested, consumed from #93 on).

Within `dayBoundary`, deterministic order: drift step → price snapshots → **upkeep**
→ **contract settlements** → **offer refresh** → netWorth snapshot (the E9 snapshot
stays last, so the day's fees and fines are inside the day's curve point).

### Ledger (`src/sim/ledger.ts`)

- Kind union += `enrollmentFee` (guildId), `contractFee` (guildId, contractId),
  `upkeep` (shipId), and `settlement` (contractId, guildId, met/missed, points
  delta — 2026-07-14 UI grill: the audit trail must carry the *missed* outcome too;
  the notice strip and E11 read it). Emitted at the point of mutation, as E9 mandates.
- Contract fulfilment counters are state, the Ledger is the audit trail — settlement
  math must be recomputable from `trade` events (asserted by test).

### Store & UI (`src/store/gameStore.ts`, `src/ui/`)

- `PriceBoardOverlay.tsx` gains the tab shell (Ceny/Kontrakty; the E9 LedgerOverlay tab
  pattern); Kontrakty tab renders offers + active contracts from selectors.
- `PortPanel.tsx` gains the guildhouse section (enroll action dispatches the Command;
  rank badge from `rankOf`).
- Transient notices for settlement results and rank changes (existing toast pattern).

### Docs sync

- CONTEXT.md Guilds & contracts section (done live at the grill sweep — verify).
- PRD M3 (done in the same sweep — verify).
- E9 spec: no changes needed (equivalence guarantee referenced, not amended).

## Testing

- Sim (Vitest, TDD):
  - **Determinism**: same seed + same command script (incl. enroll/accept/resign) ⇒
    deep-equal world, byte-equal Ledger, identical offer sets after N days.
  - **Feasibility invariant** (property test over a seed sample): every generated offer
    satisfiable at its stated basis by one 50-hold ship with slack.
  - **Settlement paths**: met / missed / two-consecutive-miss termination / resignation;
    points and derived ranks move exactly per table; floor at 0; fee only on met.
  - **Attribution**: manual sale and routed sale count identically (equivalence
    extension); sales at other ports/goods never count; settlement recomputable from
    `trade` events.
  - **Offers**: causal expiry when stock recovers; ≤ max per guild; no duplicate
    (good, port) offers; tier gating on accept.
  - **Upkeep**: per ship per day, `min(fee, max(0, purse − RESERVE))` — never crosses
    the Reserve, unpaid remainder evaporates; own Ledger kind; charged before
    settlements (order asserted via netWorth).
  - **Save/load** round-trips guilds, points, offers, active contracts.
  - **Loss-leader guardrail** (2026-07-14 grill — the #115 lesson: a single-seed
    guardrail is an untested generality claim): scripted strategies tailored to **2–3
    explicitly pinned seeds — seed 1 among them** (the seed that bit #115), each with a
    comment saying why it was pinned; on each, one modestly unprofitable contract loop
    reaches rank 2 while staying solvent — the epic's core promise, encoded. Generality
    is carried by the feasibility property test's seed sample, not by these scripts.
- UI (Playwright E2E): enroll from a guildhouse PortPanel section (disabled
  pre-Headquarters); offer appears on the Kontrakty tab with basis line; accept → active
  contract with period progress; resign shows the cost and executes; settlement notice
  fires in a seeded fast scenario; upkeep rows visible in the Ledger overlay.
- Manual playtest: does the first enrollment feel like picking a side; does a
  loss-leader feel like an investment (rank progress visible enough); does settlement
  day create a rhythm at 10×; is upkeep felt but fair with 1 vs 4 ships.

## Issue cut (proposal — file on spec approval)

| Track | Scope | Depends on |
| --- | --- | --- |
| sim | `refactor(sim)`: extract `dayBoundary(world)` + `deriveSubstream` helper (behavior-preserving; byte-equal Ledger proof) | — (merges before the wave) |
| sim | `feat(sim)`: guilds, enrollment, points/ranks (`guild.ts`) | E12 |
| sim | `feat(sim)`: offer generator + causal expiry (`contract.ts`) | guilds issue |
| sim | `feat(sim)`: accept/resign, sale attribution, settlements, Ledger kinds | generator issue |
| sim | `feat(sim)`: ship upkeep (day-boundary charge + Ledger kind, Reserve floor) | dayBoundary refactor |
| ui | `feat(ui)`: PriceBoardOverlay tabs + Kontrakty tab | settlements issue |
| ui | `feat(ui)`: PortPanel guildhouse section + rank/settlement notices | guilds issue |
| tests | `test(sim)`: feasibility property test + loss-leader guardrail | settlements issue |
