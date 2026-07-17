# HANDOFF — exportable session-state snapshot

**Updated only when the owner asks** (ceremony decision, 2026-07-16). The date below
is the freshness marker: when it looks stale, trust `git log` and `gh issue list`
over this file. Written for any model in any harness; Claude Code's per-machine
auto-memory is the day-to-day working channel and may be ahead of this snapshot.
Keep it one screen: state → queue → watch. Standing gotchas live in `CLAUDE.md`
(§Git & worktrees), `docs/agent-memory.md`, and `docs/incidents/README.md` §Log —
not here.

_Last update: 2026-07-17 (owner-requested; machine handoff — owner continues from a
fresh `git clone` on another machine, so per-machine auto-memory is NOT available
there; this file + repo docs are the whole context)._

## State

- **main @ ad37ae0** — clean, certified: **600 unit / typecheck** (full Playwright
  100/100 ran coder-side on identical content). **E14 Shipyard & Refit is CODE-COMPLETE
  (4/4):** #291 merged closes #276.
- **#276 ran as the second paired A/B trial** (Opus vs Sonnet, upgraded protocol —
  index scrub, reference-arm quarantine, clean disclosure audit). Owner ratified
  merging the Sonnet arm; series now 2/2 for Sonnet on written-rule conformance +
  tests at ~half the limit-% cost, Opus better architecture both times. Write-up:
  `docs/design-notes/ab-276-shipyard-ui.md`; rows in `coder-scorecard.md`.
- **#292 (new)** — port arm-A strengths: stall-walk collapse, shared `SiteProgress`,
  rush-string PL, sim-side estimate seam (coordinate with #272). Reference branch
  `feat/276-shipyard-ui` @ ddd33de stays on origin until #292 closes — then delete.
- Costs this session: Opus arm ~24% limit, Sonnet arm ~14%, reviews+comparative on
  Opus; session ended ~85%+.

## Queue (owner-agreed order, set s5/s6)

1. **Professor dispatch — CAST ON FABLE (owner decision s6, 2026-07-17):** the Fable
   pool (28% left, lapses 07-19) goes to the analysis itself; the separate "Fable
   digest" step is dropped. One-off exception: Professor writes his full report to
   `docs/design-notes/` (read-only waived for handoff durability), driver commits it.
   Scope = the construction subsystem
   end-to-end — `src/sim` site/shipyard/build-order + commands + save v13 + the
   store→UI bridge (`siteStall`/`siteEstimate`/`BuildProgress`). Persona:
   `docs/personas/PROFESSOR.md`, harness def `.claude/agents/professor.md`.
2. **Fable digest of the Professor's findings — MUST land before 2026-07-19**
   (Fable access lapses; the digest is cheap — reading a design note).
3. **Owner-led grill: coder-contract TDD line** (trigger hit at 3 self-reported
   TDD-order deviations — see scorecard).
4. #290 + #292 (both are "port arm-A patterns" follow-ups — natural single wave),
   #272 (barrel), #255.
5. E13 Guild buildings (#100/#101 — skim spec vs code first) → E11 v1 (#232→#233→#234)
   → E15 (#281→#284, spec approved).

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
- Fable access ends 2026-07-19 — item 2 above is the deadline task.
