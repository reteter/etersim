# Incidents

A blameless log of times work deviated from the project's rules, docs, or intent —
including **near-misses** where nothing broke but easily could have. The point is
learning, not blame: we work in **report → fix → don't repeat**, never in punishment.
A near-miss reported is a free lesson; a near-miss hidden is a future outage.

## Log

**One line per incident**, ordered by number so a citation like "incident 0010" is
findable: what happened, and what to watch for. Enough to decide whether an entry
touches what you are doing — the report holds the evidence, the analysis and the fix.

The line is a *pointer*, not a summary. It stays one sentence even when the report is
long; a log whose rows grow into paragraphs stops being an index and becomes a second
document to read (it did — rows averaged 699 characters before the 2026-07-28 trim).

| # | Date | Lesson / watch for |
| --- | --- | --- |
| [0001](0001-worktree-cd-main-branch-switch.md) | 2026-07-08 | A coder subagent in a worktree entered the main repo and acted on `main`. Verify main is clean and on the expected SHA after every coder wave. |
| [0002](0002-gold-highlight-color-collision.md) | 2026-07-08 | Near-miss: gold `#e0a840` reused for a price-board highlight. It belongs to the Controlled Ship alone (ADR-0006, one colour one meaning). |
| [0003](0003-selfcheck-report-posted-after-work.md) | 2026-07-09 | The pre-work report was posted after the work, making it a receipt rather than a checkpoint. Post it and wait, before the first edit. |
| [0004](0004-postwork-gates-never-fired.md) | 2026-07-09 | Tests-green-plus-commit was treated as done while the docs sweep, review and E2E lived only in the PR template. End the final report with every gate closed-with-evidence or explicitly OPEN. |
| [0005](0005-external-agent-green-but-buggy-e9.md) | 2026-07-09 | An external agent's 247-green build hid real bugs behind weak self-authored assertions. Green is a data point, not a verdict: audit against ACs and strengthen tests before trusting it. |
| [0006](0006-docs-commit-direct-to-main-drift.md) | 2026-07-10 | A docs commit straight to local `main` sat unpushed; coders then branched from a phantom SHA. Before dispatching, `git status -sb` must show main level with origin. |
| [0007](0007-windows-shell-encoding-mojibake.md) | 2026-07-12 | Piping `gh`/`git` text through python or PowerShell on Windows silently mangles UTF-8. Write a UTF-8 file and use `--body-file` / `git commit -F`. |
| [0008](0008-wave-close-cwd-drift-and-wip-squash.md) | 2026-07-14 | A persistent shell stayed in a coder worktree, so certification-on-main actually ran on the feature branch. Print `pwd` + branch before any gate run. Also: GitHub squashes a one-commit PR using that commit's message. |
| [0009](0009-sim-only-package-skipped-affected-e2e.md) | 2026-07-14 | A sim-only, skip-e2e package hid a broken fixture invalidated by a `SAVE_VERSION` bump. Affected-e2e keys on the whole diff (persistence, save shape, `e2e/fixtures/*`), never on whether UI changed. |
| [0010](0010-stacked-child-merged-into-base.md) | 2026-07-14 | A stacked child PR squash-merged into its already-merged base, reading as merged while main lacked the content. Open a child only after its base merges; verify reachability from `origin/main` before deleting branches. |
| [0011](0011-certification-over-live-worktrees-false-red.md) | 2026-07-15 | Certifying while coder worktrees still existed gave a false RED (`eslint` over-scanned in-tree worktree copies). Remove worktrees first; a clean `git worktree list` is the go-signal. |
| [0012](0012-double-provisioned-worktree-sandbox-asymmetry.md) | 2026-07-15 | `isolation: "worktree"` plus a manual `git worktree add` double-provisions and locks Edit/Write to the wrong path. Pick one mechanism. The sandbox is asymmetric: Bash writes the forbidden worktree freely. |
| [0013](0013-stale-node-modules-false-red-cert.md) | 2026-07-15 | Certifying after a deps-adding merge without `npm install` read as a false RED. A cert red whose signature is module-not-found is a stale environment until proven otherwise. |
| [0014](0014-fixloop-fresh-coder-without-isolation.md) | 2026-07-16 | Near-miss: a fix-loop was dispatched as a fresh coder pointed at a nonexistent worktree. Fix-loops are resumes by definition; a small follow-up is exactly when dispatch discipline slips. |
| [0015](0015-review-subagent-inherited-frontier-model.md) | 2026-07-16 | An ad-hoc review dispatched without `model` silently inherited the driver's frontier model, with no error and hidden cost. Every ad-hoc dispatch names its model explicitly. |
| [0016](0016-skill-fanout-overrode-tiered-review-gate.md) | 2026-07-17 | A `src/sim` wave check ran through the generic `/code-review` skill (two subagents) instead of the tier-3 shape (one), doubling cost. An always-in-context skill outshouts a rule in a file; counter it at equal salience. |
| [0017](0017-casting-override-lived-only-in-prose.md) | 2026-07-17 | A casting override lived only in prose while the agent def said otherwise, so the wave ran on the wrong tier. An override is real only in def frontmatter or an explicit dispatch `model:`. |
| [0018](0018-gh-auth-switch-leaves-git-credentials-stale.md) | 2026-07-19 | `gh auth switch` does not move git's credential cache. There is no cheap read-only tell (`git ls-remote` passes under the wrong identity), so the first write is the test. Never `gh auth setup-git` on a machine you do not own. |
| [0019](0019-postmerge-reported-clean-after-failed-remote-delete.md) | 2026-07-19 | `postmerge.ps1` announced a branch delete that had just failed with 403, then reported CLEAN. Never announce a destructive action without checking it happened; a guard is as good as its least-checked line. |
| [0020](0020-crashing-grep-counted-as-zero.md) | 2026-07-19 | A crashing `grep` piped into `wc -l` was counted as zero, and the sweep reported ten fabricated orphan terms. Never pipe a command into a counter and treat the count as the result; anchor corpus-wide counts against a known answer. |
| [0021](0021-next-task-started-on-the-previous-prs-branch.md) | 2026-07-19 | Near-miss: the next task's edits landed on the previous PR's branch, because that sequence ends on the feature branch and nothing returns to `main`. Pushing a PR ends the task; re-verify the branch first. |
| [0022](0022-budget-pressure-dissolved-the-selfcheck.md) | 2026-07-20 | Under budget pressure the driver silently classified the session as not-a-task, skipped the pre-work check and merged its own PR. Budget pressure is a solvent on ceremony: the report is required especially when it feels unnecessary. |
| [0023](0023-cross-platform-float-toString-in-golden-digest.md) | 2026-07-21 | A golden digest pinned full float precision and failed CI: `Math.pow` is not bit-identical across platforms. Round floats in any pinned fixture; pin behaviour contracts, not engine bytes. |
| [0024](0024-float-ulp-recurred-uncited-in-307.md) | 2026-07-21 | 0023 recurred one PR later because neither the dispatch nor the review package cited it by number. Cite known incidents by number in task packages instead of relying on rediscovery. |
| [0025](0025-worktree-isolation-not-provisioned-async-dispatch.md) | 2026-07-22 | `isolation: "worktree"` provisions a worktree only for background agents; a synchronous coder silently shares the driver's main checkout. Always dispatch coders in the background. |
| [0026](0026-cwd-drift-recurred-mid-session-now-mechanized.md) | 2026-07-22 | The cwd-drift class recurred a third time, minutes after its incident had been read and cited. Prose does not fire at the moment of risk; mechanized as `.claude/hooks/git-worktree-guard.sh`. |
| [0027](0027-force-deleted-branches-under-owner-hold.md) | 2026-07-22 | Session-start pruning force-deleted two unmerged branches under an owner hold; `-D` overrides git's own refusal where `-d` would have stopped. Mechanized as `.claude/hooks/git-branch-delete-guard.sh`, which asks rather than denies. |
| [0028](0028-eval2-isolation-instrument-gaps-caught-mid-flight.md) | 2026-07-22 | Three eval isolation gaps caught mid-flight: a tip-only strip left the rubric in git history, an earlier arm became a reference solution on origin, and auto-naming leaked authorship. Use shallow single-branch clones per arm and neutralize branch names before ruler dispatch. |
| [0029](0029-engineer-hat-worn-silently-unvalidated-feasibility.md) | 2026-07-22 | Two grill forks that were feasibility questions in disguise were locked as Designer decisions carrying unchecked Engineer claims. A feasibility-shaped fork is an Engineer-hat trigger: announce it and name the test before the owner locks. |
| [0030](0030-detector-merged-red-never-run.md) | 2026-07-28 | `check:triggers` had never exited 0 and sat in no gate, so the repo believed a law was mechanically enforced while nothing ran it. A tool that encodes a law is not the law being enforced: merge a detector green and wired to a gate in the same PR — or say plainly that a human enforces it. Closed the same day (#412): reclassified as a surfacer that exits 0 and gates nothing. |
| [0031](0031-tier1-declared-with-half-the-check-run.md) | 2026-07-28 | Tier 1 was declared having run only the diff-vs-ACs half; knowing which documents recorded the decision stood in for the docs-sweep greps, which then found two live falsehoods. A tier claim names the command it ran and its output. |

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
