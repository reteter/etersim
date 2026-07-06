# etersim

Single-player aether-punk trading simulation. Browser-only: Vite + TypeScript + React + Zustand. The simulation is a pure TS module in `src/sim` — no React/DOM imports there, ever (ADR-0002). Time is tick-based and deterministic with a seeded RNG (ADR-0003). No backend; saves in localStorage + JSON export (ADR-0004).

## Source of truth

- `CONTEXT.md` — ubiquitous language. Law: code identifiers use these terms; new concept ⇒ glossary entry first.
- `docs/PRD.md` — vision, pillars, scope, milestone/epic roadmap.
- `docs/WORKFLOW.md` — process: grill → spec → approval → issues → PR. Read before starting any epic or creating issues.
- `docs/adr/` — settled decisions; add an ADR for hard-to-reverse choices, don't relitigate existing ones.
- `docs/specs/` — one feature spec per epic (Design + Tech sections).
- `docs/personas/` — Designer/Engineer hats and Orchestrator role.
- `docs/design-notes/` — parking lot for the owner's playtest observations and deferred ideas, not yet grilled or spec'd. `trade-loop-followups.md` is the running list; each item later becomes a spec update + issue, or a new epic.

## Rules

- Language: code, docs, commits, issues — English. Conversation with the user — Polish.
- Every epic starts with grilling, then a spec approved by the user, then GitHub issues (`gh`; milestone = epic).
- TDD for `src/sim` (Vitest). UI verified with Playwright E2E tests (plus light unit tests for the store bridge); manual playtesting recommended for exploration.
- Feature branches + PR (`Closes #n`), conventional commits. Before merge: tests, typecheck, lint, `/code-review`.
- Spec drift: updating the spec is part of the task.
- Determinism is sacred: all sim randomness flows from the seeded RNG; no `Math.random`, no `Date.now` inside `src/sim`.
- Session start: check open work with `gh issue list`.

## Commands

- `npm run dev` — start the Vite dev server.
- `npm run build` — typecheck (`tsc -b`) then production build (`vite build`).
- `npm test` — run the Vitest suite once.
- `npm run test:e2e` — run Playwright E2E tests (auto-starts the dev server).
- `npm run typecheck` — typecheck the whole project (`tsc -b`).
- `npm run lint` — lint with ESLint (flat config, `eslint.config.js`).
