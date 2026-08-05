# Incident 0033 — a command run from a deleted working directory returned an answer-shaped result

- **Date:** 2026-08-05
- **Session:** E16 e2e rewrite wave (#472–#475)
- **Reporter:** session driver (Opus 5)
- **Severity:** Low (caught within one command; nothing wrong reached the repo or the owner)

## What happened

The wave was certified before merge by building a scratch worktree at `.claude/worktrees/wave-cert`,
merging both coder branches into it and running the full Playwright suite there.
Driving that run meant `cd`-ing into the worktree from the Bash tool —
whose working directory **persists across calls**.

At wave close the worktree was removed while the shell was still sitting inside it.
Two commands then ran from a directory that no longer existed:

- `rm -rf .claude/worktrees/wave-cert` failed with **`Device or resource busy`** — the shell holding
  the directory *was* the lock, so the driver briefly hunted for a stray `node` process that did not
  exist.
- `ls eslint.config.*` returned **`No such file or directory`**.

The second one is the reason this is filed.
That output reads as *"this repo has no ESLint flat config"* —
and it arrived at the exact moment the driver was deciding whether the leftover worktree could make
`eslint .` over-scan and produce a false RED (incident 0011).
A plausible next move was to conclude the config was missing and reason about lint from that.
`CLAUDE.md` §Commands says `eslint.config.js`;
the file was there the whole time.

## Impact

- **Outcome:** Low. The contradiction with `CLAUDE.md` was noticed immediately, the shell was returned
  to the toplevel, and the real answer (`eslint.config.js` ignores `.claude`, so incident 0011 could
  not bite) was established one command later. No false statement reached the owner, no gate was
  claimed on it.
- **Failure-mode class:** Medium. This is incident 0020's shape — **a command that failed for an
  environmental reason returned a result shaped like an answer.** There it was a crashing `grep` piped
  into `wc -l` counted as zero; here it is a `not found` from a deleted cwd read as a fact about the
  repo. The class is worse than a plain error because nothing looks broken.
- **Rules broken/skipped:** none. `.claude/hooks/git-worktree-guard.sh` (incident 0026) fires on *git
  commands addressing the wrong tree*; it cannot see a foreground shell's persistent cwd, and the
  commands here were `ls` and `rm`, not git.

## Recurrence

**High, and structurally so.** The Bash tool's working directory persists between calls by design,
and "remove the worktrees" is a fixed step of every wave close (`CLAUDE.md` §Git & worktrees).
The two meet at the end of every wave that used a scratch tree.
`scripts/postmerge.ps1` sets its own location and is therefore immune —
which is exactly why the exposure only appears in the hand-run steps around it.

## Recommendation

- **Prevent:** after removing any worktree, **`cd` back to the toplevel before the next relative-path
  command.** Better still, address wave-close commands by absolute path, the way the repo already
  requires for git (`git -C <toplevel>`).
- **Detect:** **a "not found" for a file the repo is known to have is a question about `pwd` before it
  is a fact about the repo.** The cheap check is `pwd` — the same first move incident 0008 mandated for
  gate-adjacent runs, applied one layer out to plain shell commands.
- **Contain:** nothing mechanized. A hook would have to inspect the shell's cwd on every call, and the
  two prior cwd incidents (0008, 0026) were mechanized precisely because they touched *git*, where the
  blast radius is a wrong branch. Here the blast radius is a wrong belief, and the tell — a repo file
  reported missing — is loud enough to name in prose.

## Follow-up

No issue filed;
the fix is a habit with a cheap tell, and its home is this report plus the §Log line.
