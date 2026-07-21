# Grill record — markdown normalizer (#341), 2026-07-21

Owner-led, seven questions, resolved one at a time. Opened from the design-surface
sweep queue (`HANDOFF.md` §Queue item 1): #341 was filed at s15 with a rough scope and
a draft acceptance list, both explicitly "to be grilled into a spec". This note is that
spec's decision record; `WORKFLOW.md` §Documentation law carries the resulting rule.

Outputs: `docs/WORKFLOW.md` §Documentation law (new convention line), this note,
follow-up segment-migration issues to be filed once the tool ships (see §Scope below).

## The decisions, in order

1. **Semantic line breaks apply everywhere in prose — one rule, no hybrid.** The
   alternative (semantic breaks only near fragile constructs like bold glosses) was
   rejected: it would require the script to detect "fragile context" and enforce two
   conventions instead of one, and the pilot (`HANDOFF.md`, #340) already applied the
   rule document-wide, not selectively.

2. **A clause boundary, precisely: sentence end (`.`/`!`/`?`), semicolon, an
   explanatory colon, or an em-dash — plus a soft fallback at 100 characters for any
   segment between hard separators.** Not full grammatical clause detection. The
   pilot itself doesn't break at every comma (`five documented times; the seam is
   derivability, not section names).` stayed on one line), so "one clause per line"
   was never a literal per-comma rule — it was human judgement the script cannot
   replicate exactly. This heuristic is regex/AST-tokenizable, deterministic, and
   idempotent; it will not reproduce the pilot line-for-line, and doesn't need to —
   the pilot was a one-off hand rewrite "to normalize toward", not a contract.

3. **Enforcement: a `--check` gate, scoped to an allowlist of already-migrated
   files — not repo-wide, not advisory-only.** A repo-wide gate would immediately red
   every PR touching `CONTEXT.md` (774 lines, still width-wrapped) or any other
   unmigrated doc. The allowlist is transitional: a file enters it the commit it gets
   migrated, and the gate protects only what's already been fixed from drifting back.

4. **Migration cadence: full eventual coverage, but as several segment-scoped,
   docs-only PRs across sessions — not one pass, not indefinite drip.** This directly
   revisits the s15 non-goal ("not retroactively reflowing every doc in one pass —
   that would bury real diffs"). Considered and rejected: overriding it outright for a
   single big-bang commit. The non-goal's cost isn't only diff-review size — a single
   commit touching the whole ~8.5k-line corpus becomes the `git blame` origin for
   every line in every doc, burying the actual last substantive edit under a
   formatting-only commit, even if that commit contains nothing but reflow. Segmented
   PRs (one per `docs/` subtree) reach full coverage without that cost, and without
   the allowlist becoming a permanent second convention.

5. **Implementation: AST-based (`remark`/`unified`), not a hand-rolled line
   state-machine.** The repo has zero markdown-tooling dependencies today (no
   prettier, no markdownlint). A regex/line-counting parser is exactly the failure
   mode the acceptance criteria forbid ("must not corrupt code fences, tables, link
   references") — nested fences, escaped `|` in tables, and reference-style links all
   have edge cases a hand-rolled scanner tends to miss quietly. `remark` is a
   dev-only dependency (`scripts/`, not `src/sim`, not the shipped bundle) — ADR-0002's
   sim-purity law doesn't apply to it.

6. **A bold inline span must never land at the start of a wrapped line inside a
   paragraph, by construction.** This is the direct fix for the finding that opened
   #341: `**processed goods**` (an inline gloss inside the *Processing* entry) landed
   at line-start under width-wrapping and was miscounted as a header by a
   `^\*\*…\*\*` grep. Semantic breaks alone don't guarantee this — a clause boundary
   can coincide with a bold span exactly as easily as a width limit can. The
   normalizer detects this case from the AST (an inline `strong` node that is *not*
   the first child of its paragraph) and shifts the break to the adjacent boundary
   instead. A genuine header — bold as the paragraph's first content — is untouched;
   the two cases are distinguishable by tree position, not by guessing.

7. **Scope of #341 itself: build the tool + amend `WORKFLOW.md` + migrate
   `CONTEXT.md` as the proof segment. Nothing more.** Acceptance criterion 3 ("the
   `processed goods` artifact class can no longer produce a phantom header/count")
   can't be verified in the abstract — it needs `CONTEXT.md`, the file that actually
   contains the artifact, migrated for real. Every other segment (`docs/specs`,
   `docs/design-notes`, `docs/adr`, root docs, `docs/WORKFLOW.md` itself, `docs/PRD.md`)
   gets its own follow-up issue, filed once the tool exists and its first real
   migration (`CONTEXT.md`) has proven the approach.

## Mechanics settled without much debate (recorded for the implementer, not re-grilled)

- Soft length fallback: **100 characters** (current hand-wrap convention is ~90;
  rounding up so the fallback rarely fires against a working clause-based break).
- Script: `scripts/normalize-markdown.mjs` (Node ESM; `scripts/` is outside the
  `tsconfig` project references, and `remark` is a plain-JS/ESM library).
- Invocation: `npm run docs:normalize` (apply) and `npm run docs:normalize --
  --check` (gate mode).
- Allowlist storage: an array literal inside the script itself — not a separate
  config file. It's intentionally short-lived (retired once migration reaches full
  coverage per decision 4), so a second file for it would outlive its own purpose.

## Scope not decided here

- The exact list and order of follow-up segment-migration issues — filed once the
  tool ships against `CONTEXT.md`, not before (an issue referencing an npm script
  that doesn't exist yet is a promise with nothing to check it against).
- Whether `docs:normalize --check` ever gets wired into the merge gate proper
  (#332's detector set) — out of scope for #341; a natural input to #332 once the
  allowlist has real coverage.
