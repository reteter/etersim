# HANDOFF — canonical session-state note

**This file is the single source of session state for ANY model in ANY harness.**
Claude Code's per-machine auto-memory mirrors it, never the reverse; a model that
reads only the repo must lose nothing. Update at every session close (WORKFLOW
§Session Opening Rituals →  End of Session) — overwrite, don't append; history
lives in git. Keep it one screen: state → queue → watch → gotchas.

_Last update: 2026-07-15, end of the Fable farewell session._

## State

- **main @ a695594** — clean, no open PRs, no stray branches/worktrees. Code last
  fully certified at bc921bd (457 unit, typecheck, lint, Playwright 80/80); every
  commit since is docs-only (#231, #235, #240).
- **AGENTS.md** is the vendor-neutral entry point (any harness: "Read AGENTS.md and
  follow it"). The Engineer persona has a figure now — "Carl" (Sagan),
  `docs/personas/ENGINEER.md`; planned maiden voyage: standalone cross-vendor test
  (critique the E13 spec's Tech section against current `contract.ts`/`building.ts`
  — which is also this queue's item 2 prerequisite).
- **Backup mirror**: remote `codeberg` (https://codeberg.org/reteter/etersim).
  Refresh = snapshot issues to `backup/` (gh json export), commit, then
  `git push --mirror codeberg` (prunes deleted branches). GitHub stays the default
  remote (`origin`); `gh` is GitHub-only.
- Farewell roadmap is IN: PRD §Long-term fantasy (Lens ladder, 1.0 = mature region +
  first zoom-out), §Roadmap labels (`procedural`/`design-frontier`), milestone
  playtest law; WORKFLOW §Casting is model-agnostic. Grill record:
  `docs/design-notes/farewell-roadmap-grill-2026-07-15.md`.
- E11 v1 approved and cut: **#232 → #233 → #234** (milestone "E11 — Proving grounds
  (v1)"); #202 closed into them; #115 retires via #234.

## Queue (owner-agreed order; all `procedural`)

1. **Drobiazgi waves**: #217, #218, #220, #221, #184, #187, #154; older UI when
   convenient: #173, #175, #177, #125, #127, #128, #73, #74.
2. **E13 Guild buildings** (#99–#102, spec approved 2026-07-09) — before cutting the
   wave, skim the spec against current `contract.ts`/`building.ts` (it predates E3's
   shipping and three playtests; expected: no drift).
3. **E11 v1** (#232 → #233 → #234).

`design-frontier` items (M4 clusters A/B, economic events, first arcane good, M5
Great Work, M6 zoom-out) wait for an **owner-led grill** — do not start them from a
task queue, whatever your tier.

## Watch items

- Coders: 2× self-reported TDD-order deviation (honestly compensated). A third ⇒
  grill a coder-contract line.
- Recurring coder smell: `dispatchEvent(...)` standing in for real interaction in
  e2e (twice rejected as dishonest — incident 0005 discipline; honest pattern:
  `focus()` + `toBeFocused()` + real key).
- Scorecard row per coder PR is part of closing every wave check
  (`docs/design-notes/coder-scorecard.md`).

## Gotchas (this machine / this repo)

- PowerShell + `gh`: UTF-8 bodies ONLY via `--body-file` (incident 0007);
  `gh api repos/{owner}/{repo}/...` placeholder syntax fails under PowerShell
  ("command parameter was already specified") — use the explicit `owner/repo` path.
- Playwright: dedicated port via `PLAYWRIGHT_PORT` (5173 may be squatted — CLAUDE.md
  §Commands).
- Certification runs start by printing `pwd` + branch (incident 0008); after merge
  batches verify content reachable from `origin/main` before deleting branches
  (incident 0010).
