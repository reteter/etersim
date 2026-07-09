## Summary

<!-- What and why. Link the spec section if behavior is involved. -->

Closes #

## Checklist (WORKFLOW.md §Definition of done / docs/SELFCHECK.md)

- [ ] Tests green (`npm test`); new `src/sim` behavior grew **test-first**
- [ ] Typecheck + lint clean (`npm run typecheck`, `npm run lint`)
- [ ] E2E updated/passing if UI changed (`PLAYWRIGHT_PORT=59xx npm run test:e2e` locally)
- [ ] Code review run (two-axis for any `src/sim`/UI change; inline review only for a trivial one-file infra/docs diff)
- [ ] CONTEXT.md updated if a new domain term appeared; spec updated if behavior drifted (spec sync is part of the task)
- [ ] Determinism preserved: no `Math.random` / `Date.now` in `src/sim`; sim imports no React/DOM
- [ ] Docs sync sweep done for docs/spec changes (no stale cross-references)
- [ ] The owner merges — do not self-merge
