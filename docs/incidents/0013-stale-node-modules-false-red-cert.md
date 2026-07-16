# 0013 — Stale node_modules after merging a deps-adding PR → false-red certification

- **Date:** 2026-07-15
- **Detected by:** post-merge certification (`npm test` errored at collection; `tsc -b` failed on jest-dom matcher types) — self-caught, recognized as environmental before any "fix".
- **Status:** Closed (`npm install` resolved it; clean-tree cert 477 unit + 86/86 e2e green).

## What happened

After the #220 ‖ #187 wave merged, the Orchestrator pulled `main` and ran certification **without `npm install`**. #187 added devDependencies (`@testing-library/react`, `@testing-library/jest-dom`, `jsdom`, …) and updated `package.json` + `package-lock.json`, but the local `node_modules` was still the pre-merge tree. Result:

- `npm test` → "1 error", 0 tests run — the new `src/test-setup.ts` `import "@testing-library/jest-dom/vitest"` and `@testing-library/react` weren't installed, so collection threw.
- `tsc -b` → `TS2339: Property 'toHaveAttribute' does not exist on type 'Assertion<any>'` in `Tabs.test.tsx` — the jest-dom type augmentation wasn't present.

Both read as a **red main** for ~one command cycle. `npm install` (found 0 vulnerabilities, installed the new deps) → re-cert green: 477 unit, typecheck clean, lint clean, Playwright 86/86.

## Impact

- **Outcome:** Low — self-caught, recognized as stale-env not code-defect within one step, no wrong "fix" attempted, no time lost chasing a phantom bug.
- **Failure-mode class:** Medium — a false red at the certification gate is dangerous: the opposite (a false *green*) never happened here, but reflexively "fixing" a stale-env red (e.g. reverting the coder's correct config, or worse, weakening the test) would inject a real defect to silence an environmental one. This is the same false-signal family as incident 0011 (cert over live worktrees).
- **Rules broken/skipped:** none — process gap, not a rule breach.

## Recurrence

Medium — structural. Any merged PR that adds/changes dependencies leaves the local `node_modules` stale until `npm install`; the next `npm test`/`tsc` on that tree fails in a way that mimics a code regression. Recurs every deps-touching wave close unless install is part of the post-merge ritual.

## Recommendation

- **Prevent:** After pulling a merge that touched `package.json`/`package-lock.json`, run `npm install` (or `npm ci`) **before** certifying. Cheap tell: `git diff <old>..<new> -- package.json package-lock.json` non-empty ⇒ install first. Fold into the wave-close cert ritual next to the incident-0011 "clean `git worktree list`" go-signal.
- **Detect:** A cert red whose signature is *module-not-found / missing-type-from-a-just-added-package*, not an assertion failure, is stale-env until proven otherwise — `npm install` and re-run before treating it as a code defect.
- **Contain:** n/a — full fix is one command.

## Follow-up

- Recorded in README §Log; cert-ritual rule lives in `CLAUDE.md` §Git & worktrees + WORKFLOW §E2E certification points (since the 2026-07-16 ceremony slim).
