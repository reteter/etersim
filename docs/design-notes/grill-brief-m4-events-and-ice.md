# Grill brief — M4 Economic events + Aether ice

A **grill brief** is the scenario for a future owner grill: the questions that grill
must resolve, the rails already locked, and the known traps. Written at the
fantasy-roadmap grill (2026-07-16) for whichever orchestrator leads the M4 grills.

**This grill decides:** the shape of the region's first weather — economic events
delivered as *Głos Eteru* dispatches — and the concrete market model of Aether ice.

## Rails (locked, don't relitigate — link, build on)

- Events gradient, level 1: disturbances of production/consumption only — **never a
  threat to ships** (farewell grill 2026-07-15).
- Events enter as **dispatches** under the *Głos Eteru* masthead, Victorian-press
  tone, Polish player-facing text: cause, place, expected duration — **never price
  conclusions**; the player's joy is knowing what it means first (2026-07-16, lock 2).
- Tempo: **days, not ticks** — repositioning must be able to pay; reflexes are not a
  pillar.
- Aether ice breaks exactly **one** market law: it perishes (daily decay in holds
  and markets); osmosis won't carry it (fictional corollary — skiffs don't take
  cargo that dies in transit). Storage arbitrage impossible by nature (2026-07-16,
  lock 3).
- E15 grill addenda (2026-07-16): decay applies in **building stores too** — Holds,
  markets, plant/storehouse stores, no exceptions; and **chain 3 lands here** —
  aether superconductor (electronics + aether ice → eterowy superprzewodnik;
  consumers: industrial + urban), the advanced-logistics chain whose machinery slot
  E15 designs and this epic fills (new good + recipe row + tests + its own
  SAVE_VERSION bump, together with the aetherIce good itself).
- Determinism: event draws and decay flow from the seeded RNG (ADR-0003); readable
  depth (pillar 4): the cause of every price move must be visible.
- Balance work runs on the E11 harness (owner directive 2026-07-15) — the grill
  should assume batch evidence, not hand-tuning.

## Questions the grill must resolve

1. Event vocabulary v1: how many kinds? (flow shock up/down, bounty, blight — per
   good? per port? per archetype?) How do they compose with flow drift (E8) —
   multiplier stacking or replacement?
2. Event lifecycle: telegraphed in advance ("crop reports worry…") or announced at
   onset? Fixed duration shown, or "expected ~2 weeks" with variance?
3. Dispatch surface: the existing notice strip, a gazette panel, or both? Retention
   (an archive of past dispatches?) — and does the dispatch channel get a CONTEXT
   implementation entry now?
4. Aether ice source: production at cold **outer orbits** (orbit radius means
   something economically for the first time) — or archetype-driven? Exactly which
   ports produce, which consume, and why does the region *want* it (consumption
   fiction)?
5. Decay numbers: %/day in market stock vs in holds — same rate? Does decay respect
   determinism cheaply (integer stock — rounding rule)?
6. Does ice interact with events (a heat wave melts faster / a cold snap preserves)
   — or is that coupling deferred to full arcana?
7. Guardrails: which dominance/economy invariants does the E11 harness assert before
   the milestone playtest (e.g. ice routes must not strictly dominate carry trade;
   events must not bankrupt a passive player — the agency guarantee)?

## Acceptance criteria (pre-registered, `world-model-implications.md` W6/W7/W8)

Written before the feature so these land as acceptance criteria, not discoveries — the
window for that closes when M4 starts (`world-model-implications.md` §Honest limits). Each
keeps its falsifier and its named check; an implication without those is lore, per the
register's own admission rule.

- **W6 — there is no separate magic system.** From PRD §Pillars 3 and `CONTEXT.md` Arcane
  good: *"flows through the same market mechanisms as any other good — there is no separate
  magic system."* **False if** any branch in `src/sim` keys on a good being arcane, outside
  the single documented exception (Aether ice's decay, this brief's §Rails). **Check:**
  partly greppable, substantially a review question at wave-check time.
- **W7 — Aether ice cannot be profitably stockpiled.** From `CONTEXT.md` Aether ice:
  *"storage arbitrage is impossible by nature."* **False if** a policy that buys ice and
  waits outperforms one that buys and delivers promptly, on identical seeds. **Check:**
  E11 harness A/B — this states a design intent about strategy, the class no unit test
  reaches.
- **W8 — trade osmosis never carries Aether ice.** From `CONTEXT.md` Aether ice: *"trade
  osmosis won't move it."* **False if** any osmosis pulse whose good is ice. **Check:**
  runtime assertion — absolute, cheap, no Run needed. **Write it the day ice lands** — the
  cheapest check in the whole register, per `world-model-implications.md` W8.

## Traps

- Dispatches that state conclusions ("prices will rise!") — the lock forbids it;
  the *reader* does the pricing.
- Event pile-up: multiple simultaneous events turning the region into noise —
  consider a concurrency cap; the world should talk, not scream.
- Ice as a super-good: perishability must genuinely hurt (the Victorian ice trade
  priced melt into the margin) — if a standard route carries it loss-free, the law
  isn't being broken visibly enough.
- The agency guarantee (#122 precedent): no event may create a dead state — slow
  down, never kill.

## Inputs

- PRD §M4 (Economic events, Aether ice), §Long-term fantasy (Events gradient,
  Arcana split as amended), fantasy-roadmap-grill-2026-07-16.md locks 2–3.
- E8 spec (flow drift, osmosis) — the machinery events ride on.
- `src/sim/tick.ts` (dayBoundary — where event steps would live), `market.ts`
  (price curve the decay interacts with), #131 (route events — *out of scope* here,
  gradient level 2+).
