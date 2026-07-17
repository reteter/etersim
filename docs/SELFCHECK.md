# Selfcheck — pre-work checklist for any model

Run this before starting work when the owner says so (typical prompt: *"Zanim
zaczniesz pracę wykonaj selfcheck zgodnie z docs/SELFCHECK.md"*). It is written for
**any** model working in this repo — Claude or not, with or without custom skills.
Assumption: you have already read the repo's `CLAUDE.md`; this checklist operationalizes
it. Work through the phases in order: §1–§5 **before** touching anything, §6 **before
declaring the work done**. If any check fails, stop at §7 — do not improvise around a
failed check.

**Scope:** this checklist binds the session-driving model (Orchestrator or solo) and
external agents. Coder subagents dispatched with a task package follow the **coder
minimum** instead (WORKFLOW.md §Verification gates; receiving side in
docs/personas/CODER.md) — not this document.

## 1. Identify the task, pick the gate

Name what kind of work you were asked to do — each kind has a different bar:

| Kind | Gate |
| --- | --- |
| **Design / grill / spec** | Conversation with the owner; never delegated; one question at a time; output lands in specs + CONTEXT.md + PRD (docs sync sweep, WORKFLOW.md). |
| **Implementation (issue)** | Approved spec exists; issue is in a milestone; TDD for `src/sim`; feature branch + PR; owner merges. |
| **Playtest analysis** | Verify each observation against code before classifying; route to grill / issue / parking lot; do not decide design. |
| **Docs-only change** | Branch + PR (exception: the session-close docs batch commits straight to `main` — WORKFLOW.md §Documentation law); sweep for stale cross-references (WORKFLOW.md §Docs sync sweep). |

If the task doesn't fit any row, ask the owner before proceeding.

## 2. Read set (in this order)

1. `CONTEXT.md` — the ubiquitous language. **Law: identifiers come from here; a new
   concept means a glossary entry first.** Skim fully; read your area closely.
2. `docs/WORKFLOW.md` — the pipeline (grill → spec → approval → issues → PR) and the
   stacked-PR merge procedure. Read before creating branches, issues or PRs.
3. `docs/PRD.md` — only the current milestone's section + success criteria.
4. `docs/incidents/README.md` **§Log** — one line per past incident; these are the
   repo's scars. Read the linked report only if it touches what you're about to do.
5. For implementation: the epic spec in `docs/specs/`, the GitHub milestone
   description (sequencing map), then the issue — **newest acceptance-criteria comment
   first, then the body** (a newer AC comment supersedes the body, WORKFLOW.md §4).

## 3. Environment checks (run these, don't assume)

```
git status              # clean? not mid-merge/rebase?
git branch --show-current   # know where you are; work happens on feature branches
git fetch origin --quiet && git status -sb   # main ahead/behind origin? diverged main blocks work — reconcile first (incident 0006)
git log --oneline -3        # matches origin/main's recent history?
git worktree list       # am I in a real worktree or a plain subdirectory? (see CLAUDE.md §Git & worktrees)
gh issue list --limit 20    # open work; find your issue and its milestone
npm test && npm run typecheck && npm run lint   # BASELINE green before you change anything
```

- A red baseline is **inherited breakage — report it, do not fix it silently and do
  not build on top of it.**
- Playwright: set a dedicated port (`PLAYWRIGHT_PORT=59xx npm run test:e2e`); port
  5173 may be squatted by a foreign dev server and `reuseExistingServer` will silently
  feed you a stale build. Never kill the foreign process.

## 4. Laws (break none of these)

1. **Determinism is sacred**: all sim randomness flows from the seeded RNG; no
   `Math.random`, no `Date.now` inside `src/sim` (ADR-0003).
2. **Sim purity**: `src/sim` imports no React/DOM, ever (ADR-0002). The Harness and UI
   import the sim, never the reverse.
3. **TDD for `src/sim`**: the failing test comes first by default; a test written
   after implementation requires named per-test red evidence (revert or targeted
   mutation), flagged in the report (grill 2026-07-17). UI is verified with Playwright.
4. **Glossary first**: new domain concept ⇒ CONTEXT.md entry before the identifier.
5. **Feature branch + PR, conventional commits, `Closes #n`.** Before merge: tests,
   typecheck, lint, and the wave check at the change's tier (WORKFLOW.md
   §Verification gates). **The owner merges — never merge your own PR without
   explicit owner consent.**
6. **Never act on `main`**: no commits, checkouts, resets. In a worktree, address git
   as `git -C <worktree>`; verify with `git worktree list` (incident 0001).
7. **Tuning ≠ spec drift**: constants marked as tuning may move without spec changes;
   behavior changes require updating the spec **in the same task**.
8. **Settled decisions stay settled**: ADRs and approved specs are not relitigated
   inline — link to them; new facts go to the owner (grill), not into quiet overrides.
9. **One color = one meaning** in UI (ADR-0006; incident 0002 — gold belongs to the
   Controlled Ship).
10. **English** in code, docs, commits, issues; Polish in conversation with the owner.

## 5. Report before you start

Post this (fill it in) as your first message after the selfcheck, **before creating a
branch or editing any file**, and wait for the owner's go-ahead unless the task prompt
explicitly said to proceed without one. Posted after the work it is a receipt, not a
checkpoint — the point is to catch misunderstandings while they are still free
(incident 0003).

**Short form is the default** (ceremony slim, owner decision 2026-07-16):

```
Selfcheck (short): <task> → gate <row from §1> | env: <branch, baseline> | plan: <one line>
```

**Full form** — required for epics, grills, external-agent work, and anything touching
`src/sim`; also whenever any §3 check came back not-clean:

```
Selfcheck complete.
- Task: <issue #n / design session / analysis> → gate: <row from §1>
- Read: CONTEXT.md (<terms relevant to task>), spec <file §sections>, issue AC (<body | newer comment from DATE>)
- Env: branch <name>, baseline <green | RED: what>, worktree <real | subdir | n/a>
- Plan: <2–4 steps, first test to write if TDD>
- Watch-outs: <incident/log items or spec non-goals that touch this task>
```

## 6. Post-work — before you declare done

Green tests and a commit are **not** "done" (incident 0004). Before telling the owner
the work is finished, walk the PR-template checklist
(`.github/pull_request_template.md`) and close or explicitly flag every gate.

**The gates and their depth are defined in one place: WORKFLOW.md §Verification gates
(tiered).** Classify the change by its risk surface (paths in the diff — escalate up,
never down), then walk that tier's checks: docs sync sweep, code review (inline /
one cheap-tier subagent / one two-axis strong-tier subagent), E2E (affected specs
per PR, full run at wave merge and epic close), and spec sync (behavior drifted ⇒
spec update ships in the same task).

If a gate cannot be closed — a skill is unavailable in your harness, a tool errors
out, you lack access (the review gate, Playwright, `gh`, …) — **report it, don't route
around it**: name the gate, say what you tried, and leave it explicitly OPEN for the
owner. A silently skipped gate is worse than an open one.

End your final report with the gate list — each gate either **closed** (with
evidence) or **OPEN** (with reason).

## 7. When something is off

- **Failed check / red baseline / dirty main** → stop, report what you found, wait.
- **Docs contradict each other** (spec vs CONTEXT.md vs issue) → newest
  acceptance-criteria comment wins for scope; for anything else, surface the
  contradiction to the owner instead of picking silently.
- **You broke a rule or nearly did** → file an incident report
  (`docs/incidents/README.md` has the template; report → fix → don't repeat, no
  blame). A near-miss reported is a free lesson.
