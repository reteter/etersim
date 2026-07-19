# HANDOFF — exportable session-state snapshot

**Updated only when the owner asks** (ceremony decision, 2026-07-16). The date below
is the freshness marker: when it looks stale, trust `git log` and `gh issue list`
over this file. Written for any model in any harness; Claude Code's per-machine
auto-memory is the day-to-day working channel and may be ahead of this snapshot.
Keep it one screen: state → queue → watch. Standing gotchas live in `CLAUDE.md`
(§Git & worktrees), `docs/agent-memory.md`, and `docs/incidents/README.md` §Log —
not here.

_Last update: 2026-07-19 s11 (owner-requested; first Opus-driven orchestration session
after the Fable series — wave shipped, two process fixes from retro). Machine-handoff
bootstrap notes for any new machine (fresh clone, `npm install`, `gh auth login`,
no `scripts/setup.ps1` yet — #239) still apply._

## Running-in, not sanding down (owner framing, 2026-07-19)

We are **breaking the process in with fresh oil, not sandpaper.** The goal is
instructions that are clear, consistent, and **do not collide with the driving model's
trained nature** — where a rule fights the model's grain, the rule is the thing that
gets reshaped, not the model. Fighting a model's trained behaviour or its system prompt
is windmill-tilting: it redirects effort toward "looking correct" instead of doing the
work the project needs.

Practical consequence: **the owner runs an extended retro at session end** and process
tension is a first-class output of a session, ranked alongside shipped code. Two
examples from s11, neither catchable by any verification gate because both described
things that were working, only worse than they could:

- `scripts/postmerge.ps1` was hand-walked by a driver who had just confirmed it
  existed. Fix was **not** a stricter rule — the line now names the three guarantees
  the script encodes (0010 merge-base reachability, 0011 worktree go-signal, 0013 deps
  check), so a hand-walk is allowed and its cost is visible.
- `docs/design-notes/` had reached 36 files with no digest. Fixed by an index plus,
  crucially, the **ritual** that maintains it (WORKFLOW §Documentation law).

Expected payoff, stated by the owner: as tensions are removed, session throughput
should rise several-fold. Treat unresolved friction as debt worth naming out loud.

## Model access

- **Fable leaves paid plans 2026-07-19, 11:59 pm PT** (= Monday 07-20 ~09:00 Polish
  time). No fourth extension announced. Afterwards Fable runs only on prepaid credits
  ($10/M in, $50/M out); Anthropic says it aims to restore it to subscriptions "once
  capacity allows" — **re-check at session start**, they extended three times in five
  weeks.
- **Fallback driver: the owner's OpenAI subscription includes frontier-model access.**
  Future sessions may run in a different harness entirely. This file, `docs/PROCESS.md`
  and `docs/WORKFLOW.md` are model-agnostic on purpose. NOTE for any non-Anthropic
  driver: the casting ladder names Anthropic tiers (frontier/strong/cheap = Fable/Opus/
  Sonnet) — translate tiers to the available pool; the *shape* (frontier orchestrates
  and grills, strong reviews, cheap codes pre-resolved packages) is the durable part.
- s11 datapoint: an **Opus-driven** orchestration session ran the full loop — parallel
  coder dispatch, tier-3 review, fix loop, cert, docs — without frontier involvement.

## State

- **main @ 819956d**, clean, pushed. **E14 Shipyard & Refit CODE-COMPLETE.**
- s11 wave **#272 + #299 shipped** (PRs #301, #300), certified on main: 611 unit /
  typecheck / lint / build / full Playwright 102/102, postmerge clean. Both took one
  fix-loop round; both findings were AC items the coders read past, not judgement
  calls — see the scorecard's s11 note (signal about package shape, not casting).
- New from the s11 review: **#302** (last vacuous `if (store)` guard, incident-0005
  pattern), **#303** (auto-draw bound of 24 is 2.4× loose vs `AUTO_DRAW_PER_DAY`).
- **E13 site-registry decision LOCKED (owner, 2026-07-19)** — Professor F4 resolved:
  close only the *silent* enumeration (netWorth) with a typed exhaustive registry; the
  four loud ones stay hand-maintained. Rationale + E15-start re-evaluation trigger in
  the E13 spec §The site registry; **#100's AC amended** accordingly (newest comment
  supersedes the body); deferred full-iterator refactor tracked as **#304** (milestone
  E15) so the trigger has a home.
- **Incident 0018** filed: `gh auth switch` does not move git's credential cache.
  Generalized with 0016/0017 — *auto-memory is a working channel, not a home for
  gotchas*; it reaches neither subagents nor other machines.

## Queue (owner-agreed order)

1. **Owner-led grill: E13.** Agenda ready — (a) skim spec vs code first, since #99
   shipped the BuildOrder generalization and #100's body may overlap it; (b) Professor
   **F7** (deliver addressing becomes inexpressible intent once E15 plants coexist with
   sites — labelled E15 spec, but E13's Storehouse adds the third chain target).
   The F4 site-iterator question is **already decided** — do not reopen it at the table.
2. **E13 implementation:** #100 → #101 → #102.
3. Cheap tails, batchable into any wave: **#302**, **#303**.
4. Then **E11 v1** (#232→#233→#234) → **E15** (#281→#284, spec approved).

## Watch items

- **`design-notes` LIVE→HIST flips.** The new index (`docs/design-notes/README.md`)
  marks 11 of 36 notes LIVE. Check in a few sessions whether rows actually get flipped;
  if not, the ritual didn't take and the index is lying — better to learn that early.
- **Parked-in-a-lot-with-no-exit.** Writing that index surfaced live work visible
  nowhere else: four `grill-brief-m4/m5/m6-*` scenarios awaiting their grills,
  `route-conditionals` (parked, needs its own grill), `e8-followups` (peripheral
  starvation of remote sole-producer goods, unresolved). None have issues. Worth a
  sweep when planning M4.
- **"Named in the AC but skipped"** — if the s11 pattern repeats, the lever is package
  shape (a checklist of named files), not casting.
- Refit status violet `#a373d6` vs mining `#7e55ab` proximity — eyeball at playtest
  (teal `#34b6a3` is the ready alternative).
- Recurring e2e smell: `dispatchEvent` standing in for real interaction.
- Professor F6: `RefitOrder` mixed stored/derived truth splits if `HOLD_LADDER` is ever
  tuned under a loaded mid-refit save — raise only if ladder tuning enters an agenda.
- **This machine is the brother's** (Kacper). `gh` is switched to `reteter` for owner
  sessions and **must be restored to `Darecik`** at the end of work on it — and the
  restore is two things now: the `gh auth switch` *and* removing any
  `credential.https://github.com.helper` / gist entries left in the global `.gitconfig`
  (incident 0018).
