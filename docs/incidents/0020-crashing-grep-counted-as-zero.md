# 0020 — a crashing `grep` counted as zero, manufacturing ten sweep findings

- **Date:** 2026-07-19
- **Where:** design-surface sweep, Pass B opening measurement (s14)
- **Outcome severity:** Low — caught before anything was reported or committed.
- **Failure-mode class:** High — an under-count turns an audit's negative result into a false CLEAN.
- **Recurrence:** High — structural on both halves: the crash is GNU grep 3.0 under Git Bash on this machine, and `$(cmd | wc -l)` is the natural way to write a count.

## What happened

Sizing Pass B meant counting each of the 81 `CONTEXT.md` terms across the doc corpus, via
`count=$(grep -roiF "$term" $FILES | wc -l)`. On this machine **`grep -i` combined with
`-F` aborts**: `Aborted (core dumped)`, exit code **134**, a stack dump in `msys-2.0.dll`
dropped in the repo root. Every other combination is fine (`-ic` → 10, `-cF` → 9).

The crash was loud. **The measurement made it silent**, and that is the actual defect: the
pipeline sent grep's stdout to `wc -l`, which counted the empty output as `0`, and a
pipeline's exit status is its *last* command's — so `wc`'s clean `0` masked grep's `134`.
A crash was recorded as a data point.

The first measurement therefore reported **ten glossary terms with zero occurrences
anywhere in the corpus** — `Thaler`, `Stock`, `Reputation`, `Replay`, `Contract board` and
six others. At face value that is a finding: ten orphaned terms in the ubiquitous language.
It was about to be written up as one.

What stopped it was a domain check, not a tooling one: `Thaler` is the world's currency,
and a currency with zero mentions is impossible. Re-running with `-ioE` (no `-F`) and
validating against ripgrep gave **6 023 mentions, zero orphaned terms** — the broken
instrument had been showing **26 %** of the corpus.

## Impact

None landed. Ten fabricated findings avoided.

## Recommendation

- **Prevent:** never `-F` with `-i` in this repo's scripts; use `-ioE`. For anything a
  finding rests on, prefer the harness `Grep` tool (ripgrep).
- **Detect:** the general guard, since the next tool to fail will fail differently —
  **never pipe a command into a counter and treat the counter's output as the result.**
  `set -o pipefail`, or count in two steps and check the exit code. And anchor every
  corpus-wide measurement against one term whose answer is known in advance: a measurement
  with no anchor cannot report its own failure.
- **Contain:** accepted — the shell stays; the anchor check is the guard.

## Follow-up

Landed with sweep finding **F12**; `design-surface-sweep.md` now requires an anchored
validation before any Pass B count is trusted. Note the family: **0019** was unchecked exit
codes in `postmerge.ps1`, this is unchecked exit codes in a shell pipeline. Same defect,
different language, one session apart — the lesson did not transfer because it had been
written down as a fact about that script rather than as a rule about announcing results.
