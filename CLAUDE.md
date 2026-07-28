# etersim

Single-player aether-punk trading simulation. Browser-only: Vite + TypeScript + React + Zustand. The simulation is a pure TS module in `src/sim` — no React/DOM imports there, ever (ADR-0002). Time is tick-based and deterministic with a seeded RNG (ADR-0003). No backend; saves in localStorage + JSON export (ADR-0004).

## Source of truth

- `CONTEXT.md` — ubiquitous language. Law: code identifiers use these terms; new concept ⇒ glossary entry first.
- `docs/PRD.md` — vision, pillars, scope, milestone/epic roadmap.
- `docs/WORKFLOW.md` — **a router, not a rulebook**: one row per concrete workflow in `docs/workflows/` (pipeline, verification gates, documentation law, roles & casting, session rituals), plus a table mapping the pre-2026-07-28 `WORKFLOW §Name` citations onto their new files. Read the workflow your hat needs, not the set.
- `docs/adr/` — settled decisions; add an ADR for hard-to-reverse choices, don't relitigate existing ones.
- `docs/specs/` — one feature spec per epic (Design + Tech sections). **Read `docs/specs/README.md`** — a one-row-per-spec index (epic, milestone state, as-built digest); every spec binds (no HIST analogue, unlike design-notes/incidents), so a row that still calls something "open" after the code moved on is itself a finding. Adding a spec means adding its row in the same commit (`docs/workflows/documentation.md`).
- `docs/personas/` — Designer/Engineer/Analyst hats, the Orchestrator role, the Coder subagent contract (harness def: `.claude/agents/coder.md`), and the Professor architecture reviewer (harness def: `.claude/agents/professor.md`).
- `docs/design-notes/` — playtest observations, grill records, architecture reviews, parked ideas and process evaluation. **Read `docs/design-notes/README.md`** — a one-line-per-note digest marking each LIVE (still steers work) or HIST (closed, kept for provenance); open a note only when its line is relevant. Same contract as the incidents §Log; adding a note means adding its row in the same commit (`docs/workflows/documentation.md`). **A parked item that carries an unpark trigger also gets an issue** — a note may hold the reasoning, never the only record of an obligation, because `gh issue list` is swept every session and a HIST note is explicitly safe to skip.
- `docs/HANDOFF.md` — a **~15-line orientation note for the next session**, written and overwritten by the session-driving model at session start and close (owner decision 2026-07-28, replacing the 2026-07-16 owner-request rule; the length budget and the admission rule are what keep it honest, where closing updates only hid the drift). Carries **only what `git log` / `gh` cannot derive**: the owner-agreed order of work, why the last session stopped where it did, and **promises that are not tasks** (a bet with a falsifier, a decision waiting on the owner) — the issue tracker rightly rejects those, so this is their only home. Never a coder, never a subagent. Prior versions: `git log -p docs/HANDOFF.md`. **Project notes do not live in per-machine auto-memory** (owner decision 2026-07-28) — that channel is only for what is true of this machine and this owner.
- `docs/PROCESS.md` — the outside-reader tour: how this repo runs a multi-model AI team (roles, model ladder, gates, evidence base).
- `docs/agent-memory.md` — durable, machine-independent lessons exported from per-machine memory.

## Laws (break none of these)

The bright lines. Numbering is stable and cited across the repo — **`§Laws 4`** and the like;
it is inherited from the retired `docs/SELFCHECK.md` §4, so old `§4.n` citations map 1:1.
These bind every model, driver and subagent alike.

1. **Determinism is sacred**: all sim randomness flows from the seeded RNG; no `Math.random`, no `Date.now` inside `src/sim` (ADR-0003).
2. **Sim purity**: `src/sim` imports no React/DOM, ever (ADR-0002). The Harness and UI import the sim, never the reverse.
3. **TDD for `src/sim`**: the failing test comes first by default; a test written after implementation requires named per-test red evidence (revert or targeted mutation), flagged in the report (grill 2026-07-17). UI is verified with Playwright.
4. **Glossary first**: new domain concept ⇒ `CONTEXT.md` entry before the identifier.
5. **Feature branch + PR, conventional commits, `Closes #n`.** Before merge: tests, typecheck, lint, and the wave check at the change's tier (`docs/workflows/verification.md`). **The owner merges — never merge your own PR without explicit owner consent.**
6. **Never act on `main`**: no commits, checkouts, resets. Two documented exceptions, both docs-only: the session-close batch, and `docs/HANDOFF.md` alone at either session boundary (`git show --stat` naming one file is the check). In a worktree, address git as `git -C <worktree>`; verify with `git worktree list` (incident 0001).
7. **Tuning ≠ spec drift**: constants marked as tuning may move without spec changes; behavior changes require updating the spec **in the same task**.
8. **Settled decisions stay settled**: ADRs and approved specs are not relitigated inline — link to them; new facts go to the owner (grill), not into quiet overrides.
9. **One color = one meaning** in UI (ADR-0006; incident 0002 — gold belongs to the Controlled Ship).
10. **English** in code, docs, commits, issues; Polish in conversation with the owner; Polish in player-facing UI strings.

## Hats — what to wear, and what to read first

**A hat is a read-obligation, not a mood, and it is per *task*, not per session** — the
pipeline itself is a hat sequence, so changing hats when the work changes kind is normal.
Announce the switch, and read the row **before** your first action under the new hat.
Declaring a hat whose row you have not opened is the s25 failure (#410).

| Hat | Worn when | Must have read **before acting** |
| --- | --- | --- |
| **Designer / Engineer** | grill, spec writing, any design call | `CONTEXT.md`, `docs/workflows/pipeline.md`, `docs/workflows/documentation.md` §Docs sync sweep, the epic's spec, `docs/adr/` (list — a title hides which law it carries), `docs/personas/DESIGNER.md` / `ENGINEER.md` |
| **Analyst** | after an owner playtest | `docs/personas/ANALYST.md`, `CONTEXT.md`, `docs/workflows/documentation.md` (a trigger is a promise), `docs/design-notes/README.md` |
| **Orchestrator** | implementation: issues → packages → waves → integration | `docs/workflows/verification.md` (whole file), `docs/workflows/session.md`, `docs/workflows/documentation.md`, `docs/workflows/casting.md` §Casting, and `docs/workflows/pipeline.md` steps 4–7; `docs/personas/ORCHESTRATOR.md`; §Git & worktrees below; `docs/incidents/README.md` §Log; the epic spec + `docs/specs/README.md` |
| **Coder** (subagent) | dispatched with a task package | Its package, `docs/personas/CODER.md` (which holds the **coder minimum** — the coder's entire checklist), and §Laws above. Not the driver's pre-work routine |
| **Professor** | architecture pass on one named subsystem at an epic/milestone boundary | `docs/personas/PROFESSOR.md`, the subsystem's spec, `docs/adr/` |
| **No hat yet** | session start, before the work is named | `docs/HANDOFF.md`, `gh issue list` — then name the work, which names the hat |

Adding a hat means adding its row here, in the same commit as the persona def. Every cell
names a file and restates none of it: if a rule changes, it changes in its home document and
this table keeps pointing at it.

## Before you start, and before you declare done

- **Run `npm run selfcheck -- --kind=<docs|impl|design|analysis>`** before touching anything. It replaces the retired `docs/SELFCHECK.md` checklist: it prints the gate for that kind, verifies the environment, runs the baseline where the kind requires it, and checks the detectors against their known counts. It **withholds READY** for anything it could not verify — a not-verified is never reported as clean.
- **Post the one-line report it prints, then wait**, before creating a branch or editing a file. Posted after the work it is a receipt, not a checkpoint (incident 0003). Required **especially when it feels unnecessary** — the silent "this isn't really a task" classification is what dissolved this check once already (incident 0022). Pushing a PR ends the task: the next item re-verifies its branch first (incident 0021).
- **A red baseline is inherited breakage** — report it, do not fix it silently and do not build on top of it.
- **Before declaring done**, walk the PR-template checklist (`.github/pull_request_template.md`) and close or explicitly flag every gate. Green tests and a commit are not "done" (incident 0004). Depth comes from one place: `docs/workflows/verification.md`. End the final report with each gate either **closed** (with evidence) or **OPEN** (with reason) — if a gate cannot be closed because a tool or skill is unavailable, say so; a silently skipped gate is worse than an open one.
- **When something is off:** failed check, red baseline or dirty `main` ⇒ stop and report. Documents contradicting each other ⇒ the newest acceptance-criteria comment wins for scope, everything else goes to the owner rather than being picked silently. Broke a rule or nearly did ⇒ file an incident (`docs/incidents/README.md` has the template); a near-miss reported is a free lesson.

## Rules

- Every epic starts with grilling, then a spec approved by the user, then GitHub issues (`gh`; milestone = epic). UI is verified with Playwright E2E (plus light unit tests for the store bridge); manual playtesting recommended for exploration.
- The wave check's **shape** comes from the tier table (`docs/workflows/verification.md`) — tier 3 is ONE two-axis packaged subagent; the generic `/code-review` skill (two-agent fan-out) runs only on explicit owner request (incident 0016). Where repo docs say "/code-review" they mean the review gate, not that skill.
- **Decisions propagate at the moment they change.** Revising a trigger, scope call, lock or acceptance criterion means updating every other document recording that same decision **in the same commit**, found by walking the citations the edited document already carries (`docs/workflows/documentation.md`). Naming which documents you checked is part of the change — unstated means unchecked. A line you learn is false gets struck through immediately rather than waiting for a refresh.
- **`docs/souvenirs/` is the owner's private material — never read, grep, edit or cite it.** Gitignored, never pushed, not documentation and not evidence for any decision; if you think something in it matters, ask. Denied in Claude Code by `.claude/hooks/private-paths-guard.sh`, but **that hook does not cover Bash** — a `grep -r` over `docs/` reads it regardless of `.gitignore`, so scope your greps yourself.
- **The process constitution is edited only when the owner asks, in that session** — `CLAUDE.md`, `AGENTS.md`, `docs/workflows/*`, `docs/PROCESS.md`, `docs/personas/*`, `.claude/agents/*`, `.claude/hooks/*`, `.claude/settings.json`. Editing them is a decision, not a task: report what you would change and let the owner decide. Everything else stays freely editable — `CONTEXT.md` (glossary-first *requires* the entry before the identifier), `docs/HANDOFF.md`, `docs/specs/*`, `docs/PRD.md`, `docs/adr/*`, `docs/design-notes/*`, `docs/incidents/*` (never gate filing an incident). Enforced in Claude Code by `.claude/hooks/constitution-guard.sh`; written here because a hook is harness-specific and this rule is not. **This is also why the constitution carries no narrative:** a rule protected by a gate no longer has to argue for its own existence in order to survive a later model's tidying (owner decision 2026-07-28).
- Session start: read `docs/HANDOFF.md`, check open work with `gh issue list`, prune merged branches, then **rewrite `docs/HANDOFF.md` for this session** (what you are about to do and why — the intent, so a session cut short still leaves a trace). Session close: rewrite it again — where you stopped, what the next session must know. Both rewrites stay ~15 lines and admit nothing `git log` / `gh issue list` already answers.
- Pick the hat before you work and read its row in §Hats above; re-pick it when the work changes kind, and say so out loud. As Orchestrator make the casting call *consciously*: the most expensive rung does not code inline, it delegates a self-contained package to a coder (inline only when delegation overhead exceeds the task **and** you are not the top rung — `docs/workflows/verification.md` §Model ladder). Name the decision, don't drift into it.

## Git & worktrees

- **Locate yourself before any git command:** `git worktree list` and `git rev-parse --show-toplevel`. `.claude/worktrees/agent-*` may be a plain subdirectory rather than a real worktree; when it is, paths resolve against the toplevel, not `pwd`. Address git as `git -C <toplevel>` or use absolute paths.
- **After every merge, in this order:** `git worktree remove <path>` → `git branch -D <name>` → `git fetch --prune` → confirm with `git branch -a`. Branch delete fails while a worktree holds it, and `gh pr merge --delete-branch` fails *silently* in the same situation (incident 0011).
- **Pushing on a multi-account machine: the first write is the test.** `gh auth status` and `git ls-remote origin` both pass under the wrong identity, so neither is a check. If a push must go under a different account, use `git -c credential.helper= -c credential.helper='!gh auth git-credential' push` — never `gh auth setup-git`, which rewrites the machine owner's global `.gitconfig` (incident 0018).
- **Subagents address git as `git -C <their-worktree>`** — no `cd` to an absolute repo path, no `checkout`/`commit`/`reset` on `main`. After a coder wave, verify the main repo is clean and on the expected SHA (incident 0001).
- **Dispatch coders with `isolation: "worktree"` and `run_in_background` (the default) — both, always.** No manual `git worktree add`, no worktree path in the prompt; say "work in your assigned worktree" and push `HEAD:<target-branch>` by refspec (incident 0012). A synchronous coder gets **no worktree** and shares the driver's main checkout, so it must touch nothing; its first action prints `pwd` and `git rev-parse --absolute-git-dir` and stops on a match with main (incident 0025).
- **Every dispatch names its model.** Persona defs (coder, professor) carry theirs; ad-hoc dispatches (`general-purpose`, Explore, reviews) pass `model` explicitly per the ladder. Inheriting the driver's model is not a casting decision (incident 0015).
- **Wave close: run `scripts/postmerge.ps1`.** By hand, in this order, reproducing what it guarantees: `git merge-base --is-ancestor <squash-commit oid from gh pr view --json mergeCommit> origin/main` per PR (incident 0010) → remove worktrees and prune until `git worktree list` shows exactly one entry (incident 0011) → `git diff-tree --name-only -r <merge oid> -- package.json package-lock.json`, and `npm install` if it prints anything (incident 0013) → certify, printing `pwd` + branch + SHA first (incident 0008). The script refuses to report CLEAN when it verified nothing; a hand-walk cannot. A cert red with a module-not-found or missing-type signature is a stale environment until proven otherwise.

## Incidents

- `docs/incidents/` is a blameless log of times work deviated from the rules/docs/intent, including near-misses. We work **report → fix → don't repeat**, never punishment. Read `docs/incidents/README.md` §Log — a one-line-per-incident digest of what's bitten us and what to watch for — so any model, whatever its persona, carries the lessons. File a report (template in that README) whenever a rule was broken/skipped, a command hit the wrong repo/branch/file, or something surprised you the next person should be warned about.

## Commands

- `npm run selfcheck -- --kind=<docs|impl|design|analysis>` — the pre-work check (§Before you start). `--kind` is required by design; `--offline` skips the two network checks. Exits 1 on any failure **and** on anything it could not verify.
- `npm run dev` — start the Vite dev server.
- `npm run build` — typecheck (`tsc -b`) then production build (`vite build`).
- `npm test` — run the Vitest suite once.
- `npm run test:e2e` — run Playwright E2E tests (auto-starts the dev server). Locally, set `PLAYWRIGHT_PORT` to a dedicated port (e.g. `PLAYWRIGHT_PORT=5901 npm run test:e2e`): `reuseExistingServer` will otherwise silently reuse a foreign dev server squatting on `5173` and feed your run its stale build — false failures that mask your changes. Never kill the foreign process to free the port.
- `npm run typecheck` — typecheck the whole project (`tsc -b`).
- `npm run lint` — lint with ESLint (flat config, `eslint.config.js`).
