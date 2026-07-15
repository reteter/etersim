# etersim

Single-player aether-punk trading simulation. Browser-only: Vite + TypeScript + React + Zustand. The simulation is a pure TS module in `src/sim` — no React/DOM imports there, ever (ADR-0002). Time is tick-based and deterministic with a seeded RNG (ADR-0003). No backend; saves in localStorage + JSON export (ADR-0004).

## Source of truth

- `CONTEXT.md` — ubiquitous language. Law: code identifiers use these terms; new concept ⇒ glossary entry first.
- `docs/PRD.md` — vision, pillars, scope, milestone/epic roadmap.
- `docs/WORKFLOW.md` — process: grill → spec → approval → issues → PR. Read before starting any epic or creating issues.
- `docs/adr/` — settled decisions; add an ADR for hard-to-reverse choices, don't relitigate existing ones.
- `docs/specs/` — one feature spec per epic (Design + Tech sections).
- `docs/personas/` — Designer/Engineer/Analyst hats, the Orchestrator role, the Coder subagent contract (harness def: `.claude/agents/coder.md`), and the Professor architecture reviewer (harness def: `.claude/agents/professor.md`).
- `docs/design-notes/` — parking lot for playtest observations and deferred ideas. Items may be grilled and locked before implementation; `trade-loop-followups.md` tracks E2 post-playtest follow-ups (all shipped as of 2026-07-08).
- `docs/HANDOFF.md` — canonical session-state note (queue, watch items, gotchas), written for any model in any harness; per-machine auto-memory mirrors it, never the reverse. Updated at every session close.
- `docs/agent-memory.md` — durable, machine-independent lessons exported from per-machine memory.

## Rules

- Language: code, docs, commits, issues — English. Conversation with the user — Polish. Player-facing UI strings — Polish (2026-07-14 UI grill; legacy English strings tracked for a sweep).
- Every epic starts with grilling, then a spec approved by the user, then GitHub issues (`gh`; milestone = epic).
- TDD for `src/sim` (Vitest). UI verified with Playwright E2E tests (plus light unit tests for the store bridge); manual playtesting recommended for exploration.
- Feature branches + PR (`Closes #n`), conventional commits. Before merge: tests, typecheck, lint, and the tiered wave check (review depth scales with the diff's risk surface — `docs/WORKFLOW.md` §Verification gates).
- Spec drift: updating the spec is part of the task.
- Determinism is sacred: all sim randomness flows from the seeded RNG; no `Math.random`, no `Date.now` inside `src/sim`.
- Session start: read `docs/HANDOFF.md`, then check open work with `gh issue list`. Before starting any task, run the pre-work checklist in `docs/SELFCHECK.md` and post its report. Session close: update `docs/HANDOFF.md` (overwrite; history lives in git).

## Git & worktrees

- `.claude/worktrees/agent-*` directories are not always real `git worktree` entries — some turn out to be plain subdirectories nested inside the main repo (e.g. `.claude/worktrees/<name>`, 3 levels below repo root). Check `git worktree list` before trusting `pwd`; if the directory isn't listed there, `git rev-parse --show-toplevel` still resolves to the main repo root, so `git add`/`git status` paths are relative to that root, not to `pwd` — use absolute paths (or `git -C <toplevel>`) to avoid pathspec errors.
- Clean up branches right after each merge, not later: `git worktree remove` before `git branch -D` (branch delete fails while a worktree holds it). After `gh pr merge --delete-branch`, verify the remote branch actually got deleted (`git branch -a` / `git fetch --prune`) — it silently fails when the branch is still checked out in a worktree, leaving stale remote/local branches to accumulate.
- Subagents working in a worktree must never `cd` to an absolute repo path or act on the main checkout: address git as `git -C <their-worktree>`, and never `checkout`/`commit`/`reset` on `main`. After a coder wave, verify the main repo is clean and on the expected SHA (`docs/incidents/0001`).

## Incidents

- `docs/incidents/` is a blameless log of times work deviated from the rules/docs/intent, including near-misses. We work **report → fix → don't repeat**, never punishment. Read `docs/incidents/README.md` §Log — a one-line-per-incident digest of what's bitten us and what to watch for — so any model, whatever its persona, carries the lessons. File a report (template in that README) whenever a rule was broken/skipped, a command hit the wrong repo/branch/file, or something surprised you the next person should be warned about.

## Commands

- `npm run dev` — start the Vite dev server.
- `npm run build` — typecheck (`tsc -b`) then production build (`vite build`).
- `npm test` — run the Vitest suite once.
- `npm run test:e2e` — run Playwright E2E tests (auto-starts the dev server). Locally, set `PLAYWRIGHT_PORT` to a dedicated port (e.g. `PLAYWRIGHT_PORT=5901 npm run test:e2e`): `reuseExistingServer` will otherwise silently reuse a foreign dev server squatting on `5173` and feed your run its stale build — false failures that mask your changes. Never kill the foreign process to free the port.
- `npm run typecheck` — typecheck the whole project (`tsc -b`).
- `npm run lint` — lint with ESLint (flat config, `eslint.config.js`).
