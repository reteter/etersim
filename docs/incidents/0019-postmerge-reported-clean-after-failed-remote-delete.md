# 0019 — postmerge.ps1 reported CLEAN after a remote branch delete that 403'd

- **Date:** 2026-07-19
- **Detected by:** self-check — the 403 was visible in the script's own output while the line directly under it said `OK deleted leftover remote branch`
- **Status:** Closed (exit-code + re-query guards landed in `scripts/postmerge.ps1`, same session)

## What happened

After PR #308 merged, `postmerge.ps1 -Pr 308` ran on `main`. Its branch-cleanup step
issued `git push origin --delete docs/design-surface-sweep`, which failed with
`Permission to reteter/etersim.git denied to Darecik` — git's credential cache still held
the other account while `gh` was correctly switched to `reteter` (incident 0018's split,
on the same machine that produced it). The script did not check `$LASTEXITCODE`, printed
`OK deleted leftover remote branch`, and finished with `POSTMERGE: CLEAN`. The remote
branch was still there, verified by `git ls-remote`.

## Impact

- **Outcome:** Low — caught immediately; branch deleted via the incident-0018 override, `git ls-remote` confirms it gone. No content lost.
- **Failure-mode class:** High — the script is what `CLAUDE.md` §Git & worktrees names as the cheapest path through wave close, on the stated grounds that it "refuses to report CLEAN when it verified nothing, which a hand-walk cannot do for you". A guard that announces success for a destructive action it did not perform is worse than no guard: it converts a loud 403 into a green certification. Under batch-merging this silently accumulates exactly the stale remote branches `CLAUDE.md` already warns about.
- **Rules broken/skipped:** none by the operator; the defect is in the guard itself.

## Recurrence

Medium — structural driver: the script's own §3 is titled *silent-fail guard*, yet its two
`git` mutations were the only commands in the file whose exit codes went unchecked. Every
other section verifies. A guard is only as good as its least-checked line.

## Recommendation

- **Prevent:** landed — `git branch -D` and `git push --delete` now `Fail` on non-zero exit, and the remote delete additionally re-queries `git ls-remote` before claiming success. The failure message names the incident-0018 override command.
- **Detect:** `POSTMERGE: FAIL` now fires instead of a green line; the pre-existing `git ls-remote` re-query makes a lying "success" impossible rather than merely unlikely.
- **Contain:** on a machine you do not own, prefer the incident-0018 override for pushes by default — the first write is still the only real identity test.

## Follow-up

Landed in this PR. Note for the sweep ledger: this is the second time in two sessions that
a document's confident claim about a tool ("refuses to report CLEAN…") outran what the tool
actually did.
