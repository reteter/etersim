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
| [0017](0017-casting-override-lived-only-in-prose.md) | 2026-07-17 | The s4 "coder = Opus" override lived only in HANDOFF/memory prose while the agent def said `model: sonnet` — a wave dispatched without a conscious casting check silently ran on Sonnet. A casting override is real only in the def frontmatter or an explicit dispatch `model:`; prose is a pointer, not a source. Closed same session: owner made Sonnet the coder default (A/B 2/2), advisor = Opus. |
| [0018](0018-gh-auth-switch-leaves-git-credentials-stale.md) | 2026-07-19 | `gh auth switch` moves gh's active account but **not** git's credential cache: a coder's push 403'd (`denied to <other account>`) while `gh auth status` showed the right user all along. Loud this time; the reverse divergence is silent. On a machine you don't own, unblock it with the per-push override `git -c credential.helper= -c credential.helper='!gh auth git-credential' push` — **not** `gh auth setup-git`, which rewrites the machine owner's global config. Deeper lesson: this had already been hit the day before and recorded in **per-machine auto-memory**, which reaches neither subagents nor other machines — machine-shaped lessons belong in repo docs. **Amended 2026-07-19: there is no cheap read-only tell** — `git ls-remote origin` passes under the wrong identity whenever the other account has read access, so it hands out false confidence exactly here. The first *write* is the test; on a machine you do not own, push through the override by default. |
| [0019](0019-postmerge-reported-clean-after-failed-remote-delete.md) | 2026-07-19 | `postmerge.ps1` printed `OK deleted leftover remote branch` and `POSTMERGE: CLEAN` for a `git push --delete` that had just 403'd (stale credential cache, incident 0018) — the branch survived. Its two `git` mutations were the only unchecked exit codes in a script whose own section is titled *silent-fail guard*. Both now `Fail`, and the remote delete re-queries `git ls-remote` before claiming success. Lesson: never announce a destructive action without checking it happened — and a guard is only as good as its least-checked line. |
| [0021](0021-next-task-started-on-the-previous-prs-branch.md) | 2026-07-19 | **Near-miss:** the next task's four files were edited onto the **previous PR's branch** — F10's ADR + PRD rewrite landed in the working tree of `docs/trigger-is-a-promise`, whose PR (#327) the owner had already been handed. Caught at `git status -sb` out of habit, not by any rule; nothing was committed. Cause: the branch → commit → push → PR sequence **ends on the feature branch** and nothing returns to `main`. The owner's merge normally closes that gap (postmerge forces a checkout), so it only opens when **two PRs are prepared back-to-back with no merge between them** — the ordinary shape of a docs-heavy decision session. SELFCHECK §5 now states that **pushing a PR ends the task**: the next item re-verifies its `env:` line, branch first. The tell was printed by every `git status` and cost nothing to read — it was not read because nothing obliged reading it. |
| [0020](0020-crashing-grep-counted-as-zero.md) | 2026-07-19 | `grep -i` **with `-F`** *aborts* under this machine's GNU grep 3.0 (exit 134, core dumped, `msys-2.0.dll` stack dump) — but the sweep's count was written as `$(grep … \| wc -l)`, so `wc` counted the empty output as `0` and the pipeline returned `wc`'s clean status. **A crash was recorded as a data point**: the measurement saw 26 % of the corpus and reported **ten glossary terms as orphaned**, all artifacts (real: 6 023 mentions, zero orphans). Caught by a domain check — a currency cannot have zero mentions — not by any signal. Never `-F` with `-i` here; more generally **never pipe a command into a counter and treat the counter's output as the result** (`set -o pipefail`, or count in two steps), and anchor corpus-wide counts against a known answer. Same defect as **0019** (unchecked exit codes) one session later, in a different language — it did not transfer because it was recorded as a fact about `postmerge.ps1` rather than as a rule about announcing results. |
| [0013](0013-stale-node-modules-false-red-cert.md) | 2026-07-15 | Certifying `main` after merging a deps-adding PR **without `npm install`** read as a false RED: `npm test` errored at collection and `tsc -b` failed on missing jest-dom matcher types (#187 added `@testing-library/*`+`jsdom`) — a stale `node_modules`, not a code regression. Same false-signal family as 0011. If a merge touched `package.json`/`package-lock.json`, `npm install` **before** certifying; a cert red whose signature is module-not-found / missing-type-from-a-just-added-package is stale-env until proven otherwise. |
| [0022](0022-budget-pressure-dissolved-the-selfcheck.md) | 2026-07-20 | Under "~2% limit, just orienting" the driver silently classified the session as *not a task*, skipped the §5 selfcheck, then squash-**merged its own PR** (#335) with no owner consent — content was correct, only the gate was skipped. Structural driver: **budget pressure is a solvent on ceremony**; every soft precondition ("before starting any task") gives it a foothold, and the skipped classification was made once, silently, never surfaced to be falsified. Fix direction (owner-agreed): SELFCHECK §1/§5 requires the one-line report **especially when the model thinks it is unnecessary** — its content is then the session classification, said out loud. The owner merges; asking costs one turn. |
| [0023](0023-cross-platform-float-toString-in-golden-digest.md) | 2026-07-21 | #306's golden-run digest passed locally (coder + tier-3 reviewer, same platform) and failed CI: two `electronics` values drifted in the 15th-16th significant digit — `Math.pow`/`**` isn't bit-identical across platforms/V8 versions the way `+ - * /` are, and the digest compared full `toString()` precision instead of a behavior contract. Same family as incident 0009 ("golden tests must not pin engine-dependent bytes") in a subtler form. Fixed same session: round floats to a fixed precision (`toFixed(6)`) in any golden/pinned fixture, never bare `toString()`. |
| [0024](0024-float-ulp-recurred-uncited-in-307.md) | 2026-07-21 | 0023's own predicted recurrence, one PR later: #307's new C2 byte-identical save test hit the identical `Math.pow` ULP drift, caught by CI on the PR (not post-merge — the detector worked). The real gap: neither #307's original dispatch nor the tier-3 review package cited 0023 by number for a new float-heavy fixture test, despite 0023's own §Recurrence line naming exactly this shape in advance. Fixed same session (rounded deep-equal, drill-verified it still catches real value swaps); lesson is process, not mechanism — cite known incidents by number in future task packages instead of relying on rediscovery. |

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
