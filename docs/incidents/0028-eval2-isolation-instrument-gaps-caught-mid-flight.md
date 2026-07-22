# 0028 — eval-2 isolation/instrument gaps caught mid-flight (three near-misses)

- **Date:** 2026-07-22
- **Detected by:** self-audit + advisor + owner, each before the affected measurement ran.
- **Status:** Closed (all three fixed before any arm/ruler measurement was contaminated).

## What happened

Running eval-2 (delegation eval on a behavior-preserving refactor, #379), three isolation/instrument
gaps surfaced that the frozen pre-registration had not anticipated. None reached a measurement — each
was caught in the window between setup and dispatch.

1. **Tip-only strip left the rubric in git history, and "temporal isolation is free" broke when the OS
   arm ran first.** `eval2-baseline` was derived by `git rm` of `docs/design-notes/` + `HANDOFF.md` on a
   branch off the net-baseline. That removes the files from the *tip tree* but the freeze commit
   (`c049b30`, full rubric + paste-kits) remained reachable via `git show`/`git log -p`. Separately, the
   design's "no reference solution exists yet" assumption silently expired the moment OS was measured
   first as arm 1 — its three branches + PRs became a complete reference solution reachable on `origin`
   via `git branch -r` / `git log --all`. Both violate the design's own standard ("remove the object,
   don't trust the arm not to look").

2. **Prompt ↔ CLAUDE.md conflict on "read HANDOFF."** The frozen arm prompt said "read CLAUDE.md … and
   do not read docs/HANDOFF.md." But `CLAUDE.md` §Rules itself instructs "session start: read
   docs/HANDOFF.md." Both GPT solos, reading CLAUDE.md as told, followed it and probed HANDOFF — a
   prompt-vs-repo-doc contradiction the prompt created, resolved identically by both arms.

3. **GPT/Codex auto-named the branch `codex/…`, leaking authorship to the ruler.** Terra's harness
   pushed `codex/refactor-fleet-overlays-routes`; the `codex/` prefix hands the (author-blind) ruler the
   producer's identity, activating the same-vendor-reviewer threat. Sol and OS had author-neutral
   `refactor/…` names, so it had not shown up earlier.

## Impact

- **Outcome:** Low — none contaminated a measurement. (1) was closed before any solo arm was handed a
  baseline; (2) resolved harmlessly because the object was already stripped from `eval2-baseline` (the
  probe hit an absent file); (3) was caught before the Terra ruler launched.
- **Failure-mode class:** High — any of the three, unnoticed, would have let an arm or ruler reach the
  rubric or the reference solution, or biased the reviewer — silently invalidating the arm's datapoint.

## Recurrence

Medium, and structural: the pre-registration reasoned about *content* isolation (strip the files) and
about *ordering* (freeze the OS package first), but not about **git-history reachability**, **arm
sequencing turning a control into a reference solution**, or **harness-assigned branch names**. These
are setup-level properties easy to assume rather than verify.

## Recommendation

- **Hand every arm and ruler a shallow single-branch clone**, not a checkout/worktree of a repo that
  shares an object store: `git clone --depth N --single-branch --branch <ref>`. `--depth` seals the
  rubric out of history (the freeze commit becomes unreachable); `--single-branch` keeps other arms'
  branches out. Verify before handing over: `git log --oneline --all` is the expected short length,
  `git branch -r` shows only the intended ref, `git show <rubric-commit>` errors.
- **Neutralize the prompt↔onboarding conflict**: either strip CLAUDE.md's "read HANDOFF" line in the
  arm baseline too, or have the prompt explicitly override that onboarding step. Instruction-only
  isolation is insufficient by the eval's own standard — remove the object.
- **Rename harness-assigned branches to an author-neutral alias before ruler dispatch** (same commit,
  different ref); verify the commit message itself carries no author signal.
- **When a control arm runs first, treat its output as a live reference solution** and isolate later
  arms from it structurally — do not rely on the "no solution exists yet" assumption past arm 1.

## Follow-up

Landed same session: all three fixes applied and dry-run-verified; results recorded in the eval doc's
RESULTS §; this report. The "read HANDOFF" probe was reclassified from an arm conformance defect to a
shared instrument artifact in the eval verdict.
