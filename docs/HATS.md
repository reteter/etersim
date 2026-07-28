# Hats — what donning one obliges you to have read

**The law: a hat is a read-obligation, not a mood.**
Announcing "I'm wearing the Orchestrator hat" without having read that row's set
is the same failure as skipping the selfcheck — you claimed a contract you had not read.
Read the row **before** the first action taken under the hat, not after.

Why this file exists separately from `CLAUDE.md` and `docs/SELFCHECK.md`:
both already carry the instruction, but **conditionally and passively**
("read WORKFLOW before starting any epic or creating issues"),
and a passive line in an already-loaded file demonstrably failed once (s25, #410).
This file is small on purpose so a harness can inject it whole, before any hat is declared.
Content lives here — in a model-agnostic repo doc — and never inside a harness config,
so a non-Claude-Code harness reading only the repo gets the same map (#410 §Design constraints).

## The map

| Hat | Worn when | Must have read **before acting** |
| --- | --- | --- |
| **Designer / Engineer** | grill, spec writing, any design call | `CONTEXT.md`, `docs/WORKFLOW.md` §Pipeline + §Docs sync sweep, the epic's spec, `docs/adr/` (list — a title hides which law it carries), `docs/personas/DESIGNER.md` / `ENGINEER.md` |
| **Analyst** | after an owner playtest | `docs/personas/ANALYST.md`, `CONTEXT.md`, `docs/WORKFLOW.md` §Documentation law (a trigger is a promise), `docs/design-notes/README.md` |
| **Orchestrator** | implementation: issues → packages → waves → integration | **`docs/WORKFLOW.md` in full** — §Verification gates (the tier table), §Model ladder, §Batching, §PR timing, §Session rituals; `docs/personas/ORCHESTRATOR.md`; `CLAUDE.md` §Git & worktrees; `docs/incidents/README.md` §Log; the epic spec + `docs/specs/README.md` |
| **Coder** (subagent) | dispatched with a task package | Its package, `docs/personas/CODER.md`, `docs/SELFCHECK.md` §4 (the hard laws). **Not** the rest of SELFCHECK — a coder runs the *coder minimum* (WORKFLOW §Verification gates), not the driver's checklist |
| **Professor** | architecture pass on one named subsystem at an epic/milestone boundary | `docs/personas/PROFESSOR.md`, the subsystem's spec, `docs/adr/` |
| **No hat yet** | session start, before the work is named | `docs/HANDOFF.md` (mind its date stamp), `gh issue list`, then `docs/SELFCHECK.md` — which tells you which hat you need |

## Notes that keep this honest

- **This map is a pointer, never a second copy.** Every cell names a file; none restates
  what that file says. If a rule changes, it changes in its home document and this table
  keeps pointing at it (WORKFLOW §Documentation law — decisions propagate at the moment
  they change, and a duplicated snapshot drifts against its source).
- **Adding a hat means adding its row**, in the same commit as the persona def
  (same contract as the indexed categories).
- **The obligation is the reading, not the reciting.** You do not have to quote the
  documents back; you have to have opened them before the first action under the hat.
