# etersim

Single-player aether-punk trading simulation. Browser-only: Vite + TypeScript +
React + Zustand.

See `AGENTS.md` / `CLAUDE.md` for the project rules and source-of-truth map,
and `docs/PRD.md` for the vision and roadmap.

## Development

```
npm install
npm run dev        # start the Vite dev server
npm test            # Vitest suite
npm run typecheck   # tsc -b
npm run lint         # ESLint
npm run test:e2e     # Playwright E2E
npm run build        # production build → dist/
```

## Playtest builds

Two ways to try the game without cloning the repo:

- **Hosted (recommended)**: https://reteter.github.io/etersim/ — always the
  latest `main`, redeployed automatically on every push via
  `.github/workflows/deploy-pages.yml`. Saves persist in the browser's
  localStorage for that domain.
- **Single-file build (offline / send-a-file)**: run `npm run build:single`
  to produce `dist-single/index.html` — one self-contained HTML file (all JS
  and CSS inlined) that can be sent directly and opened via `file://` with no
  server. Saves persist in the browser's localStorage for the local file
  origin.
