# HANDOFF — canonical session-state note

**This file is the single source of session state for ANY model in ANY harness.**
Claude Code's per-machine auto-memory mirrors it, never the reverse; a model that
reads only the repo must lose nothing. Update at every session close (WORKFLOW
§Session Opening Rituals →  End of Session) — overwrite, don't append; history
lives in git. Keep it one screen: state → queue → watch → gotchas.

_Last update: 2026-07-15, end of the #254 grill + Engineer-subagent experiment session._

## State

- **main @ 47c1390** — clean, no open PRs, no stray branches/worktrees. Certified green
  earlier this session cycle: **477 unit, typecheck, lint, Playwright 86/86** (after
  `npm install` — incident 0013). Three Opus-Orchestrator drobiazgi waves are fully
  shipped and merged (#248 `isRouteActive`, #249 tab-cycle keybinds, #251 dispatch fix,
  #252 route goods×kind table, #253 React test infra; docs #250/#256).
- **This session = a full grill of #254 + a persona experiment.** No code shipped; the
  deliverable is a **draft spec**.
- **NEW draft spec: `docs/specs/E9.1-route-qty-and-margin-gate.md`** (status: draft,
  pending owner approval). It captures the WHOLE closed grill (Design) + the Engineer's
  Tech draft. **This is the next session's starting point — do NOT re-grill.**
- **#254 grill is LOCKED.** Feature = route Stop `qty` ("up to N", buy/sell, absent =
  greedy, E9-preserving) + **Margin Gate** (`minMargin` on buy only; wait until
  `sell_price(next sell-stop, wrap) − buy_price(here) ≥ minMargin`; dwell indefinitely,
  siblings execute, UI "czeka na marżę" indicator is a HARD requirement; multiple gates
  at one Stop = atomic v1; `quoteBuy` with null=keep-waiting). Decided extras: **stored
  `ShipAssignment.waiting?` bit** (save/load determinism — the Engineer's key catch),
  **SAVE_VERSION 10→11 identity migration**, **new ADR-0007** "Routes may wait" (the
  deliberate E9-equivalence exception).
- **Persona experiment worked** (owner: "naprawdę cenny wkład"): Designer (me) held the
  *what*, an Engineer-"Carl" subagent (agent `Plan`, read-only, fed a self-contained
  package + ENGINEER.md) held the *how* and did NOT relitigate locked decisions — routed
  2 real questions up. Payoff = the `waiting`-bit catch a naïve build would have missed
  (silent save/load determinism bug). Cost = cold start needs the full locked Design in
  the package. Rule of thumb: **subagent-Engineer for a closed Design; in-line Engineer
  hat during the grill itself.** The subagent even self-called advisor.

## Queue (owner-agreed order)

1. **#254 → spec approval → issues.** Next session: owner reviews `E9.1` draft →
   approve/adjust → then file **ADR-0007**, the **CONTEXT.md** "Margin Gate" entry, and
   cut **3 issues** (proposed split in the spec: (1) qty A+B sim, (2) Margin Gate sim +
   ADR + waiting bit + migration, (3) UI inputs + indicator). Milestone = the E9.1 epic.
2. **#255** — visible click affordance for empty cells in the #220 route table (small,
   CSS-mostly mini-PR).
3. **#184** — EN→PL player-string sweep. **SOLO on a quiet tree** (touches many UI files
   + e2e selectors) — do not overlap with other UI waves.
4. **E13 Guild buildings** (#99–#102, spec approved 2026-07-09) — before cutting the wave,
   skim the spec against current `contract.ts`/`building.ts`.
5. **E11 v1** (#232 → #233 → #234).

`design-frontier` items (M4 clusters, economic events, first arcane good, M5 Great Work,
M6 zoom-out) wait for an **owner-led grill** — do not start them from the queue.

## Watch items

- **Uncommitted at session close?** No — the draft spec + this HANDOFF go out on a docs
  branch + PR (see below). Verify the PR merged before the next wave branches from main.
- Coders: 2× self-reported TDD-order deviation to date. A third ⇒ grill a coder-contract line.
- Recurring coder smell: `dispatchEvent(...)` standing in for real interaction in e2e
  (honest pattern: `focus()`/`.click()` + real key + `toBeFocused()`).
- Scorecard (`docs/design-notes/coder-scorecard.md`) ~15 rows — past the ~12 threshold for
  the Opus-vs-Sonnet (and Opus-vs-Fable advisor) A/B; a read-out is due.

## Gotchas (this machine / this repo)

- **Dispatch coders with `isolation: "worktree"` ONLY** (incident 0012) — NO manual
  `git worktree add`, no hardcoded worktree path in the prompt; tell the coder to "work in
  your assigned worktree" and push `HEAD:<target-branch>` by refspec. The sandbox is
  **asymmetric — Bash writes the "forbidden" worktree freely**, so isolation is not a Bash
  boundary. **Resume-after-crash silently drops an in-flight advisor/tool call — re-issue
  it in the resume message.** Fix validated (wave B: zero locks).
- **`npm install` BEFORE certifying** when a merge touched `package.json`/lock (incident
  0013): a cert red whose signature is module-not-found / missing-type-from-a-just-added
  package is stale-env until proven otherwise.
- **Certify AFTER worktree cleanup, never concurrently** (incident 0011): clean
  `git worktree list` is the go-signal (else `eslint .` over-scans worktree `src/` copies
  and Playwright flakes under contention → false RED).
- **advisor() works from a non-Fable main/Orchestrator agent** (Opus 4.8 confirmed); the
  harness "check your network · retry" message is MISLEADING — the call is in flight, wait.
  Unavailable only when Fable is executor (pairing rule).
- PowerShell + `gh`: UTF-8 bodies ONLY via `--body-file`; use explicit `owner/repo` paths.
- Playwright: dedicated port via `PLAYWRIGHT_PORT` (5173 may be squatted).
- Certification runs start by printing pwd + branch + SHA (incident 0008); after merge
  batches verify content reachable from `origin/main` before deleting branches (0010).
