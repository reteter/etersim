# Tiered verification gates — process grill record (2026-07-14)

Grill of #162. Process grill (no persona — Orchestrator + owner). Trigger: owner
observation that subagents spend more time checking than coding. Agreed diagnosis
(recorded in the issue): verification *should* dominate wall-time in agent-driven
development — the defect was that the gates were **flat instead of progressive**, so a
60-line UI diff paid the same ceremony as a sim-engine change. Data point: #157
(~60 LOC, UI-only) spent ~66k tokens on two review subagents that each re-derived repo
context from zero to surface one inline-catchable finding.

The grill pivoted early on an owner proposal that superseded the issue's knob list:
instead of tiering the *coder's* ceremony, strip the coder to a thin executor and
centralize all repo-level gates in the Orchestrator, closed **once per wave**.

## Decision tree

| Fork | Options | Choice | Why |
| --- | --- | --- | --- |
| 1. Where verification lives | per-coder gates (tiered) / centralized wave check | **centralized wave check** | orientation cost is paid once where context already exists; per-coder ceremony repeats it per issue and never amortizes |
| 2. Coder minimum | keep read set + §5 report / thin executor | **thin executor**: baseline green in worktree, hard laws + own green (tests/typecheck/lint observed), affected e2e specs for UI, evidence report mapping AC → deliverable | the task package (written by the Orchestrator, who pre-resolved the truth) replaces the coder's own interpretation; typecheck+lint stay coder-side — 10 s that saves a fix round |
| 3. Wave-check tiers | size-based / risk-surface (paths) / hybrid | **risk surface, mechanical from `git diff --stat`, escalate-only**: (1) docs/infra → session driver inline; (2) UI-only → one review subagent on the cheap tier + affected e2e at the coder; (3) src/sim / economy / multi-file → one two-axis subagent on the strong tier, whole wave in one context | every incident scar (0002 color, 0005 false green) is a risk-surface issue, not a volume issue; path-derived tiers can't be talked down by an agent |
| 4. Model ladder | session driver reviews inline / delegate per ladder | **ladder holds**: driver composes packages, reads reports, decides — never reads whole diffs or writes code; reviews one tier down, coding two tiers down | "inline is cheap" is false when the session driver is the most expensive rung (Fable); the #157 precedent of implementing drobnica in-session is an anti-pattern there |
| 5. Fix loop | fresh coder / resume same coder | **resume same coder** (full transcript, zero re-orientation); micro-exception: driver may apply a purely mechanical one-liner, **logged in the wave report**; re-check scales to the fix, not the wave | a fresh fix coder re-creates the exact economics #162 complains about |
| 6. E2E certification | full suite per PR / affected-only + certification points | **affected specs per PR (coder-side, grep selectors → specs, doubt = include); full run on main after the wave's PRs merge (red → fix loop, never "fix later"); full run + baseline at epic close** | the suite is 5 spec files — token-cheap; the per-PR cost was ceremony (ports, flakes), not reading |
| 7. SELFCHECK scope | keep flat / variants | **full for epics, external agents, in-session src/sim work; 3-line §5 short form for small in-session tasks; §6 keeps the closed/OPEN gate-list requirement but tier definitions move to WORKFLOW (one source of truth); coders leave SELFCHECK entirely → CODER.md minimum** | two parallel gate lists is exactly how the pre-0004 gates rotted; external agents keep full ceremony — incident 0005 is the scar |
| 8. Batching | one issue per coder / batch | **2–4 small same-area issues per coder package; separate branch + PR per issue, each cut from main (no stacks for disjoint files)** _(**superseded 2026-07-16**: the batch now lands as **one PR that `Closes` each** by default — per-issue PRs were ceremony for small concrete issues; live rule in WORKFLOW §Batching)_ | orientation amortizes across the batch; per-issue PRs keep `Closes #n` clean and avoid the stacked-PR procedure |

## Scar test (cut fat, not muscle)

- **0002** (gold color): caught by review Standards axis, not coder orientation — centralizing loses nothing.
- **0003** (report after work): the only real loss — coder §5 stop-and-wait is dropped. Accepted residual risk: the Orchestrator writes the package, so misread risk is structurally lower; the evidence report (AC → deliverable) plus the wave check catch what remains.
- **0004** (gates never fired): gates get a new anchor — the codified wave check in WORKFLOW §Verification gates; SELFCHECK keeps the end-of-report gate list.
- **0005** (green ≠ correct): the wave check reads diffs against ACs, never trusts the coder's report; external agents keep the full SELFCHECK.
- **0001/0006** (worktree/main hygiene): untouched — cheap, stays in the coder def.

Non-goals from #162 confirmed kept: baseline-green before work, determinism/purity
laws, owner-merge, docs sync sweep (moves to the wave check, not deleted), incident
reporting.

## Docs sync (this PR)

WORKFLOW.md §Pipeline 6 + new §Verification gates; SELFCHECK.md §5 short form + §6
pointer; personas/CODER.md + `.claude/agents/coder.md` new minimum; CLAUDE.md Rules
one-liner. Closes #162.
