# Verification gates (tiered) — the wave check

Verification cost scales with a change's **risk surface**, not flat ceremony (#162 grill,
[tiered-verification-gates-2026-07-14](../design-notes/tiered-verification-gates-2026-07-14.md)).
The Orchestrator dispatches coders with self-contained packages, then closes the repo-level
gates **once per wave** — not once per issue.

## Coder minimum

Lives in [personas/CODER.md](../personas/CODER.md) §The coder minimum, not here (owner
decision 2026-07-28): a role's canonical checklist belongs in that role's file. The
Orchestrator hands it to the coder in the package; the driver's own pre-work routine
(`CLAUDE.md` §Before you start) does not bind the coder.

## Wave check

Run by the Orchestrator after the coder reports, before merges. The tier follows
mechanically from the wave's combined `git diff --stat`; escalate up freely, never downgrade
below what the paths dictate:

| Tier | Wave touches | Check |
| --- | --- | --- |
| 1 | docs/infra only | Session driver inline: diff vs ACs + docs-sweep greps. No subagents. |
| 2 | UI only (no `src/sim`) | **One** review subagent on the cheap model tier, given a distilled package (ACs, ADR-0006, area scars) — it never re-derives repo context. Affected e2e specs already ran coder-side. |
| 3 | `src/sim` / economy / multi-file wave | **One** two-axis (Standards + Spec) review subagent on the strong model tier, reading the whole wave's diffs in one context, package supplied. |

## Behavior-preserving exemption

Owner ruling 2026-07-19, #316. A wave whose `src/sim` diff is a **pure rename or move** — no
changed logic, no changed constant value, no changed public shape — drops to **tier 1**.

It holds only if **the existing suite passes with no assertion changed and no test added or
removed.** An edited expectation withdraws the exemption — escalate back to the paths' tier.
Mechanical identifier updates following the rename are fine; changed expected *values* are
not. `npm run check:behavior-preserving <baseRef> [headRef]` (#332) surfaces every changed
assertion line and hard-fails on an added or deleted test file — a surfacer, not a verdict.

**State the evidence when claiming it:** before/after test counts, and that no assertion
moved. Written down rather than waived in conversation, because a gate waived in conversation
is invisible to the next session (incident 0017).

## The review package

At every tier the package names the repo's scar tissue explicitly: the ACs, the epic spec,
**all ADRs** (by list — a title may not betray which laws it carries; ADR-0007 holds the
SAVE_VERSION rule), and [incidents/README.md](../incidents/README.md) §Log. **Sources left
out of the package are sources left out of the review** — in the #286 A/B both arms missed the
ADR-0007 save-versioning precedent because no package pointed at it.

Closing a wave check includes appending one row per coder PR to
[design-notes/coder-scorecard.md](../design-notes/coder-scorecard.md) (findings, fix-loop
rounds, cert outcome) — the durable sample behind coder-model decisions.

## Model ladder

The session driver (most expensive rung) composes packages, reads reports, and decides — it
does not read whole diffs, write code, or run line-by-line review. Reviews run one rung down;
coding two rungs down. Implementing directly in-session is allowed only when delegation
overhead exceeds the task *and* the session driver is not the most expensive rung.

## Fix loop

Findings return to the *same* coder via resume (full transcript, zero re-orientation); a fresh
coder only when that context is bloated or stale. Micro-exception: the session driver may
apply a purely mechanical one-liner (typo, missing `aria-label`) directly — **every such fix
is logged in the wave report**; anything behavioral goes back to the coder. The re-check
scales to the fix, not the wave (a fix touching `src/sim` → tier 3 on the fix's diff).

## E2E certification points

Affected specs per PR (coder-side). One full Playwright run on `main` after all of a wave's
PRs merge — red returns the wave to the fix loop, never "merged, fix later". Full run +
baseline (tests, typecheck, lint) at epic/milestone close.

Every certification run starts by printing `pwd` + `git branch --show-current` and stops on a
mismatch — a persistent shell may still sit in a coder worktree (incident 0008). **Cert order
is law:** reachability from `origin/main` first — a merged PR's squash-commit is an *ancestor*
of `origin/main`, not merely "the content looks present" (incident 0010) — then worktrees
removed and branches pruned, a clean `git worktree list` being the go-signal (incident 0011),
then `npm install` if the merge touched `package.json`/lock (incident 0013).
`scripts/postmerge.ps1` walks all three and refuses to report CLEAN when it verified nothing.

## Milestone playtest law

Owner lock, 2026-07-15. No milestone closes on green metrics alone: an owner playtest is part
of every milestone's close. The harness (E11) screens balance and solvency so the playtest is
spent judging *fun* — the one signal no model or metric replaces.

## Batching

2–4 small same-area issues per coder package, and **by default one PR for the batch** (owner
rule 2026-07-16) — per-issue ceremony was splitting hairs on issues this small. The PR body
lists `Closes #n` for **every** issue it lands, and the wave check still verifies each issue's
acceptance criteria **separately**. Split only when issues are genuinely independent *and*
each earns its own review, or when one diff would bloat past comfortable review.

A batched PR also sidesteps stacks. When a hard dependency still forces one, the child's PR
opens only **after** its base has merged, already retargeted to `main` — a child PR based on a
feature branch invites the batch-merge trap of incident 0010. After any merge batch, verify
each PR's content is reachable from `origin/main` before deleting branches.

## PR timing

Coders push branches and report; **PRs open only after the wave check closes** (the
Orchestrator opens them, or explicitly instructs the coder to). An open PR invites a
pre-review merge, inverting the gate order — the owner merges on sight of green CI (owner
decision 2026-07-14, after it happened in E3 wave 2).

## Definition of done (per issue)

- Acceptance criteria met.
- Tests pass; new sim behavior has tests written first.
- Typecheck and lint clean.
- `CONTEXT.md` updated if a new domain term appeared; spec updated if behavior drifted.
