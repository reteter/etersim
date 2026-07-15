# HANDOFF — canonical session-state note

**This file is the single source of session state for ANY model in ANY harness.**
Claude Code's per-machine auto-memory mirrors it, never the reverse; a model that
reads only the repo must lose nothing. Update at every session close (WORKFLOW
§Session Opening Rituals →  End of Session) — overwrite, don't append; history
lives in git. Keep it one screen: state → queue → watch → gotchas.

_Last update: 2026-07-15, end of the first Opus-Orchestrator drobiazgi wave._

## State

- **main @ f82850e** — clean, no open PRs, no stray branches/worktrees. Certified
  green this session in a clean environment: 471 unit, typecheck, lint, Playwright
  **84/84**.
- This session shipped the first **drobiazgi wave under an Opus 4.8 Orchestrator**
  (not Fable): **#217** (keybind `<g>` → sail Controlled Ship to the selected port,
  live `getState()` read, `sailability` lifted to `src/ui/sailability.ts`) and
  **#221** (seed name in export filename, **store-only** per owner decision — the
  seed does NOT live in the world; `createWorld` hashes+discards it). PRs #244/#245
  plus docs #242/#246 merged.
- **Souvenirs convention**: `docs/souvenirs/` is gitignored — a per-machine home for
  session keepsakes (raw transcripts). The Fable farewell transcript lives there now.
- **advisor() works from a non-Fable main/Orchestrator agent** (Opus 4.8 confirmed).
  The harness `Waiting for API response · check your network · retry` message is
  MISLEADING — the call is in flight, just wait. Only **Fable-as-executor** lacks it
  (pairing rule). This wave, advisor at the orchestration seat caught two issues
  **pre-dispatch**: the stale-closure trap in #217's keydown listener, and #221's
  false "seed lives in the world" premise (routed to the owner → store-only).
- Backup mirror `codeberg` still holds a stale `docs/handoff-close-fable` branch —
  prunes on the next `git push --mirror codeberg`.

## Queue (owner-agreed order; all `procedural`)

1. **Drobiazgi waves**: **#218** (now unblocked — #217 freed `OptionsOverlay`; `<,>`/`<.>`
   cycle overlay tabs), then #220, #184, #187, #154; older UI when convenient:
   #173/#175/#177/#125/#127/#128/#73/#74. Parked follow-up **#243** (blank-seed export
   filename shows a raw `Date.now()` timestamp — a design call, options in the issue).
2. **E13 Guild buildings** (#99–#102, spec approved 2026-07-09) — before cutting the
   wave, skim the spec against current `contract.ts`/`building.ts` (Engineer "Carl"'s
   planned maiden voyage).
3. **E11 v1** (#232 → #233 → #234).

`design-frontier` items (M4 clusters, economic events, first arcane good, M5 Great
Work, M6 zoom-out) wait for an **owner-led grill** — do not start them from the queue.

## Watch items

- Coders: 2× self-reported TDD-order deviation to date (none this wave). A third ⇒
  grill a coder-contract line.
- Recurring coder smell: `dispatchEvent(...)` standing in for real interaction in e2e
  (honest pattern: `focus()`/`.click()` + real key + `toBeFocused()`).
- Scorecard row per coder PR at wave close (`docs/design-notes/coder-scorecard.md`) —
  now 11 tier-comparable rows, nearing the ~12 threshold for the Opus-vs-Sonnet A/B.

## Gotchas (this machine / this repo)

- **Certify AFTER worktree cleanup, never concurrently** (new, 2026-07-15): a cert
  launched while `.claude/worktrees/agent-*` still existed had `eslint .` over-scan the
  worktree `src/` copies (**326 spurious lint errors**) and Playwright flake **4
  fleet.spec tests** under resource contention — a false RED that nearly got reported.
  Remove worktrees first, THEN run the certification. Candidate for an incident report.
- PowerShell + `gh`: UTF-8 bodies ONLY via `--body-file`; `gh api repos/{owner}/{repo}/...`
  placeholder syntax fails under PowerShell — use the explicit `owner/repo` path.
- Playwright: dedicated port via `PLAYWRIGHT_PORT` (5173 may be squatted).
- Certification runs start by printing pwd + branch + SHA (incident 0008); after merge
  batches verify content reachable from `origin/main` before deleting branches (0010).
