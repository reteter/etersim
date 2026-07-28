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
5. **Implementation** — branch `feat/<issue>-<slug>` (or `fix/`, `chore/`). Conventional
   commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`). Sim code grows test-first
   (TDD, Vitest; the evidence alternative lives in the CODER.md TDD line).
6. **PR** — body links `Closes #<n>`. Before merge: tests green, typecheck + lint clean, and
   the wave check for the change's tier closed ([verification.md](verification.md)). The user
   merges — final call on every PR.
7. **Spec sync** — if implementation drifted from the spec, updating the spec is part of the
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
