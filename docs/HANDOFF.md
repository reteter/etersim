# HANDOFF — canonical session-state note

**This file is the single source of session state for ANY model in ANY harness.**
Claude Code's per-machine auto-memory mirrors it, never the reverse; a model that
reads only the repo must lose nothing. Update at every session close (WORKFLOW
§Session Opening Rituals →  End of Session) — overwrite, don't append; history
lives in git. Keep it one screen: state → queue → watch → gotchas.

_Last update: 2026-07-16, end of the E9.1-issues + market-panel-refresh wave session._

## State

- **main @ bf5eb9a** — clean, single worktree. Merged this session: **#258** (Engineer
  inline-vs-subagent persona rule), **#260** (ADR-0007 "Routes may wait" + CONTEXT Margin
  Gate glossary + E9.1 spec approved). Code baseline unchanged by those (docs-only):
  last certified **477 unit / typecheck / lint / 92 Playwright**.
- **THREE PRs open, awaiting the owner's squash-merge ("sq-merge"):**
  - **#264** — docs: batch small issues into one PR by default (new WORKFLOW rule, below).
  - **#265** — feat(ui) market panel refresh, **Closes #73/#74/#127**. Tier-2 wave check
    **CLEAN, 0 findings**; coder gates green (477 unit, 92/92 e2e). **Post-merge full
    Playwright on main is PENDING the sq-merge** — run it before branching the next wave.
  - **the session-close docs PR** carrying this HANDOFF + the #265 scorecard row +
    the new agent-memory scar (create/observe it in the PR list).
- **#254/E9.1 is fully issued.** Spec approved; milestone **#10 "E9.1 — Route qty + Margin
  Gate"** holds **#261** (qty sim, do first) → **#262** (Margin Gate sim: minMargin +
  `waiting` bit + resolver + `runRouteForShip` state machine + SAVE_VERSION 10→11) →
  **#263** (UI). ADR-0007 + CONTEXT entries already on main, so all three are dispatchable.
- **New process rule (owner, 2026-07-16, #264):** a coder batch lands as **ONE PR that
  `Closes` each issue** by default — per-issue PRs were ceremony for small concrete issues.
  Wave check still verifies each issue's AC separately. #265 is the first batch under it.

## Queue (owner-agreed order)

1. **E9.1 build** — dispatch **#261** (qty sim, TDD) first; then **#262** (the Margin Gate
   + `waiting` bit + migration — the heavy one, ADR-0007 in hand); then **#263** (UI). One
   coder each; #261→#262 share `StopOrder`/`executeStop` so sequence them.
2. **Coder B package (ready, not yet dispatched):** **#255** (route-table empty-cell click
   affordance) + **#175** (keybind → HQ Trasy tab). Disjoint from the market panel; one
   coder, one PR (both touch HeadquartersPanel/TopBar).
3. **#184** — EN→PL player-string sweep. **SOLO on a quiet tree.** Now also covers the
   market column headers ("Good/Trend/Bid/Ask/Stock") + PriceBoard "Port" (left EN in #265)
   and the intentional aria-label(EN)/visible-text(PL) split.
4. **E13 Guild buildings** (#99–#102) — skim spec vs current `contract.ts`/`building.ts`.
5. **E11 v1** (#232 → #233 → #234).

`design-frontier` items wait for an owner-led grill. New infra issue **#259**: a
`scripts/squash-merge.ps1` (safe deliberate sq-merge + cleanup, `[y/N]` default N).

## Watch items

- **#265 post-merge cert is OPEN** — full Playwright on main after the owner sq-merges it.
- **New scar (agent-memory):** a layout rule (`display:flex`) on a **shared** CSS class
  corrupts `innerText()` e2e in an unrelated component. Disprove "contention" via
  stash→isolation, don't assume it. Caught+fixed inside the #73 wave (nothing shipped bad).
- **Scorecard ~16 rows** (`docs/design-notes/coder-scorecard.md`) — the Opus-vs-Sonnet (and
  Opus-vs-Fable advisor) A/B read-out is overdue.
- **Deferred, playtest watch:** no "reset-to-max" chip on the collapsed market row (#73).
- **Owner-flagged for a future docs sweep:** whether HANDOFF is even needed; general docs
  drift is accepted as the cost of fast iteration — a sweep will tidy it.
- **#243 closed** won't-fix (option C: blank-seed timestamp filename accepted as-is).
- **Fable access ends 2026-07-19** — owner assumes no further extension; prioritize the
  last Fable-executor conversations (roadmap/long-game grill) before it lapses.

## Gotchas (this machine / this repo)

- **Session START: check `git branch -a` + prune**, not just at close — merged remote
  branches accumulate silently (found 8 dead ones this session; remote delete after a
  squash-merge is easy to forget / silently fails while a worktree holds the branch).
- **Dispatch coders with `isolation: "worktree"` ONLY** (incident 0012): no manual
  `git worktree add`, no hardcoded path; say "work in your assigned worktree", push
  `HEAD:<branch>` by refspec. Sandbox is asymmetric — Bash writes the worktree freely.
  Resume-after-crash silently drops an in-flight advisor/tool call — re-issue it.
- **`npm install` BEFORE certifying** when a merge touched `package.json`/lock (0013);
  **certify AFTER worktree cleanup, never concurrently** (0011). Clean `git worktree list`
  is the go-signal.
- **advisor() works from a non-Fable main/Orchestrator** (Opus 4.8); the "check your
  network · retry" message is misleading — the call is in flight, wait. Unavailable only
  when Fable is executor (pairing rule).
- PowerShell + `gh`: UTF-8 bodies ONLY via `--body-file`; explicit `owner/repo` paths.
- Playwright: dedicated port via `PLAYWRIGHT_PORT` (5173 may be squatted).
- Certification runs print pwd + branch + SHA first (0008); after merge batches verify
  content reachable from `origin/main` before deleting branches (0010).
