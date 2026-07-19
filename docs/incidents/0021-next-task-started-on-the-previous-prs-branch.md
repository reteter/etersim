# 0021 — The next task started on the previous PR's branch (near-miss)

**Date:** 2026-07-19 (s14)
**Severity:** near-miss — caught before the commit; nothing landed wrong.
**Reported by:** the driver, about the driver.

## What happened

Sweep finding F5's generalisation was committed on branch `docs/trigger-is-a-promise` and
pushed as PR #327. Work then continued **immediately** into the next item — sweep F10 — and
four files were edited: a new `docs/adr/0009-no-direct-combat.md`, plus `docs/PRD.md`,
`docs/design-notes/grill-brief-m6-zoom-out.md` and `docs/design-notes/design-surface-sweep.md`.

All four were edited **on `docs/trigger-is-a-promise`**, the branch whose PR the owner had
already been handed for review.

Caught at `git status -sb`, run out of habit before committing — not by any rule.

## What it would have cost

Committing would have pushed F10's diff onto #327, silently. The PR body would then have
described a documentation law while the diff also carried an ADR, a PRD scope rewrite and
two note edits. **The worst shape a PR can take is one whose body no longer describes its
diff**, because review reads the body first, and the owner had already been asked to merge it.

Recovery was cheap only because nothing had been committed: the four files were copied aside,
the branch reverted with `git checkout --`, a new branch cut from `main`, the files restored,
and the two `design-surface-sweep.md` edits re-applied by hand against main's version (the
law commit had touched that same file, so a straight copy would have duplicated its change).

## Why it happened

The branch → commit → push → PR sequence **ends on the feature branch**. Nothing in it
returns to `main`, and nothing needs to — until a *second* work item begins.

In every prior session that gap stayed shut, because a work item ended with the owner's merge,
and a merge forces `git checkout main` as part of `postmerge`. **The gap only opens when two
PRs are prepared back-to-back with no merge between them** — which is exactly the shape of a
docs-heavy decision session, and s14 was four of those in a row.

`docs/SELFCHECK.md` §5 already requires the branch to be named (`env: <branch, baseline>`), so
the checklist's *content* was not missing anything. What was missing was a rule about **when
it fires again**. A continuous session slides from one item to the next without any moment
that says "this is a new task".

## Fix

`docs/SELFCHECK.md` §5 now states that **pushing a PR ends the task**: the next work item
takes a fresh selfcheck, and at minimum re-verifies the `env:` line before the first edit.

## The lesson worth carrying

The tell was available on every single command — `git status -sb` prints the branch — and
cost nothing to read. It was not read because **nothing obliged reading it.**

That is the same finding s14 spent its whole session documenting
(`docs/design-notes/knowing-is-not-binding-2026-07-19.md`): a system acts on what obliges it,
not on what it knows. Filed deliberately, because the alternative — a session that produces a
law about unenforced knowledge and then quietly absorbs its own instance of it — would be the
exact defect, one level up.
