# Playtest 2026-07-12 — seed `watermelon` (fresh eyes: first outside player)

First playtest by someone outside the process: the owner's brother (Kacper — this
machine's owner), no prior exposure to specs, grills or the glossary. Protocol: no
prompting during play; his notes are unmodified (`playtest-Kacper-seed-watermelon.md` —
raw player log, Polish, kept verbatim as source material; item numbers below refer to
it). Screenshots: `tmp/ss/playtest_kacper-watermelon_1..3.png` (local-only; `tmp/` is
gitignored). Build: `main` @ 3463a3a — the first session ever to exercise the
Headquarters UI (#119). Terms per [CONTEXT.md](../../CONTEXT.md); process per
[WORKFLOW.md](../WORKFLOW.md).

Why this session matters: the owner cannot test Pillar 4 ("readable depth") on himself —
he always knows why a price moved. This is the project's first true legibility
measurement, and it reached Day 44, Price Board discovery, HQ founding and a route
attempt with **zero tutorial**. The funnel works; the labels on it mostly don't (yet).

---

## Finding of the session: construction softlock (item 14) → #122

> **Resolved → spec (#122 grill, 2026-07-12):** agency guarantee locked (the game may
> slow down, never die — a dead state is a defect); universal construction **Reserve**
> (₸500 = starting capital) across founding / labor fee / auto-draw / rush; upfront
> estimate + confirmation on placing a Build Order (`computeBuildEstimate`); no
> recovery mechanic needed. See E9 spec §The Reserve, CONTEXT.md (Reserve), final
> acceptance criteria on #122. The manual fee-drain pathology is parked as E3 grill
> input (E3 spec §Upkeep, #95); the stockpile/investment-policy idea raised at the
> grill is parked as its own issue.

Dead state on Day 44: **₸0, hold 0/50, ship docked** — no income-generating action
exists from there. Verified against code: `runBuildSiteAutoDraw` never overdrafts but
has no reserve floor (`src/sim/building.ts:200` stalls silently only *after* spending
the last thaler), and `placeBuildOrder` gives no upfront cost estimate. This is the
default new-player path, not an edge case — and E3's daily ship upkeep (#95) will make
it strictly easier to reach. **Owner decision: grill in a fresh session** against the
E9 spec and ADRs before any fix; candidate directions are listed on the issue. Also
grill-input to E3 (insolvency design vs the no-debt precedent).

## Routing table

| Item | Observation (player's words, abridged) | Classification | Home |
|------|----------------------------------------|----------------|------|
| 14 | hardlock: no money, no way out, no cost warning | **design defect** — softlock | [#122](https://github.com/reteter/etersim/issues/122) (grill first) |
| 1 | "small ships" shouldn't move during pause | legibility ×2: pulses read as ships; animate on wall-clock during pause | [#72](https://github.com/reteter/etersim/issues/72) (comment) |
| 3 | speed resets to initial after actions | UX bug (likely auto-pause resumes at 1x) | [#123](https://github.com/reteter/etersim/issues/123) |
| 5 | can't buy grain despite stock + money | legibility: binding constraint (hold full) never shown | [#124](https://github.com/reteter/etersim/issues/124) |
| 8 | no visible info about docking fees | legibility: fee only surfaces post-hoc in Ledger | [#125](https://github.com/reteter/etersim/issues/125) |
| 6 | click outside Price Board should close it | UX polish | [#126](https://github.com/reteter/etersim/issues/126) |
| 2 | trend triangles misread as "vs initial price"; `=` opaque | legibility: trend semantics undocumented in UI | [#127](https://github.com/reteter/etersim/issues/127) |
| 11–13 | HQ unexplained; money vanished into auto-draw; wants to ship cheaper materials in | legibility: `autoDraw` **is** ledgered (`building.ts:209`) but undiscoverable; `deliver` order exists but was never found | [#128](https://github.com/reteter/etersim/issues/128) |
| 4 | auto-pause on arrival "makes sense" at high speed | **positive** — feature validated by a player who didn't know it was a feature | — |
| 7 | hold upgrade "so the game has a goal" | independent request for a parked idea (+ progression rationale) | PRD Horizon: *Ship upgrades* (annotated) |
| 10a | route creation too complicated; wants map-click editing | independent request for a parked hook | M2 parked hooks: *map-drawn route editing* |
| 10b | "buy below average, sell above average" automation | conflicts with the E9 route-rot law (no price conditionals) — new data point, not work | [route-conditionals.md](route-conditionals.md) (annotated) |
| 13 | send ships to fetch cheaper materials | independent invention of a parked idea | PRD Horizon: *Supplier ships* (annotated) |
| 9 | ship icon should be a spaceship, not a watercraft | identity gap, not an icon bug: sailing ships on the aether is the *point* (Pillar 3), but nothing in-game says so | parking lot (below) |

## Parking lot (new, ungrilled)

- **Aether-punk identity is not self-communicating** (item 9): the first fresh player
  read the setting as generic space and the sailing-ship icon as a mistake. The fiction
  ("the ocean between worlds", ADR-era vision) exists only in docs. Candidate homes:
  flavor text at first launch, port descriptions, good tooltips — deliberately unscoped;
  needs a grill before anything ships. Not an issue yet by design.

## Meta

- Fresh-eyes protocol worked: unprompted play surfaced one design defect, six actionable
  UI gaps and three independent validations of parked ideas in a single session. Worth
  repeating each milestone with any available outside player.
- Three of his suggestions (7, 10a, 13) are already parked hooks — independent
  reinvention is the strongest cheap signal those hooks are real. Annotated in place
  rather than re-opened; they still enter a version only through a grill.

---

*(Session 2026-07-12, second fresh-eyes-capable session on this machine. Raw log
committed alongside this note; screenshots remain local per `.gitignore`.)*
