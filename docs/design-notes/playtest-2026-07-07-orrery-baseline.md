# Playtest 2026-07-07 (evening) — orrery baseline after #46/#47

Owner playtest right after merging #46 (orbit-ring placement) + #47 (SVG icon set),
seed `playtestorb`, main at 6c9208c. Terms per [CONTEXT.md](../../CONTEXT.md);
Analyst hat per [personas/ANALYST.md](../personas/ANALYST.md).

Status: **triaged 2026-07-07 (inline, same session)** — routing locked with the owner:
item 1 → #44 + #25 (dispatched); item 2 → E8 (no action now); item 3 → small UI issue
(filed same day); item 4 → parked as E8 grill input (starting-capital calibration).

---

## 1. Orbital geometry works but does not read as a planetary system yet

Screenshot: `tmp/ss/gamestate20260707_3.png`.

Owner first thought the placement had not shipped ("worlds laid out as before, no
star"). **Verified in sim** (temporary assertion, deleted after): for seed
`playtestorb` the five port radii from (0.5, 0.5) are exactly 0.18 / 0.25 / 0.32 /
0.39 / 0.46 — the spec's evenly spaced rings, to 4 decimals. The geometry is live.

- Cause: **presentational by design** — the star, drawn rings, planet discs and
  palette are #44; non-crossing thin lanes are #25/#45. Without the visual layer the
  concentric layout is invisible; the old thick crossing lanes dominate.
- Takeaway: #44 is what delivers decision A's value to the player; supports running
  #25 and #44 in parallel (disjoint sim/ui packages) right after triage.

## 2. Economy still saturates — known, expected, owned by E8

Screenshot: `tmp/ss/gamestate20260707_4.png` (Palegate, Urban): 4 of 5 goods at
stock 0 / ceiling prices, Textiles at cap / floor. Exactly
[playtest §4](playtest-2026-07-07-market-legibility.md) — root cause unchanged
(`src/sim/market.ts`: constant flows, no price feedback, monotonic drift to
attractors). Not a regression; E10 touches no economy code. Fix = **E8 Living
economy** (locked in PRD, not yet spec'd).

## 3. Flat-trend `– ₸40` still reads as a negative price — loose thread

Same screenshot. Known item ([playtest §1](playtest-2026-07-07-market-legibility.md))
flagged as a "quick win inside E10/E2 polish" — but it has **no GitHub issue**, so it
is currently tracked nowhere actionable. Triage: file a small `type:feat area:ui`
issue (or fold into #45's label work).

## 4. Early-game pacing: hold vs. capital vs. price ladder (owner observation)

Owner strategy: start with the cheapest good (grain) → Buy max → Sell max → climb to
pricier goods. Owner suggestion: bigger starting hold, or region-wide higher prices.

**Verified numbers** (`src/sim/world.ts`, `src/sim/goods.ts`, `src/sim/market.ts`):
`STARTING_THALERS = 500`, `STARTING_HOLD = 50`; base prices grain 10 / textiles 40 /
aether salt 60 / electronics 150 / timber 250; price band 0.25×–4× base.

- A full hold of grain at base price costs exactly ₸500 — the whole starting capital.
  Every other good is **cash-bound, not hold-bound**: full hold of textiles = ₸2,000
  (4× starting cash), timber = ₸12,500 (25×). So a bigger hold would change little
  early on; the binding constraint is capital. "Region-wide higher prices" would make
  affordability *worse* while widening absolute spreads — likely not the intended
  lever either. The direct lever for pacing is `STARTING_THALERS` (or cheaper first
  rungs of the ladder).
- Classification: **balance** — the cheap→expensive ladder itself is a progression
  arc (arguably good design); the friction is pacing, amplified by item 2 (pinned
  extreme prices make the ladder deterministic and waiting free).
- Routing recommendation: **parking lot → E8 grill input.** Retuning starting
  capital/hold now would calibrate against the broken economy; elasticity + osmosis
  will reshape spreads anyway. Calibrate starting capital/hold as part of E8's
  balance pass, with this observation as the driving scenario.

---

*(Collecting; more items may be appended before triage.)*
