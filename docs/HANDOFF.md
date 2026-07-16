# HANDOFF — exportable session-state snapshot

**Updated only when the owner asks** (ceremony decision, 2026-07-16). The date below
is the freshness marker: when it looks stale, trust `git log` and `gh issue list`
over this file. Written for any model in any harness; Claude Code's per-machine
auto-memory is the day-to-day working channel and may be ahead of this snapshot.
Keep it one screen: state → queue → watch. Standing gotchas live in `CLAUDE.md`
(§Git & worktrees), `docs/agent-memory.md`, and `docs/incidents/README.md` §Log —
not here.

_Last update: 2026-07-16 (owner-requested, ceremony-slim docs sweep)._

## State

- **main @ ae5e1e6** — clean, certified this session: **477 unit / typecheck / lint /
  Playwright 92/92** (closes the #265 post-merge cert). #264 (batching rule), #265
  (market panel refresh), #266 (session docs) all merged; local + remote branches pruned.
- **E9.1 fully issued** — milestone #10: **#261** (qty sim, do first) → **#262**
  (Margin Gate sim: minMargin + `waiting` bit + resolver + SAVE_VERSION 10→11) →
  **#263** (UI). Spec approved; ADR-0007 + CONTEXT.md entries on main. All dispatchable.
- **Ceremony slim (owner, 2026-07-16):** HANDOFF updates on request only; session-close
  docs commit straight to `main` (WORKFLOW §Documentation law); incident reports capped
  at 25 lines; selfcheck short form is the default; `docs/PROCESS.md` added as the
  outside-reader tour of the process.

## Queue (owner-agreed order)

1. **E9.1 build** — #261 (TDD) → #262 (the heavy one) → #263 (UI). One coder each;
   #261→#262 share `StopOrder`/`executeStop`, so sequence them.
2. **Coder B package (ready):** #255 (empty-cell click affordance) + #175 (HQ Trasy
   keybind) — one coder, one PR.
3. **#184** EN→PL string sweep — **SOLO on a quiet tree** (incl. market column headers
   + PriceBoard "Port" left EN in #265; aria-label(EN)/visible-text(PL) split is intended).
4. **E13 Guild buildings** (#99–#102) — skim spec vs current `contract.ts`/`building.ts`.
5. **E11 v1** (#232 → #233 → #234).

`design-frontier` items wait for an owner-led grill.

## Watch items

- Scorecard ~16 rows — the Opus-vs-Sonnet (and Opus-vs-Fable advisor) A/B read-out is due.
- Coders: 2× self-reported TDD-order deviation; a third ⇒ grill a coder-contract line.
- Recurring e2e smell: `dispatchEvent` standing in for real interaction.
- Playtest watch: no "reset-to-max" chip on the collapsed market row (#73).
- Fable access ends 2026-07-19 — prioritize the roadmap/long-game grill before it lapses.
