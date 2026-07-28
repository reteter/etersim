# Agent memory — cross-machine export

Claude Code's file-based memory lives per machine (`~/.claude/projects/<project>/memory/`),
so lessons learned on one machine don't travel with the repo. This file is the
repo-versioned export of the entries worth carrying anywhere. Machine-local entries
(quirks of a specific checkout) stay in the per-machine index and are deliberately not
exported. Update this file when a durable, machine-independent lesson lands; delete
entries when they expire.

Session-state notes (queue, watch items) do NOT live here — they live in
the issue tracker (owner decision 2026-07-28 — `docs/HANDOFF.md` was retired the same day). Since that decision, per-machine auto-memory
carries **no project notes at all** — only what is true of a given machine and the owner.
For when this file last changed, read `git log -- docs/agent-memory.md`; a hand-maintained
"last export" stamp is derivable and drifted (it claimed 2026-07-17 while carrying 07-28
entries).

## Windows gh/git encoding pitfall (feedback)

Piping `gh`/`git` text through python or PowerShell on Windows garbles UTF-8 (locale
cp1250 re-decodes it: ₸ → "â‚¸", — → "â€""). Never edit PR/issue bodies through a pipe:
Write the full text to a file (UTF-8) and use `gh pr edit --body-file` /
`gh issue edit --body-file` / `git commit -F`. Trace: PR #135's body was garbled this
way; tracked as issue #136 → docs/incidents/0007. Related PowerShell quirk
(2026-07-15): `gh api repos/{owner}/{repo}/...` placeholder syntax fails
("command parameter was already specified") — use the explicit `owner/repo` path.

## Shared CSS class + layout change silently breaks `innerText()` e2e (project, 2026-07-16)

Adding a layout-changing rule (`display: flex`/`grid`) to a CSS class **shared across
components** can corrupt Playwright assertions in an *unrelated* component that reuses the
class. Trace (#73 wave, market-panel-refresh): `.side-panel__subtitle` got `display: flex`
to lay out an icon in `PortPanel`, but `ShipPanel` reuses that class for plain-text "Docked
at {port}". Flex changed how Playwright's `innerText()` (which respects rendered layout,
unlike `textContent`) serialized the text — it inserted a line break, so a helper regex
built from the subtitle stopped matching and 7 tests went red, including specs the change
never touched. **Fix pattern:** never add layout rules to a class used by >1 component;
scope the layout to a new dedicated class/element (here, `.side-panel__subtitle-icon`).
**Debugging meta-lesson:** when a Playwright run goes red after a change, "maybe it's
parallel-worker contention" is a hypothesis to *disprove*, not a default — the cheap
unambiguous check is: (1) stash the change, re-run the failing tests → proves the baseline
is green; (2) restore, re-run the *same* failing tests **in isolation** (single worker) → if
they still fail, it's a real regression, not contention. (Different scar family from the
false-RED certify-order ones, incidents 0011/0013.)

## advisor() availability + resume hazard (Claude Code harness, 2026-07-15)

`advisor()` works from a non-Fable main/Orchestrator agent (Opus 4.8 confirmed); the
harness "check your network · retry" message is misleading — the call is in flight,
wait it out. It is unavailable only when Fable itself is the executor (advisor tier ≥
executor tier pairing rule, WORKFLOW §Casting). Separate hazard: resuming a subagent
after a mid-response crash **silently drops any in-flight advisor/tool call** — name
and re-issue it in the resume message (incident 0012). A dropped advisor consult is a
silently skipped gate.

## Model ladder for orchestration (feedback, owner-confirmed 2026-07-13)

> **Superseded 2026-07-15** by [WORKFLOW.md](WORKFLOW.md) §Casting:
> roles are capability-tier contracts (cheap/strong/frontier) with a one-line
> replaceable current casting; PRD roadmap items carry `procedural` /
> `design-frontier` labels. The section below stays as the historical rationale —
> its dispatch principles (package quality buys coder cheapness; gates distrust
> coder green regardless of model) still hold.

- **Main session (Orchestrator): Fable** (effort xhigh while available) — reasoning
  concentrated where decisions compound: task packages, file-collision analysis, review
  aggregation.
- **Two-axis reviewers / in-flight advisor: Opus** (`model: "opus"`) — strong enough to
  catch Sonnet's bugs, avoids Sonnet-reviewing-Sonnet blindspots, far cheaper than Fable
  (reviewing on Fable would exhaust the owner's subscription).
- **Coder subagents: Sonnet** (`model: "sonnet"`) for small/medium tasks with
  pre-resolved packages (verbatim ACs, named files, hard scope walls). Fable/Opus coder
  only for deep sim work (tick-integration class, incident-0005 risk).

The safety net (two-axis review + owner merge) is designed to distrust coder green
regardless of model, so a cheaper coder shifts load onto review rather than weakening
gates. The better the dispatch package, the cheaper the coder can safely be. Practical:
pass `model:` explicitly per Agent call; `subagent_type: "coder"` registers only at
session start — in a session older than the agent def, fall back to `general-purpose`
with the persona files named in the prompt. Watch-out observed 2026-07-13: a Sonnet
coder spontaneously ran a self `/code-review` (incident-0005 pattern, budget burn) —
coder packages should explicitly forbid spawning subagents.

## Subagent casting override + mid-flight corrections (Claude Code harness, 2026-07-17)

Two facts from the Professor-on-Fable dispatch (s7):

- The Agent tool's `model` parameter **overrides the agent definition's frontmatter
  `model:`** — a persona def pinned to one model (professor.md says `model: opus`) can
  be re-cast per dispatch without editing the def. This is the sanctioned way to make
  a one-off casting decision (incident-0015 rule "name the casting" still applies:
  pass it explicitly, never rely on inheritance).
- `SendMessage` to a running subagent is delivered **only at its next tool round** —
  a correction can lose the race against work already in flight. Trace: the "skip the
  file write" correction arrived after the Professor had already written all three
  report parts to disk. Corollary: put constraints in the initial dispatch prompt;
  treat mid-flight corrections as best-effort, and design them to be safe when they
  arrive late ("if already done, leave it — don't spend tokens undoing").

## GitHub Actions minutes near-exhausted (project; expires with the billing cycle)

The repo is private, so CI consumes the `reteter` account's Actions minutes; as of
2026-07-13 the budget is nearly gone (odd ~$1.49 spending limit, no funds to add).
Observed: runs can sit `queued` ~10 minutes before a runner appears — slow, not dead;
don't panic-cancel (GitHub auto-cancels after 24 h). If Actions stops entirely, the
owner accepts merging on local gates — CLAUDE.md's documented merge gates (tests,
typecheck, lint, `/code-review`) are all local; CI was never a documented gate.
Compensate locally: `npm run build` (not in the routine trio) and Playwright E2E for UI
changes; watch for Linux-only breakage invisible on Windows (import-path casing, CRLF).

## Frontier access is intermittent (user context, updated 2026-07-28)

**The lesson now has a full cycle behind it, not just a forecast.** Fable 5 held the
frontier rung until access expired on 2026-07-19; the rung sat empty for nine days and
was refilled on 2026-07-28 by Claude Opus 5 (owner call) — which also put one model on
both the frontier and strong rungs. The name in the slot is the volatile part; the slot
is not. The next frontier partner may again be a non-Claude model in a non-Claude
harness, or the rung may empty again with no notice. That is why the process is
model-agnostic (WORKFLOW §Casting) and why everything a session needs lives in the
repo: the issue tracker (state, order, owner calls), agent-memory.md (durable lessons),
PRD/specs (direction),
incidents (scars). The owner works from the terminal CLI; `gh` is the sync mechanism
between machines. Don't assume frontier-tier capacity when planning scope —
`design-frontier` items wait for an owner-led grill.

## Bulk doc edits: snapshot what must survive, verify per item (feedback, 2026-07-28)

A mechanical strip across many documents **will** eat something load-bearing that happens
to sit inside the pattern. Observed in s29: removing every `_Implementation_` block from
`CONTEXT.md` also removed `Course`'s `_Avoid_` block, because it began mid-line inside one.
Nothing in the diff looked wrong — the entry still had a term, a definition and a heading.

The discipline that caught it, and the one to repeat: **before** the edit, snapshot the
invariants as a list (every glossary term, every `_Avoid_` block, every heading name, every
LIVE/HIST status); **after** the edit, diff that list per item, not the file as a whole.
Restore from the pre-cut snapshot rather than rewriting from memory.

Two corollaries that also earned themselves in s29: heading names are an **API** — repo
docs cite `FILE.md §Name` across dozens of sites, so cut bodies and keep headings, or fix
every citation in the same commit. And a citation breaks because a **different** file
changed, so it is never findable by reading the file you edited (this is what issue #432's
`check:citations` is for). Prefer surgical edits over a script whenever the item count is
small enough to hand-verify; the script is for hundreds of edits, not for twenty.
