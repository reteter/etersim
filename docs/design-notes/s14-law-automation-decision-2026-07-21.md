# Automating the four s14 laws — decision record (#332), 2026-07-21

Run in parallel with the #307 coder wave. Closes #332's decision half: which of the four
design-surface-sweep laws (`knowing-is-not-binding-2026-07-19.md`'s own subject) are worth
a standing detector, and which are legitimately not — recorded with reasons, per the
issue's own permission to answer "not worth it."

## The four laws, decided one at a time

**1. Decisions propagate at the moment they change (#313).** **Not automated.** The only
mechanical thing a detector could check is "does the commit message contain a
documents-checked statement" — and that check is gameable by construction: writing any
sentence satisfies it, including a false one, which manufactures confidence rather than
enforcing the rule. A checker that can be satisfied by decoration is worse than no checker,
because it launders a fabricated statement as a passed gate. What actually enforces this
law is the same thing that enforces spec-drift correction generally: a human (or reviewer
subagent) reading the diff against the citations the touched document already carries —
exactly what the tiered wave check already does for code, and what this session did by
hand for #354/#356/#360. No script changes that.

**2. Counts are anchored before they are trusted (incident 0020).** **Not centrally
automatable, and not a gap** — re-read the issue's own table: "per-script; #324 is the
first instance and can set the pattern." This law governs how a *session* runs an ad-hoc
grep, not something committed to git that a corpus-wide static check could inspect after
the fact — the violation, when it happens, happens in a tool call that leaves no artifact
to diff. The "automation" for this law is every future script (#324, and the two below)
individually printing its own anchored total, which is a discipline applied at write-time,
not a separate meta-detector run afterward. Confirmed by this session's own practice: every
grep in the #326 and #332 audits printed its raw count before filtering.

**3. Behavior-preserving exemption (#317).** **Automated — `scripts/check-behavior-preserving.mjs`.**
The literal, mechanically-checkable half ("no test added or removed") is a file-status diff
— unambiguous, hard-fails. The softer half ("no assertion changed") cannot be verified
automatically without understanding whether a changed line's *value* moved or only its
*syntax* did (exactly the shape of #307's own diff: `cargo.grain` → `amountOf(cargo,
"grain")` touches an assertion line without changing what it asserts). The script is
therefore a **surfacer, not a verdict**: it hard-fails on added/removed test files, and for
every other touched assertion line it prints the line for a human to eyeball in seconds —
the blind spot is stated in its own `--help` text, not left implicit.

**4. A trigger is a promise (#327).** **Automated — `scripts/check-unpark-triggers.mjs`.**
The most automatable of the four, and #326's own acceptance criteria already require this
exact property to hold. Detector: grep `docs/design-notes/*.md` for unpark-trigger language
(same pattern class as #326's manual pass), then check a small window around each hit for
an issue-number citation. **Exemption baked in, not bolted on**: `grill-brief-m*-*.md`
files are excluded, per the rule #326 settled — a grill tied to a named PRD milestone slot
needs no issue, the roadmap sweep is its tracker. Anchored per incident 0020: prints the
total hits scanned before reporting which ones lack a citation.

## What this issue does not settle (named, not answered — same as its own body)

Whether the repo is producing laws faster than it can enforce them, and whether
`WORKFLOW.md` is outgrowing what one reader can hold, stays an open process question for an
owner-led grill — explicitly out of scope for this issue's close, per its own text.

## Implementation

Both scripts dispatched to a coder (tier 1, tooling under `scripts/`, no `src/sim`) against
this decision record, in parallel with #307. See the coder's PR for the concrete
`scripts/*.mjs` + tests + npm-script wiring.
