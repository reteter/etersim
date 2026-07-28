# Workflow — the router

How an idea becomes shipped code in etersim. **This file routes; it states no rules.** Each
concrete workflow is its own file in [`workflows/`](workflows/), so a hat reads the one or two
it needs instead of a single long document (owner decision 2026-07-28).

```
idea → grill → feature spec → user approval → GH issues → implementation → PR + review → merge → spec sync
```

| Workflow | Read it when | File |
| --- | --- | --- |
| **Pipeline** | taking an idea through grill → spec → issues → PR → merge; merging stacked PRs | [workflows/pipeline.md](workflows/pipeline.md) |
| **Verification gates** | closing a wave: tiers, review packages, fix loop, E2E certification, batching, PR timing, definition of done | [workflows/verification.md](workflows/verification.md) |
| **Documentation law** | committing docs, a spec, or any decision batch; parking something; flipping a note to HIST | [workflows/documentation.md](workflows/documentation.md) |
| **Roles and casting** | deciding who does the work and at which model tier; declaring an LCM session | [workflows/casting.md](workflows/casting.md) |
| **Session rituals** | opening or closing a session; what carries to the next one | [workflows/session.md](workflows/session.md) |

Which hat to wear and what it obliges you to read: `CLAUDE.md` §Hats. The laws that bind every
model: `CLAUDE.md` §Laws. The coder's own checklist:
[personas/CODER.md](personas/CODER.md) §The coder minimum.

This table **is** `workflows/`'s index — adding a workflow file means adding its row here, in
the same commit, on the same contract as the other indexed categories
([workflows/documentation.md](workflows/documentation.md) §Indexed categories).

## Where the old section names went

Repo docs, issue bodies and incident reports cite sections of this file as `WORKFLOW §Name`.
Those names survived the 2026-07-28 split and live in the files below; this table is how an
older citation still lands. **Cite the file directly in anything written from now on.**

| Cited as | Now in |
| --- | --- |
| `§Pipeline` (incl. `step 4`…`step 7`), `§Issues` | [workflows/pipeline.md](workflows/pipeline.md) |
| `§Verification gates`, `§Wave check`, `§Behavior-preserving exemption`, `§The review package`, `§Model ladder`, `§Fix loop`, `§E2E certification points`, `§Milestone playtest law`, `§Batching`, `§PR timing`, `§Definition of done` | [workflows/verification.md](workflows/verification.md) |
| `§Coder minimum` | [personas/CODER.md](personas/CODER.md) (canonical) |
| `§Documentation law`, `§Docs sync sweep` | [workflows/documentation.md](workflows/documentation.md) |
| `§Roles`, `§Casting` (also cited as `§Casting is model-agnostic`), `§LCM` / `§Low-cost mode` | [workflows/casting.md](workflows/casting.md) |
| `§Session rituals` | [workflows/session.md](workflows/session.md) |
