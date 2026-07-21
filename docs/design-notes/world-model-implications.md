# World model — implications and their checks

A standing register: statements that **must be true if this world is what we say it is**,
each with the observation that would prove it false and the thing that checks it.

Opened 2026-07-19 (s14) at the owner's proposal, prompted by an event described below.

## Why this exists

Every gate this repo runs is a **comparison**. Review compares a diff to acceptance
criteria. Tests compare a result to an expectation. The docs sync sweep compares a spec to
its dependents. The design-surface sweep compares documents to each other. A comparison can
only catch a *disagreement between two things that exist*.

In s14 a corpus measurement silently lost three quarters of its input and reported ten
glossary terms as orphaned. Nothing in that stack objected: not the tests, not the exit
code, not a guard (incident 0020). What objected was a different kind of statement
altogether —

> *This is a world with a currency. A currency cannot have zero mentions.*

That is not a comparison. It is a **prediction derived from the world model and checked
against reality**, and the repo owns no machinery for it. It worked because it happened to
be in someone's head at the right moment, which is not a mechanism.

This register is the attempt to stop relying on that luck.

## What this is not

**Not a lore document.** The rule that keeps it honest:

> An implication earns its place only by naming **what observation would falsify it** and
> **what checks it**. Prose that no implication needs is lore.

Lore is good for the game and useless as a check. The two are easy to confuse because they
are written in the same voice.

**The order is deliberately inverted.** Not *description → implications → verification*, but
implications first, with the description being whatever is needed to justify them. The
reason is a finding this project already paid for: **forward-looking text rots, records do
not** (design-surface-sweep, s13). A world description is a promise about the future, so it
rots. A register of executable checks is self-correcting — when it stops being true,
something goes red.

## What the survey found

The first draft of this note was going to say the project states invariants nobody checks.
**That was false, and checking it is what this note is about.** The structural layer is
already well guarded:

| Claim | Guarded by |
| --- | --- |
| every good has exactly one producing archetype | `src/sim/region.test.ts:27` ("arbitrage invariant") |
| every good has ≥2 consuming archetypes | `src/sim/region.test.ts:36` |
| no archetype consumes what it produces | `src/sim/region.test.ts:45` |
| producers bias below base, consumers above | `src/sim/region.test.ts:82` ("gradient invariant") |
| the lane graph is connected | `src/sim/worldgen.test.ts:132` — and by construction, a Euclidean MST (`worldgen.ts:243`) |
| five economic archetypes + exactly one Free port | `src/sim/worldgen.test.ts:102` |
| same seed + template ⇒ deep-equal region | `src/sim/worldgen.test.ts:28` |

So the gap is **not** "nobody writes invariants here". It is narrower and sharper:

> **Structure is guarded. Dynamics are not.**

Every invariant above is a property of a *static artifact* — a table, a worldgen output —
and therefore checkable by a pure function in a unit test. Not one of them describes what
the world must **do over time**. Those need a Run, and the machinery for Runs is specced
but unbuilt: E11, issues #232 → #234.

That is also the register's practical payoff. **E11 builds the machinery and has no list of
what to assert with it.** This is that list.

## The register

Status vocabulary: **covered** (a check exists today), **verified** (checked by hand or
script, not yet automated), **open** (needs machinery that is not built), **pre-registered**
(the mechanic has not shipped — the check is written before the feature, as an acceptance
criterion rather than an afterthought).

### W1 — The economy moves whether the player acts or not

- **From:** PRD §Pillars 1 — *"The world's economy lives and moves whether you act or not."*
- **False if:** over a Run of N world days with **zero** commands, some port's price for some good never changes.
- **Check:** null-policy Run; assert non-zero price variance at every port.
- **Status:** open (E11). Expected to hold — flow drift steps daily and `marketTick` moves stock every tick — but expectation is not evidence, and this is the pillar the whole game is named after.

### W2 — The player is a participant, not the center

- **From:** PRD §Pillars 1 — *"the player is a participant, not the center."*
- **False if:** over a typical session, region-wide price displacement caused by the player's own trades exceeds that caused by background flows.
- **Check:** two Runs, same seed — one null policy, one trading policy — comparing aggregate displacement.
- **Status:** open (E11). **The likeliest quiet failure in the register:** nothing breaks when it goes false, the game just slowly becomes a solitaire against a backdrop. Related: #102 (buy-store-sell must not dominate carry trade), which guards one instance of this, not the pillar.

### W3 — Every Good has exactly one producer and at least two consumers

- **From:** `docs/specs/E2-trade-loop.md:61` — *"so arbitrage always exists and flows from geography, not scripts."*
- **False if:** a good in `GOOD_IDS` is produced by no archetype or by two, or consumed by fewer than two.
- **Check:** `src/sim/region.test.ts:27,36`.
- **Status:** **covered.** Re-verified by hand s14 — holds exactly for all five goods.

### W4 — The region is connected

- **From:** `CONTEXT.md` — Region is *"the playable map"*. A port you cannot reach is not on the map.
- **False if:** a worldgen output whose lane graph has more than one component.
- **Check:** `src/sim/worldgen.test.ts:132`; guaranteed by construction (Kruskal MST).
- **Status:** **covered.**

### W5 — Aggregate production and consumption stay in band

- **From:** `CONTEXT.md` — Equilibrium (*"production/consumption push stock toward it"*) + PRD Pillar 1.
- **False if:** over a long null-policy Run, some good's stock trends monotonically to the cap, or to zero, at most ports of some archetype.
- **Check:** multi-seed distribution assertion over long Runs.
- **Status:** open (E11 — this is the shape #234's distribution assertion is meant to take, and the natural home for #115's replacement). **Genuinely unknown**, because balance depends on the worldgen *archetype draw weights*, not only on `ARCHETYPE_PROFILES` — so the profile table alone cannot settle it, and no existing test spans enough world days to see the trend.

### W6 — There is no separate magic system

- **From:** PRD §Pillars 3 and `CONTEXT.md` — Arcane good: *"Flows through the same market mechanisms as any other good — there is no separate magic system."*
- **False if:** any branch in `src/sim` keyed on a good being arcane, outside the single documented exception (Aether ice's decay).
- **Check:** partly greppable; substantially a review question.
- **Status:** pre-registered (M4). **Attached as an acceptance criterion** to
  [grill-brief-m4-events-and-ice.md](grill-brief-m4-events-and-ice.md) §Acceptance criteria
  (#325, 2026-07-21) — this entry stays the source of the falsifier/check pair; the brief
  points back here so the two don't drift.

### W7 — Aether ice cannot be profitably stockpiled

- **From:** `CONTEXT.md` — Aether ice: *"Storage arbitrage is impossible by nature."*
- **False if:** a policy that buys ice and waits outperforms one that buys and delivers promptly, on identical seeds.
- **Check:** harness A/B.
- **Status:** pre-registered (M4). This one states a *design intent about strategy*, which is exactly the class no unit test reaches. **Attached as an acceptance criterion** to
  [grill-brief-m4-events-and-ice.md](grill-brief-m4-events-and-ice.md) §Acceptance criteria
  (#325, 2026-07-21).

### W8 — Trade osmosis never carries Aether ice

- **From:** `CONTEXT.md` — Aether ice: *"Trade osmosis won't move it."*
- **False if:** any osmosis pulse whose good is ice.
- **Check:** runtime assertion — absolute, cheap, no Run needed.
- **Status:** pre-registered (M4). The cheapest check in the register; write it the day ice
  lands. **Attached as an acceptance criterion** to
  [grill-brief-m4-events-and-ice.md](grill-brief-m4-events-and-ice.md) §Acceptance criteria
  (#325, 2026-07-21).

### W9 — Every term the glossary defines is spoken somewhere

- **From:** `CLAUDE.md` — *"code identifiers use these terms; new concept ⇒ glossary entry first."* A term nothing speaks is either dead vocabulary or a measurement failure.
- **False if:** a `CONTEXT.md` term with zero occurrences across the corpus and `src/`.
- **Check:** script, **anchored** against a term whose answer is known in advance (incident 0020).
- **Status:** **covered** by `npm run check:glossary`
  (`scripts/check-glossary-anchoring.mjs`, #324, 2026-07-21). Verified s14 by hand — 81
  terms, zero orphans; the automated run lands in the same neighborhood (82 terms, zero
  orphans, corpus grown since s14). This is the implication that paid for the whole idea: it
  would have caught the s14 grep failure automatically, as a violated invariant rather than
  an interesting anomaly someone had to notice. It is now a repeatable command rather than a
  one-off hand count; `ci.yml` does not yet call it (out of #324's stated scope — flagged as a
  suggestion, not done here).

### W10 — Determinism

- **From:** ADR-0003.
- **False if:** the same seed and command sequence produce different worlds.
- **Check:** `src/sim/worldgen.test.ts:28,32`; the golden-run digest queued as **#306** extends it across a full Run.
- **Status:** **covered**, listed so the register is complete rather than because it needs new machinery.

## Tally

| Status | Count | Which |
| --- | --- | --- |
| covered | 4 | W3, W4, W9, W10 |
| open — needs E11 | 3 | W1, W2, W5 |
| pre-registered — M4 | 3 | W6, W7, W8 |

**Read this as a map, not as a report on the build.** Four of ten are covered; three
cannot be checked until E11 exists; three describe mechanics that have not shipped.

## How to add one

Four questions. If any is unanswerable, what you have is not an implication:

1. **Which stated premise does it follow from?** Name the document and line. An implication
   that cannot be traced back is an opinion with a test attached.
2. **What observation would prove it false?** Not "how would we test it" — what would the
   world look like if it were wrong.
3. **What checks it, and does that thing exist?** If it does not, say which milestone builds it.
4. **What does it cost to check?** A check nobody can afford to run is not a check.

## Honest limits

- **This catches silence and divergence, not meaning.** W9 would never have caught F13:
  `elasticity` had plenty of occurrences and two contradictory meanings. Semantic
  contradiction is the design-surface sweep's job, and the two are complements.
- **Pre-registered implications are forward-looking text** — the one kind that rots. W6/W7/W8
  must be attached to the M4 grill brief as acceptance criteria, or this section quietly
  becomes another parking lot, which is the exact defect sweep finding F5 records.
  **This came true within the day** — §Next was itself three prose promises. Now **#325**;
  see §Next for what that cost and what caught it.
- **The register cannot validate its own premises.** If a PRD pillar is the wrong goal, every
  implication derived from it will pass while the game is worse for it. This checks
  *consistency with what we said*, never *whether what we said was right*.

## Next

~~Attach W6/W7/W8 to `grill-brief-m4-events-and-ice.md`; automate W9; hand W1/W2/W5 to
#234.~~ **Superseded the same day it was written** — see below.

This section was three promises in prose, which is precisely the defect
[design-surface-sweep](design-surface-sweep.md) finding **F5** resolved hours earlier, and
which §Honest limits below had already predicted about this very note. Under the resulting
law — *a trigger is a promise, and promises live in the issue tracker*
([WORKFLOW](../WORKFLOW.md) §Documentation law) — each item now has an outflow:

| Item | Where it lives now |
| --- | --- |
| **W6/W7/W8** → M4 grill brief as acceptance criteria | **#325 — done**, 2026-07-21 |
| **W9** → anchored script (incident 0020) | **#324 — done**, 2026-07-21 |
| **W1/W2/W5** → E11 assertion content | **comment on #234**, not a new issue — the obligation already had a home, so it went there |

Recorded rather than quietly fixed, because the note breaking its own stated rule within a
day is the most useful thing it has demonstrated so far: **stating a defect is not the same
as being immune to it.** The register predicted this failure in §Honest limits and then
committed it anyway. What stopped it was not the prediction — it was a law with a detector.
