## Summary

<!-- What and why. Link the spec section if behavior is involved. -->

Closes #

## Checklist (docs/workflows/verification.md §Definition of done / CLAUDE.md §Before you start)

- [ ] Tests green (`npm test`); new `src/sim` behavior grew **test-first** (or carries named per-test red evidence — CODER.md TDD line)
- [ ] Typecheck + lint clean (`npm run typecheck`, `npm run lint`)
- [ ] Affected E2E specs passing if UI changed (`PLAYWRIGHT_PORT=59xx npm run test:e2e` locally); full run happens at wave merge / epic close
- [ ] Wave check at the diff's tier (docs/workflows/verification.md: docs/infra → inline; UI-only → one cheap-tier review subagent; `src/sim`/economy/multi-file → one two-axis strong-tier subagent)
- [ ] CONTEXT.md updated if a new domain term appeared; spec updated if behavior drifted (spec sync is part of the task)
- [ ] Determinism preserved: no `Math.random` / `Date.now` in `src/sim`; sim imports no React/DOM
- [ ] Docs sync sweep done for docs/spec changes (no stale cross-references)
- [ ] The owner merges — do not self-merge
