# Delegation-eval playbook — how to run a pre-registered paired eval

**Status:** LIVE. Distilled 2026-07-21 (s19) from the two-arm GPT-5.6 solo-driver eval on
#100 ([`eval-gpt-5.6-solo-driver-e13.md`](eval-gpt-5.6-solo-driver-e13.md) is the worked
example; read it for the frozen rubric/decision-rule shape). This file is the reusable
procedure — the *how*, generalized past #100.

> **The thesis this session actually proved, in one line:** *a ruler finding is an input to
> **verify**, not a verdict — and skepticism must be **symmetric**, applied as hard to the
> findings that protect the grade as to the ones that sink it.* (The Terra run almost stamped
> NO-GO on an unverified "correctness escape" label whose line-cites were ~40 off; a hand-trace
> demoted it to benign and the verdict to CONDITIONAL. The same distrust then had to be turned
> on "hard-law scan CLEAR" — an auto-NO-GO trigger — which was re-verified by grep.)

## The one root cause (why most of this exists)

Three "separate" failures in the Terra re-run — the reference-solution leak, the auto-memory
verdict leak to the ruler, and the instrument-parity divergence — are **one bug**: *arm-2 ran
in a world arm-1 didn't* — after the answer key was merged onto `main` and the verdict was
written into the repo's memory/notes. Arm-1 (Sol) got a clean world for free because it ran
*before* any of that existed. So the organizing principle is isolation, and it has a cheap
default:

- **Primary — temporal isolation (the common case):** run **all arms before** the reference is
  merged or the verdict is recorded anywhere. Baseline = a commit that predates the answer. If
  arms run back-to-back pre-merge, almost all the mechanical hygiene below is unnecessary.
- **Fallback — spatial isolation (only when arms must be staggered** against already-merged
  work, e.g. a later cheap-tier re-run): a clean-room clone. Do **not** make every eval pay this
  cost — it is the exception, gated on "the answer already exists in this repo."

## Spatial isolation — the clean-room clone (fallback only)

When an arm must run after the reference is already in the repo:

1. **Clone to a distinct filesystem path** whose history does **not** contain the
   reference-bearing commits (clone from the baseline; or clone then `git branch -D`/filter the
   answer branch so `git log` cannot surface `<answer-sha> feat: …#N`). The point defeated here
   is real: in the Terra run the model ran `git log`, **found** the merged-#100 commit by name,
   and asked to read its diff. A baseline *checkout* protects the working tree but **not the
   object store or `git log`** — only absent history does.
2. **Verify auto-memory keying by path.** Per [[subagent-context-mechanics]], fresh Claude
   subagents get the `MEMORY.md` index — which, post-eval, carries the verdict. A clone at a new
   project path *plausibly* gets no verdict-bearing auto-mem, but **check the keying, don't
   assume it.** This is also what sidesteps the session-state clobber (below).
3. **The ruler's cwd must be inside the clean clone** — not a worktree nested under the original
   project path. In the Terra run the ruler ran from a worktree under the real project, so the
   verdict-bearing `MEMORY.md` index still reached it; the neutral *branch name* helped, the
   *path* didn't.
4. **Spell out retrieval — isolation must not break "the branch comes back for measurement."**
   Decide the fetch path up front (`git fetch <clone-or-fork> <arm-branch>`); a fully detached /
   different-remote clone can make getting the branch back awkward. Isolate history, keep a
   retrieval channel.

## Procedure (checklist)

0. **Pre-register, frozen.** Below a `═ FROZEN ═` line, commit *before any arm runs*: the
   decision rule, the rubric/axes, each control arm's package, **and the exact ruler prompt
   text as a committed artifact** (see next). Results are appended *below* the frozen section,
   never edited into it.
1. **Freeze the ruler prompt as a byte-identical file, reused verbatim per arm.** This is the
   single highest-leverage fix. The instrument-parity failure happened because arm-1's prompt was
   a "frozen *definition*" that got reconstructed from memory (and lost to compaction), so arm-2's
   was written fresh and more explicit — and caught a gap (the no-dominance guardrail) that arm-1's
   silently missed. **If the instrument is not byte-reproducible across arms, say so loudly: the
   comparison is degraded, not clean.**
   - ⚠️ **Trap:** "different prompts for the reviewers" is the **wrong** reading. Reviewer prompts
     must be **identical, frozen, byte-for-byte across arms.** What varies is only the diff under
     review, never the instrument.
2. **Hand the arm** the baseline + the raw issue/operative-AC, and let it read the repo docs
   itself (that *is* the portability test). No reference-solution access (see isolation).
3. **Independent gate re-run** on the returned branch — typecheck / lint / unit / build /
   affected e2e — with your own numbers. **Ignore the model's self-reported test counts** (the
   Terra report gave inconsistent 728/725/752). Verify the baseline is *exactly* the frozen
   commit: `git merge-base --is-ancestor <baseline> <arm>` **and** parent-of-first-commit =
   baseline, not merely "descendant."
4. **Measure — the ruler.** Author-blind: neutral worktree/branch name (the real branch name,
   e.g. `eval/100-gpt-terra`, is a strong authorship tell); explicit instruction to disregard
   `docs/design-notes/`, `docs/HANDOFF.md`, and any memory/session-state; judge the diff against
   the absolute merge bar first, `file:line` on every finding, hard-law scan, whole-issue
   aggregate. The ruler **measures** (findings, severities, citations) — it does **not** issue
   the verdict.
5. **Adjudicate — the Orchestrator (not the ruler).**
   - **Independently verify the verdict-movers, in both directions.** Auto-NO-GO triggers
     (hard-law: `Math.random`/`Date.now`/React-DOM in `src/sim`; suppress-to-green) **and** the
     specific findings that flip the trinary — verified by grep/read whether they *help or hurt*
     the model. A ruler severity *label* ("correctness escape") is a claim to check, not a
     verdict input: trace the actual runtime consequence (guarded access? recomputed vs read
     from save? who consumes the field?). **Minors stay ruler-reported** — don't expand this into
     "verify everything."
   - **Apply the frozen decision rule mechanically.** Don't fold "majors" into "didn't clear the
     bar" post-hoc if the bar is defined on *blocking* findings; NO-GO has its own separate
     triggers (a correctness *escape*, not a missing feature; an uncatchable class). A missing
     named feature is **under-reach → below-threshold/CONDITIONAL**, not NO-GO.
6. **Attribution — grep-verified code facts vs *all* control arms.** For each gap, read the
   actual code/tests in every arm (not the ruler's opinion) to place it: shared-with-control =
   task difficulty; present-in-control-absent-here = arm-specific. **Hunt each arm's gaps
   symmetrically** — checking only "does the control have what *this* arm was dinged for" biases
   the comparison (we did that; "Sol is the shallower CONDITIONAL" is bounded by it).
7. **Record.** Append results below the frozen line. **Corrections to a recorded verdict go via
   strikethrough + dated erratum, never a rewrite** — pre-registration integrity is the whole
   selling point; a below-frozen *conclusion* may be struck, the frozen rubric and the data never
   touched.
8. **Cost (Axis 5).** Record the meter at **start and end** (non-reconstructable post-hoc);
   confirm whether tiers/vendors **share a pool** (same denominator = directly comparable; Terra
   vs Sol shared one weekly pool → 16% vs 45% is a real ratio). Report, **never rank into the
   verdict** — cost is a *casting* signal, not a capability one.

## Concurrency footgun (independent of eval design)

`MEMORY.md` / `session-state.md` is a **single shared pointer**; when two sessions run against
the same repo (here: the eval session and an Orchestrator session), the second write **clobbers**
the first. On close, **merge the two threads, don't overwrite** — the eval close nearly erased a
pending-#101-wave-check forward pointer. (Spatial isolation via a clone also avoids this.)

## n=1 inference (carry from the worked example)

One paired run **falsifies strongly, confirms weakly.** A hard-law breach or a verified
correctness escape is dispositive (NO-GO from n=1 is trustworthy). A clean pass or a CONDITIONAL
is **provisional-pending-more-n** — it licenses "continue under observation," not "unattended
delegation."
