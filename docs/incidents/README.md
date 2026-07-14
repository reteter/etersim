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
| [0008](0008-wave-close-cwd-drift-and-wip-squash.md) | 2026-07-14 | A persistent shell that `cd`'d into a coder worktree stayed there: the wave's "certification on main" actually ran on the feature branch (content-identical, so valid — but the report was wrong; `git status` behind-1 was the tell). Print `pwd` + branch before any gate run. Also: GitHub squashes a single-commit PR with the *commit's* message — a rescue `wip(…)` commit became a permanent `main` message; make the final commit message merge-worthy before owner squash-merge. (0007 reserved for #136.) |

## When to file

File a short report whenever:

- A rule in `CLAUDE.md`, an ADR, or a spec was broken or skipped (even if reverted).
- A command touched the wrong repo/branch/file, or did something hard to undo.
- Something surprised you in a way the next person should be warned about.

Cheap is the point. A report should take a few minutes. If it takes an hour, the
template is wrong — trim it.

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
