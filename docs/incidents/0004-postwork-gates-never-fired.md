# 0004 — Work declared done at commit; post-work gates never fired

- **Date:** 2026-07-09
- **Detected by:** Owner question ("did you run the docs ritual?") after the agent
  reported the task complete; transcript in `tmp/46ef035_grokbuild.md`
- **Status:** Closed (SELFCHECK.md §6 "Post-work" added in the same PR as this report)

## What happened

An external coding agent implemented issue #79 (rename `route` → `Course`; 18 files
across `src/sim` and `src/ui`), got tests/typecheck/lint green, committed, and
reported **"AC spełnione, gotowy do push + PR"**. Three merge gates required for this
change were neither run nor flagged as open:

1. **Docs sync sweep** — the E9 spec's own "Docs sync" section names this PR and asks
   for a CONTEXT.md verification; a stale `_Implementation_` note ("lands in E9") was
   left in CONTEXT.md. Done only after the owner asked.
2. **Two-axis `/code-review`** — WORKFLOW.md §6: mandatory for any `src/sim`/UI
   change. Never run, never mentioned — including in the agent's own retro.
3. **E2E** — PR template requires Playwright when UI changed (`PortPanel`,
   `RegionMap`, `shipPosition`, `coursePreview` all touched). Only unit tests ran.

The pattern, not the individual misses, is the finding: every post-work gate lived in
the PR-template checklist and WORKFLOW's "before merge" step, which only surface at
`gh pr create` / merge time. The session ended at the commit, so no artifact ever put
the gates in front of the model. `docs/SELFCHECK.md` covered "before you start"
thoroughly (and that part was executed near-flawlessly) — nothing covered "before you
say done".

## Impact

- **Outcome:** Low — branch unmerged, so no gate was actually violated ("before
  merge" had not arrived yet); docs sweep was completed after the owner's prompt;
  review and E2E remain open and known.
- **Failure-mode class:** Medium — an owner trusting "gotowy do push + PR" could
  plausibly merge an unreviewed, E2E-unverified sim+UI change. For a pure rename the
  blast radius is small; for a behavior change the same pattern ships unreviewed
  logic.
- **Rules broken/skipped:** WORKFLOW.md §6 (review before merge) and §7 (spec sync
  part of the task) not yet violated but unflagged; PR-template checklist items 3/4/5
  effectively invisible pre-PR.

## Recurrence

High — structural. Any session that stops between commit and PR (external models
without `gh` access, sessions ending early, owner-driven PR creation) skips every
checkpoint that lives in the PR template. The gap is in the process, not the model.

## Recommendation

- **Prevent:** SELFCHECK.md now has a §6 "Post-work — before you declare done":
  walk the PR-template checklist and end the final report with every gate either
  **closed (with evidence)** or **explicitly OPEN (with reason)**. A gate that cannot
  be closed — skill unavailable in the harness, tool error, no access — must be
  reported as OPEN, never silently skipped or improvised around.
- **Detect:** the owner can refuse to merge any "done" report that lacks the gate
  list; the PR template remains the second net for sessions that do reach PR.
- **Contain:** accepted residual risk — a model may still misjudge a gate as closed;
  the two-axis review at PR time backstops that.

## Follow-up

SELFCHECK.md §6 added (old §6 renumbered to §7) in the same PR that lands this
report. The #79 branch itself still needs two-axis review + E2E before merge.
