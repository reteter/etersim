# Verification gates (tiered) — the wave check

Verification cost scales with a change's **risk surface**, not flat ceremony (#162 grill,
[tiered-verification-gates-2026-07-14](../design-notes/tiered-verification-gates-2026-07-14.md)).
Dispatch coders with self-contained packages, then close the repo-level gates **once per wave** —
not once per issue.

## Coder minimum

Lives in [personas/CODER.md](../personas/CODER.md) §The coder minimum:
a role's checklist belongs in that role's file.
Hand it to the coder in the package.
The driver's own pre-work routine (`CLAUDE.md` §Before you start) does not bind the coder.

## Wave check

Run after the coder reports, before merges.
The tier follows mechanically from the wave's combined `git diff --stat`;
escalate up freely, never downgrade below what the paths dictate.

| Tier | Wave touches | Check |
| --- | --- | --- |
| 1 | docs/infra only | Session driver inline: diff vs ACs + docs-sweep greps. No subagents. |
| 2 | UI only (no `src/sim`) | **One** review subagent on the cheap model tier, given a distilled package (ACs, ADR-0006, area scars) — it never re-derives repo context. Affected e2e specs already ran coder-side. |
| 3 | `src/sim` / economy / multi-file wave | **One** two-axis (Standards + Spec) review subagent on the strong model tier, reading the whole wave's diffs in one context, package supplied. |

## Behavior-preserving exemption

A wave whose `src/sim` diff is a **pure rename or move** —
no changed logic, no changed constant value, no changed public shape —
drops to **tier 1** (owner ruling 2026-07-19, #316).

It holds only while **the existing suite passes with no assertion changed and no test added or removed.**
An edited expectation withdraws it —
escalate back to the paths' tier.
Mechanical identifier updates following the rename are fine;
changed expected *values* are not.

Run `npm run check:behavior-preserving <baseRef> [headRef]` (#332):
it hard-fails on an added or deleted test file and surfaces every changed assertion line.
Surfacer, not verdict.

**Claiming the exemption means stating the evidence**:
before/after test counts, and that no assertion moved (incident 0017).

## The review package

At every tier the package names, explicitly:
the ACs, the epic spec, **all ADRs by list** (a title may not betray which laws it carries —
ADR-0007 holds the SAVE_VERSION rule), and [incidents/README.md](../incidents/README.md) §Log. **Sources left out of the package are sources left out of the review**
(#286 A/B).

Closing a wave check includes appending one row per coder PR to
[design-notes/coder-scorecard.md](../design-notes/coder-scorecard.md):
findings, fix-loop rounds, cert outcome.

## Model ladder

The session driver (most expensive rung) composes packages, reads reports, and decides —
it does not read whole diffs, write code, or run line-by-line review.
Reviews run one rung down;
coding two rungs down.
Implement in-session only when delegation overhead exceeds the task *and* the session driver is not
the most expensive rung.

## Fix loop

Findings return to the *same* coder via resume;
a fresh coder only when that context is bloated or stale.
The session driver may apply a purely mechanical one-liner (typo, missing `aria-label`) directly and **logs every such fix in the wave report**;
anything behavioral goes back to the coder.
The re-check scales to the fix, not the wave —
a fix touching `src/sim` is tier 3 on the fix's diff.

## E2E certification points

- **Per PR:** affected specs, coder-side.
- **After all of a wave's PRs merge:** one full Playwright run on `main`. Red returns the wave
  to the fix loop — never "merged, fix later".
- **At epic/milestone close:** full run + baseline (tests, typecheck, lint).

Cert order and its per-step commands are law and live in `CLAUDE.md` §Git & worktrees (wave close).
Run `scripts/postmerge.ps1` unless you have a reason not to.

## Milestone playtest law

No milestone closes on green metrics alone:
an owner playtest is part of every milestone's close (owner lock, 2026-07-15).
The harness (E11) screens balance and solvency so the playtest is spent judging *fun* —
the one signal no model or metric replaces.

## Batching

2–4 small same-area issues per coder package, **one PR for the batch** by default (owner rule
2026-07-16).
The PR body lists `Closes #n` for **every** issue it lands, and the wave check verifies each issue's
acceptance criteria **separately**.
Split only when issues are genuinely independent *and* each earns its own review, or when one diff
would bloat past comfortable review.

A batched PR also sidesteps stacks.
When a hard dependency forces one, the child's PR opens only **after** its base has merged, already
retargeted to `main` (incident 0010).

## PR timing

Coders push branches and report; **PRs open only after the wave check closes**
—
the Orchestrator opens them, or explicitly instructs the coder to.
An open PR invites a merge on sight of green CI, which inverts the gate order (owner decision
2026-07-14).
This rule got *more* load-bearing on 2026-07-29, not less:
since the driver now merges its own PRs ([ADR-0010](../adr/0010-the-driver-merges.md)), no human
stands between an early-opened PR and `main`.
Timing is what protects the gate order.

## Definition of done (per issue)

- Acceptance criteria met.
- Tests pass; new sim behavior has tests written first.
- Typecheck and lint clean.
- `CONTEXT.md` updated if a new domain term appeared; spec updated if behavior drifted.
