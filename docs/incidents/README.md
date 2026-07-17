# Incidents

A blameless log of times work deviated from the project's rules, docs, or intent —
including **near-misses** where nothing broke but easily could have. The point is
learning, not blame: we work in **report → fix → don't repeat**, never in punishment.
A near-miss reported is a free lesson; a near-miss hidden is a future outage.

## Log

One line per incident — the lesson and what to watch for, so you can absorb the
history without reading every full report. Read the linked report only when an entry
is directly relevant to what you're doing.

| # | Date | Lesson / watch for |
| --- | --- | --- |
| [0001](0001-worktree-cd-main-branch-switch.md) | 2026-07-08 | A coder subagent in a git worktree can `cd` into the main repo and act on `main` (branch switch / commit / reset). Prevention now in `CLAUDE.md` §Git & worktrees and the `coder` agent def; orchestrator verifies main is clean + on the expected SHA after each coder wave. |
| [0002](0002-gold-highlight-color-collision.md) | 2026-07-08 | Gold (`#e0a840`) is reserved for the Controlled Ship (ADR-0006, one color = one meaning) — don't reuse it for highlights/selection in new UI. Near-miss: a price-board best-price highlight was gold, self-caught before merge. Detection = `/code-review` Standards axis vs ADR-0006. |
| [0003](0003-selfcheck-report-posted-after-work.md) | 2026-07-09 | The §5 selfcheck report must precede the first edit — posted after the work it's a receipt, not a checkpoint. Single-turn agent harnesses bypass it unless told to stop; SELFCHECK §5 now demands post-then-wait before any branch/edit. |
| [0004](0004-postwork-gates-never-fired.md) | 2026-07-09 | "Tests green + commit" is not done: docs sync sweep, two-axis review, and E2E all lived only in the PR template, so a session ending at commit never saw them. SELFCHECK §6 (post-work gates) now requires ending the final report with each gate closed-with-evidence or explicitly OPEN — including when a skill/tool is unavailable in the harness. |
| [0006](0006-docs-commit-direct-to-main-drift.md) | 2026-07-10 | A "just a note" docs commit made directly on local `main` (skipping branch+PR) sat unpushed while origin gained other commits — coders then branched from the phantom SHA and PR #112 carried the stray commit. Docs changes take the branch+PR path too; before dispatching coders, `git fetch && git status -sb` must show main neither ahead nor behind origin. |
| [0005](0005-external-agent-green-but-buggy-e9.md) | 2026-07-09 | Green ≠ correct when tests are self-authored: an external agent's "247 green, combined cleanly" E9 build hid real bugs (wrong-port trades, silent route deadlock, duplicated pre-advance tick phase) behind weak assertions, and its PRs (#107/#108) pointed at raw conflicting branches while the clean code sat on an orphan branch with no PR. For externally-built work, audit vs ACs + strengthen tests before trusting green; never accept `lint --fix`/`--no-verify` as merge resolution. |
| [0007](0007-windows-shell-encoding-mojibake.md) | 2026-07-12 | On Windows, piping gh/git text through python/PowerShell re-encodes UTF-8 as cp1250 mojibake silently (₸→"â‚¸") — PR #135's body got garbled by a `gh pr view \| python \| gh pr edit` roundtrip. Never roundtrip text through a pipe; write a UTF-8 file and use `--body-file` / `git commit -F`. |
| [0008](0008-wave-close-cwd-drift-and-wip-squash.md) | 2026-07-14 | A persistent shell that `cd`'d into a coder worktree stayed there: the wave's "certification on main" actually ran on the feature branch (content-identical, so valid — but the report was wrong; `git status` behind-1 was the tell). Print `pwd` + branch before any gate run. Also: GitHub squashes a single-commit PR with the *commit's* message — a rescue `wip(…)` commit became a permanent `main` message; make the final commit message merge-worthy before owner squash-merge. |
| [0010](0010-stacked-child-merged-into-base.md) | 2026-07-14 | A stacked child PR squash-merged into its already-merged base instead of main — GitHub happily lands a child on a stale base during batch-merging, showing "merged" while main lacks the content. Open a stacked child's PR only after its base merges (retargeted to main); after any merge batch, verify each PR's content is reachable from origin/main before deleting branches. |
| [0009](0009-sim-only-package-skipped-affected-e2e.md) | 2026-07-14 | A "sim-only, skip e2e" wave package hid a broken e2e fixture: the coder's (correct) `SAVE_VERSION` bump invalidated `e2e/fixtures/ledger-scenario.json`, caught only by CI. Affected-e2e keys on the **whole diff** (persistence, save shape, `e2e/fixtures/*`), not "did UI change"; packages state the heuristic, never a blanket "do not run e2e". Bonus lesson same round: golden tests must not pin engine-dependent bytes (`JSON.stringify` float hashes differ across V8 builds) — pin behavior contracts instead. |
| [0011](0011-certification-over-live-worktrees-false-red.md) | 2026-07-15 | A certification launched **while coder worktrees still existed** read as a false RED: `eslint .` over-scanned the in-tree `.claude/worktrees/*/src` copies (326 spurious errors) and Playwright flaked 4 `fleet.spec.ts` tests under resource contention. `main` was green (clean-tree re-run 84/84). Wave-close order: verify content on origin/main → `git worktree remove` + branch cleanup → **then** certify (clean `git worktree list` is the go-signal). Structural driver: this repo's worktrees live inside the tree. |
| [0012](0012-double-provisioned-worktree-sandbox-asymmetry.md) | 2026-07-15 | Dispatching coders with **both** `isolation: "worktree"` **and** a manual `git worktree add` double-provisions: the harness sandboxes Edit/Write to *its* per-agent worktree while the prompt names the manual one → tools lock to the wrong path. Pick one mechanism (keep `isolation`, drop the manual add + hardcoded path; push `HEAD:<target-branch>`). Two sharper lessons: **the sandbox is asymmetric — Bash writes the "forbidden" worktree freely, so isolation is not a Bash containment boundary**; and **resume-after-crash can silently drop an in-flight advisor call** — re-issue it in the resume message. Work recovered intact both branches (#248/#249). |
| [0014](0014-fixloop-fresh-coder-without-isolation.md) | 2026-07-16 | Near-miss: a wave fix-loop was dispatched as a **fresh** coder (no `isolation: "worktree"`, prompt pointing at a nonexistent "assigned worktree") instead of resuming the branch-owning coder — stopped before it acted, main verified clean. Fix-loops are resumes by definition; "small follow-up task" is exactly when dispatch discipline silently drops. |
| [0015](0015-review-subagent-inherited-frontier-model.md) | 2026-07-16 | A strong-tier review dispatched as `general-purpose` without `model` silently inherited the **driver's frontier model** — no error signal, cost hidden in the shared limit, exposed only by an asymmetric outage (frontier-pool-only 529s) after six costly resumes. Ad-hoc dispatches name `model` explicitly (CLAUDE.md §Git & worktrees); bonus: the model ladder doubles as outage resilience — recast the rung, keep the work. |
| [0016](0016-skill-fanout-overrode-tiered-review-gate.md) | 2026-07-17 | The #288 `src/sim` wave check ran through the generic `/code-review` skill (two-subagent fan-out) instead of the tier-3 shape (**one** two-axis packaged subagent) — ~2× review cost, caught by the owner mid-review. Systemic cause: skill descriptions sit in every session's context while the tier table lives in a file, and repo docs used "/code-review" as shorthand for the gate. Fix: gate-shape line in CLAUDE.md, step-0 repo-deference clause in the skill, shorthand scrubbed. Lesson: an always-in-context skill outshouts a rule in a file — counter at equal salience. |
| [0013](0013-stale-node-modules-false-red-cert.md) | 2026-07-15 | Certifying `main` after merging a deps-adding PR **without `npm install`** read as a false RED: `npm test` errored at collection and `tsc -b` failed on missing jest-dom matcher types (#187 added `@testing-library/*`+`jsdom`) — a stale `node_modules`, not a code regression. Same false-signal family as 0011. If a merge touched `package.json`/`package-lock.json`, `npm install` **before** certifying; a cert red whose signature is module-not-found / missing-type-from-a-just-added-package is stale-env until proven otherwise. |

## When to file

File a short report whenever:

- A rule in `CLAUDE.md`, an ADR, or a spec was broken or skipped (even if reverted).
- A command touched the wrong repo/branch/file, or did something hard to undo.
- Something surprised you in a way the next person should be warned about.

Cheap is the point. A report should take a few minutes and stay **within ~25 lines**
(cap, owner decision 2026-07-16) — What happened / Impact / Recommendation are the
load-bearing sections; the §Log one-liner is what future sessions actually read.
Existing longer reports stay as written; the cap applies forward.

## How

1. Copy the template below into `docs/incidents/NNNN-short-slug.md` (next free number).
2. Fill it in. Be specific about *what* and *how*, not *who* — names add nothing.
3. Land the recommended prevention in the same session if it's cheap; otherwise file
   an issue and link it under Follow-up.

## Severity

Rate two things separately — they often differ:

- **Outcome** — what actually happened this time (Low = reverted / no data loss …
  Critical = data or history lost, hard to recover).
- **Failure-mode class** — how bad the *same action* could be if it landed a step
  later or went uncaught. A benign outcome from a dangerous class is still a signal.

## Recurrence

Low / Medium / High, with the **structural driver** if there is one — a hazard baked
into the setup recurs; a one-off slip usually doesn't.

## Template

```markdown
# NNNN — <short title>

- **Date:** YYYY-MM-DD
- **Detected by:** <how it surfaced — self-report, verification step, CI, …>
- **Status:** Open | Closed (<how/when resolved>)

## What happened

<What and when. The sequence of actions, plainly. No blame.>

## Impact

- **Outcome:** <Low/Med/High/Critical> — <what actually resulted>
- **Failure-mode class:** <Low/Med/High/Critical> — <worst plausible version of the same slip>
- **Rules broken/skipped:** <cite CLAUDE.md § / ADR / spec, or "none">

## Recurrence

<Low/Medium/High> — <structural driver, if any>

## Recommendation

- **Prevent:** <cheap standing fix, if any>
- **Detect:** <how we'd catch it — already in place or proposed>
- **Contain:** <accepted residual risk, when a full fix isn't worth it>

## Follow-up

<Landed change, or linked issue, or "none — accepted">
```
