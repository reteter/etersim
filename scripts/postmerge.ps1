#Requires -Version 7
<#
.SYNOPSIS
  Post-merge sweep & verify (issue #259).

.DESCRIPTION
  Run after squash-merging PRs, before certifying main. No decisions, no prompts —
  only checks and cleanup of already-merged things:

    1. git fetch --prune, then fast-forward main (when checked out).
    2. Incident 0010 guard: each merged PR's squash commit is reachable from origin/main.
    3. Silent-fail guard: prune local + leftover-remote branches of merged PRs.
    4. Incident 0011 guard: RED when extra worktrees exist (cert go-signal).
    5. Incident 0013 guard: WARN "npm install before cert" when a merge touched deps.

  Exit 0 = CLEAN (certification may proceed). Exit 1 = fix the red items first.

.PARAMETER Pr
  PR numbers to verify. Default: the 5 most recently merged.

.PARAMETER NoDelete
  Report-only mode: detect everything, delete nothing.

.EXAMPLE
  pwsh -File scripts/postmerge.ps1
  pwsh -File scripts/postmerge.ps1 -Pr 265,266 -NoDelete
#>
param(
    # [string[]] so that `pwsh -File ... -Pr 265,267` works too (-File passes it
    # as one literal string; PowerShell-native calls pass a real array).
    [string[]]$Pr,
    [switch]$NoDelete
)

$ErrorActionPreference = 'Stop'
$script:failed = $false

function Section([string]$t) { Write-Host "`n== $t" -ForegroundColor Cyan }
function Ok([string]$t) { Write-Host "  OK    $t" -ForegroundColor Green }
function Warn([string]$t) { Write-Host "  WARN  $t" -ForegroundColor Yellow }
function Fail([string]$t) { Write-Host "  FAIL  $t" -ForegroundColor Red; $script:failed = $true }

# 0. Where am I (incident 0008: print location before any gate-adjacent run).
$top = git rev-parse --show-toplevel
Set-Location $top
$branch = git branch --show-current
Section "postmerge @ $top | branch: $branch | HEAD: $(git rev-parse --short HEAD)"

# 1. Sync refs.
Section 'fetch --prune'
git fetch origin --prune
if ($branch -eq 'main') {
    $behind = [int](git rev-list --count 'main..origin/main')
    if ($behind -gt 0) {
        git pull --ff-only --quiet
        Ok "main fast-forwarded $behind commit(s) -> $(git rev-parse --short HEAD)"
    }
    else { Ok 'main is level with origin/main' }
}
else { Warn "not on main (on '$branch') — pull skipped; verification uses origin/main" }

# 2. Merged-PR content reachable from origin/main (incident 0010).
Section 'merged-PR verification'
if ($Pr) {
    $numbers = @($Pr -split ',' | Where-Object { $_ } | ForEach-Object { [int]$_ })
    $prs = @()
    foreach ($n in $numbers) {
        $json = gh pr view $n --json number,title,state,headRefName,mergeCommit
        if ($LASTEXITCODE -ne 0 -or -not $json) { Fail "could not resolve PR #$n on GitHub"; continue }
        $prs += $json | ConvertFrom-Json
    }
}
else {
    $prs = @(gh pr list --state merged --limit 5 --json number,title,state,headRefName,mergeCommit | ConvertFrom-Json)
}
# A verification script that verified nothing must not report CLEAN.
if ($prs.Count -eq 0 -and -not $script:failed) { Fail 'no merged PRs found to verify — nothing was checked' }

$mergedHeads = @()
foreach ($p in $prs) {
    if ($p.state -ne 'MERGED') { Warn "#$($p.number) is $($p.state), not merged — skipped"; continue }
    $oid = $p.mergeCommit.oid
    if (-not $oid) { Fail "#$($p.number) has no merge commit recorded on GitHub"; continue }
    git merge-base --is-ancestor $oid origin/main
    if ($LASTEXITCODE -eq 0) {
        Ok "#$($p.number) @ $($oid.Substring(0, 7)) — $($p.title)"
        $mergedHeads += [pscustomobject]@{ Number = $p.number; Head = $p.headRefName; Oid = $oid }
    }
    else { Fail "#$($p.number) squash commit $($oid.Substring(0, 7)) NOT reachable from origin/main (incident 0010)" }
}

# 3. Branch cleanup — merged PRs only; unmerged branches are never touched.
Section 'branch cleanup (merged PRs only)'
$cleaned = $false
foreach ($m in ($mergedHeads | Sort-Object Head -Unique)) {
    $name = $m.Head
    if (-not $name -or $name -eq 'main') { continue }

    git show-ref --verify --quiet "refs/heads/$name"
    if ($LASTEXITCODE -eq 0) {
        if ($NoDelete) { Warn "local branch '$name' still exists (report-only)" }
        elseif ($name -eq $branch) { Warn "local branch '$name' is currently checked out — switch to main, rerun" }
        else { git branch -D $name --quiet; Ok "deleted local branch '$name' (#$($m.Number))"; $cleaned = $true }
    }

    if (git ls-remote --heads origin $name) {
        if ($NoDelete) { Warn "remote branch 'origin/$name' still exists (report-only)" }
        else { git push origin --delete $name --quiet; Ok "deleted leftover remote branch 'origin/$name' (#$($m.Number))"; $cleaned = $true }
    }
}
if (-not $cleaned) { Ok 'nothing to clean' }

# 4. Worktrees — the certification go-signal (incident 0011).
Section 'worktree check'
$worktrees = @(git worktree list --porcelain | Where-Object { $_ -like 'worktree *' })
if ($worktrees.Count -le 1) { Ok 'single worktree — clean go-signal for certification' }
else {
    Fail "$($worktrees.Count) worktrees present — remove coder worktrees BEFORE certifying (incident 0011)"
    git worktree list | ForEach-Object { Write-Host "        $_" }
}

# 5. Dependency changes in the verified merges (incident 0013).
Section 'dependency check'
$depsTouched = $false
foreach ($m in $mergedHeads) {
    $files = git diff-tree --no-commit-id --name-only -r $m.Oid -- package.json package-lock.json
    if ($files) {
        Warn "#$($m.Number) touched $($files -join ', ') — run 'npm install' BEFORE certifying (incident 0013)"
        $depsTouched = $true
    }
}
if (-not $depsTouched) { Ok 'no package.json / package-lock.json changes in verified merges' }

# Summary.
Section 'result'
if ($script:failed) {
    Write-Host '  POSTMERGE: FAIL — fix the red items before certifying main' -ForegroundColor Red
    exit 1
}
Write-Host '  POSTMERGE: CLEAN' -ForegroundColor Green
exit 0
