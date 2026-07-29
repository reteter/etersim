# Pipeline — how an idea becomes shipped code

```
idea → grill → feature spec → user approval → GH issues → implementation → PR + review → merge → spec sync
```

1. **Grill** — every epic starts with a grilling session (grilling skill). No spec before the
   questions are answered.
2. **Feature spec** — one file per epic: `docs/specs/E<n>-<slug>.md`, from
   [specs/TEMPLATE.md](../specs/TEMPLATE.md), with a **Design** section (Designer hat:
   mechanics, UX flows, formulas) and a **Tech** section (Engineer hat: data structures,
   module APIs, file layout). Terms come from `CONTEXT.md`.
3. **Approval** — the user signs off on the spec before any issue is created.
4. **Issues** — via `gh`. One GitHub **milestone per epic** (`E1 — Foundation`, …). Title:
   imperative English. Body: context, acceptance criteria, link to the spec section. Labels:
   `type:feat|bug|infra|spec|docs` + `area:sim|ui|docs`. When criteria are refined after filing
   (a later grill, re-scoping), post the final version as an issue **comment** — **the newest
   acceptance-criteria comment supersedes the body**, and coders and reviewers read it first.
5. **Spec-vs-code check** — before the epic's **first** coder dispatch, verify that what the
   spec *names* still exists in the code in that form: the types and interfaces its §Tech
   section names, the module and function signatures it hands to a coder, and its
   `SAVE_VERSION` target. **Write the result down** — each drift found, or the words "zero
   drift" — in the first task package or as a comment on the epic's first issue.
   *Narrow on purpose:* not "read the spec against the code", which degrades into re-reading
   the spec (the substitution shape of incident 0031), but a check with a named output that a
   later reader can see was run. It exists because two specs reached this state unnoticed —
   #424 (E11's `LedgerEvent` union) and #425 (E15's `SAVE_VERSION` v14, already consumed) —
   each of which would have handed a coder a contract the code contradicts.
   **Same trigger, second obligation: the epic-start mirror snapshot.** Run
   `pwsh -File scripts/mirror-snapshot.ps1 -Epic E<n>` before the first dispatch. It is the
   undo half of the retired owner-merge gate ([ADR-0010](../adr/0010-the-driver-merges.md)) and
   it verifies the mirror rather than trusting the push, so a red here blocks the dispatch.
6. **Implementation** — branch `feat/<issue>-<slug>` (or `fix/`, `chore/`). Conventional
   commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`). Sim code grows test-first
   (TDD, Vitest; the evidence alternative lives in the CODER.md TDD line).
7. **PR** — body links `Closes #<n>`. Before merge: tests green, typecheck + lint clean, and
   the wave check for the change's tier closed ([verification.md](verification.md)). **The
   driver merges its own PR** once those gates are closed ([ADR-0010](../adr/0010-the-driver-merges.md));
   coder subagents never merge. The owner's final call is on design and scope, not per-PR.
8. **Spec sync** — if implementation drifted from the spec, updating the spec is part of the
   task, not optional cleanup.

## Merging: independent vs stacked PRs

**Independent PRs** (disjoint files) merge in any order, no rebase.

**Stacked PRs** (each branching off the previous) need care. `gh pr merge N --squash`
**without** `--delete-branch` on the base — deleting it *closes* the children, and GitHub will
not retarget a closed PR. Then `gh pr edit CHILD --base main` to retarget, then delete the base
branch. After the first squash-merge, cascade-rebase the rest locally
(`git rebase --onto <new-parent> <old-parent-head> <branch>`, then `--force-with-lease`);
GitHub reports children as CONFLICTING until rebased, because their branches still carry the
pre-squash commits.

Prefer one batched PR and the problem does not arise — see
[verification.md](verification.md) §Batching.
