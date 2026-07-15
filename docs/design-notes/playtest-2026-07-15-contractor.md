# Playtest 2026-07-15 — seed "contractor" (contracts & guilds shakedown)

Owner playtest, ~125 in-game days on seed `contractor`; first real field run of
the E3 systems. Analyst triage: every observation verified against code (and
one against the owner's exported save via a Playwright probe) before
classification. Screenshots in `tmp/ss/playtest-contractor_20260715_*.png`;
save `tmp/ss/etersim-contractor-day120.json` (local only, `tmp/` untracked).

## Headline: rank/tier progression deadlock — GRILL, top priority

Observations 4+5 turned out to be one structural finding, confirmed in code
and on the save:

- Offer tier is banded from **geography**: round-trip ticks to the nearest
  source (`bandTier`, contract.ts:82 — ≤90 → 1, ≤130 → 2, ≤175 → 3, else 4).
- Accept is hard-gated `rankOf(points) >= offer.tier` (commands.ts:351).
- Points (+1) come only from met settlements; rank 2 needs 4 points
  (guild.ts RANK_THRESHOLDS).

Nothing guarantees a tier-1 offer exists for a guild — if all its shortage
ports have distant sources, a rank-1 member can **never earn the first
point**. On this seed both joined guilds are deadlocked (weavers: offers
tier ≥2; verdant: tier ≥3; screenshot _2 shows rank 1, 0/4 pts, offers
demanding ranks 3–4). The mainline E3 loop is unplayable on this seed.

Grill options (to weigh, not pre-decided): guarantee a tier-1 offer per
guild; rank gates rewards/fee multipliers instead of access; tier derived
from commitment (quota/minPeriods) rather than distance; introductory
"apprentice" contracts. Routes into the cluster-B grill (or a dedicated
mini-grill before it — owner's call on timing).

## Routed to issues

| Obs | Finding | Route |
| --- | --- | --- |
| 3 | Enroll button LOOKS disabled while live — `.guildhouse-enroll-btn` has only a `:disabled` CSS variant; base state inherits browser-default styling. Diagnosed empirically: Playwright probe on the owner's save clicked the "greyed" button and enrolled. Reason also tooltip-only (undiscoverable on disabled buttons). | **#216** (bug) |
| 1 | Keybind `<g>` — sail active ship to selected port (composes with `<b>`). | **#217** |
| 7 | Keybinds `<,>`/`<.>` — cycle overlay tabs. | **#218** |
| 6 | Kontrakty offers: oversized spacing, separator-only division → card/tile per offer. | **#219** |
| II | Route editor: buy/sell/deliver buttons repeated per good → goods × actions table. | **#220** |
| — | Owner suggestion: export filename should carry the seed (`etersim-<seed>-day<N>.json`). | **#221** |

## WAD (working as designed) — with UX riders

- **Obs 2 — Saltmere grain frozen at 0**: urban port consumes grain
  (eq 300), produces none; consumption stops at stock 0 (market.ts:148,
  unmet demand lost). Chronic shortage is deliberate contract fodder (E3) —
  except the deadlock above prevents servicing it. Mechanics correct;
  reward loop broken (see headline).
- **Part II — ship build stuck at grain 0/100**: HQ sits at Saltmere, so
  auto-draw pulls from a market that never has grain; "Rush the rest — ₸0"
  is greyed because there is nothing to rush-buy. WAD — the unblock is
  hauling grain to the HQ port (Kruxhaven holds ~2145u) — but the Budowa
  view explains none of this. Concrete case commented onto **#128**
  (HQ must explain its own mechanics).
- **Obs 4 (discoverability half)** — contracts living as a Price Board tab
  wasn't obvious. No separate issue: the notice strip (#97) routes there on
  settlement events, and the deadlock fix will make the tab visited
  naturally; revisit only if it still confuses after both.

## Already tracked

- Obs 8 (osmosis skiffs still chunky) → **#173** (ease motion between
  ticks), unchanged.
- Two-language UI → **#184** sweep (owner confirmed it does not bother him;
  priority unchanged). For the record: the 2026-07-14 grill decided
  player-facing strings are Polish.

## Analyst notes

- The save probe (import owner's export → assert → click) was cheap and
  decisive — worth repeating for any "button/state looks wrong" report.
- The deadlock class (feasibility-by-construction on one axis, geography on
  another, gate coupling them) is exactly what a multi-seed balance sweep
  (#202) would have caught pre-release: "for each seed × guild: does at
  least one acceptable-at-rank-1 offer ever exist?" is a one-line invariant
  over a sweep. Logged as supporting evidence on #202's motivation.
