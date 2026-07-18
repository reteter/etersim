# HANDOFF — exportable session-state snapshot

**Updated only when the owner asks** (ceremony decision, 2026-07-16). The date below
is the freshness marker: when it looks stale, trust `git log` and `gh issue list`
over this file. Written for any model in any harness; Claude Code's per-machine
auto-memory is the day-to-day working channel and may be ahead of this snapshot.
Keep it one screen: state → queue → watch. Standing gotchas live in `CLAUDE.md`
(§Git & worktrees), `docs/agent-memory.md`, and `docs/incidents/README.md` §Log —
not here.

_Last update: 2026-07-18 s10 (owner-requested; docs-only session on the brother's
machine — no orchestration, farewell conversation + status verification). Previous
machine-handoff bootstrap notes (fresh clone, `npm install`, session-start ritual,
`gh auth login`, no `scripts/setup.ps1` yet — #239) still apply to any new machine._

## Model access (verified by web search 2026-07-18)

- **Fable leaves paid plans 2026-07-19, 11:59 pm PT** (= Monday 07-20 ~09:00
  Polish time — the whole Sunday still counts). No fourth extension. Afterwards
  Fable runs only on prepaid usage credits ($10/M in, $50/M out); Anthropic says
  it aims to restore it to subscriptions "once capacity allows" — **re-check at
  session start**, they extended three times in five weeks. The "2x usage through
  Aug 5" seen in cowork is a separate Claude Code rate-limit promo, not Fable.
- **Fallback driver: the owner's OpenAI subscription includes frontier-model
  access.** The owner finds its work/communication style a jarring change from
  Anthropic models (irritating, but the reason is understood) — future sessions
  may run in a different harness entirely. This file + `docs/PROCESS.md` +
  `docs/WORKFLOW.md` are written model-agnostically on purpose. NOTE for any
  non-Anthropic driver: the casting ladder (WORKFLOW §Roles, auto-memory
  "model-ladder-orchestration") names Anthropic tiers (Fable/Opus/Sonnet) —
  translate tiers to the available pool before dispatching; the *shape* of the
  ladder (frontier orchestrates/reviews, mid-tier codes pre-resolved packages)
  is the durable part, not the model names.

## State

- **main @ ae81a9c** (session-close s9) — clean, pushed. **E14 Shipyard & Refit
  CODE-COMPLETE (4/4).** The s5/s6 queue item 3 wave **shipped in s8/s9**:
  #290 (merged #297), #292 (merged #298), #255 (merged #295); #293 closed.
  New from that wave: **#299** (sim cleanup: dead `applyDeliveryToSite`, weak
  autodraw-refit assertion).
- **Professor review (Fable) DONE s7** — full report:
  `docs/design-notes/professor-construction-review.md`. Engine certified sound
  (determinism, purity, save v13, Reserve, ledger grammar, quote/charge). Findings
  routed: **#293 (new, type:bug)** = F1 HQ "Zleć budowę" silent no-op + F2 wrong
  reason string; F3 → comment on #292; F5 → comment on #290; F4/F7 → grill agendas
  (queue below); F6 → watch item below.
- **#276 A/B series stands at 2/2 for Sonnet** (written-rule conformance + tests at
  ~half the limit-% cost; Opus better architecture both times). Write-up:
  `docs/design-notes/ab-276-shipyard-ui.md`; rows in `coder-scorecard.md`.
- **#292** — port arm-A strengths (stall-walk collapse, shared `SiteProgress`,
  rush-string PL, sim estimate seam; coordinate with #272). Reference branch
  `feat/276-shipyard-ui` @ ddd33de stays on origin until #292 closes — then delete.
- Fable pool: ~72% used at s7 start; Professor dispatch (~130k subagent tokens) was
  the deadline task and it's done — remaining pool through 07-19 is bonus.

## Queue (owner-agreed order, set s5/s6)

1. ~~Professor dispatch~~ — **DONE 2026-07-17 (s7, cast on Fable per owner decision
   s6; the separate "Fable digest" step was dropped).** Report:
   `docs/design-notes/professor-construction-review.md` — engine verified sound
   (determinism, purity, v13, Reserve, ledger grammar, quote/charge); 7 findings
   routed per its Routing Table: F1+F2 → new issue (HQ Budowa silent no-op + wrong
   string), F3 → comment on #292, F5 → comment on #290, F4+F7 → grill agenda
   (E13 site iterator, E15 deliver addressing), F6 → conditional watch.
2. **Owner-led grill: coder-contract TDD line** (trigger hit at 3 self-reported
   TDD-order deviations — see scorecard).
3. ~~#290 + #292 + #293 + #255~~ — **shipped s8/s9** (see State). Remaining from
   this tier: #272 (barrel) + follow-up #299.
4. E13 Guild buildings (#100/#101 — skim spec vs code first; **grill agenda: F4
   ordered site iterator**) → E11 v1 (#232→#233→#234) → E15 (#281→#284, spec
   approved; **grill agenda: F7 deliver addressing**).

## Watch items

- **Casting ladder:** coder = Opus was a 5-session owner decision (s4, now 3 sessions
  in) — but the 2/2 A/B series argues Sonnet for UI/sim-consumer tiers; owner call
  pending the trial read-out. Reviews stay strong-tier; tier 3 = ONE two-axis subagent
  (incident 0016).
- Refit status violet `#a373d6` vs mining `#7e55ab` proximity — owner kept violet;
  eyeball at playtest (teal `#34b6a3` is the ready alternative, noted in #292).
- Both #276 arms left market buy/sell rows sim-guarded-only for a locked ship
  (silent no-op) — in #292 as a conditional item.
- Recurring e2e smell: `dispatchEvent` standing in for real interaction.
- Fable access: see §Model access above — ends 07-19 23:59 PT, no deadline tasks
  left; re-check each session whether Anthropic restored Fable to subscriptions.
- Professor F6: `RefitOrder` mixed stored/derived truth splits if `HOLD_LADDER` is
  ever tuned under a loaded mid-refit save — raise at the grill only if ladder
  tuning enters an agenda.
