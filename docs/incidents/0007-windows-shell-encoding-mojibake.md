# 0007 — gh PR body garbled by Windows shell-encoding roundtrip (cp1250)

- **Date:** 2026-07-12 (filed as issue #136 at session end; landed 2026-07-15)
- **Detected by:** owner — spotted mojibake in PR #135's description on GitHub at session end
- **Status:** Closed (body re-uploaded via `gh pr edit --body-file`; no information lost)

## What happened

While ticking the review checkbox in PR #135's body, the body was piped through
`gh pr view -q .body | python -c ... | gh pr edit --body`. On Windows, Python
read stdin in the locale encoding (cp1250), so every non-ASCII character in the
UTF-8 body (₸, —, §, →, …) was silently re-encoded as mojibake ("â‚¸", "â€”",
"Â§") and written back to GitHub.

Related near-miss in the same session: `git add -A` swept a local
`.claude/launch.json` into a commit — caught pre-push; the file is now gitignored.

## Impact

- **Outcome:** Low — cosmetic corruption of one PR description; issues, comments,
  commit messages and the squash-merge message on `main` were unaffected (they
  went through heredocs / `--body` directly). Fixed the same session.
- **Failure-mode class:** Medium — the same roundtrip through a spec file, an
  issue with acceptance criteria, or CONTEXT.md would silently corrupt a source
  of truth; mojibake in prose is visible, but a corrupted `₸` constant or Polish
  UI string pasted back into code could survive review.
- **Rules broken/skipped:** none — tooling hazard, not a process deviation.

## Recurrence

Medium — structural driver: Windows locale (cp1250) vs the repo's UTF-8
everywhere; any pipe with python/PowerShell in the middle re-encodes silently.
The hazard sits in the default toolchain, not in a one-off command.

## Recommendation

- **Prevent:** never roundtrip gh/git text through a pipe on Windows. For any
  body edit, write the text to a file with a tool that guarantees UTF-8 and use
  `gh ... --body-file` / `git commit -F`.
- **Detect:** eyeball non-ASCII characters (₸, —, §, Polish diacritics) on
  GitHub after any body edit made from a Windows shell.
- **Contain:** GitHub keeps the pre-edit body in the edit history — recovery is
  copy-paste, not reconstruction.

## Follow-up

Landed with this report: §Log line in `docs/incidents/README.md`. The
`--body-file` habit is already standing practice in orchestrator sessions
(scratchpad file + `--body-file` for every PR since). Closes #136.
