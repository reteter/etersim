#Requires -Version 7
<#
.SYNOPSIS
  Epic-start mirror snapshot (issue #454, ADR-0010).

.DESCRIPTION
  Run before an epic's first coder dispatch. Pushes `main` to the off-GitHub mirror
  and tags the snapshot, then VERIFIES the mirror actually received both.

  This script exists because the manual owner-merge gate was retired (ADR-0010) and
  the mirror is what replaced its undo half. A mirror that lives in prose is a habit;
  habits dissolve under budget pressure (incident 0022). So:

    1. Refuse to snapshot anything but a clean `main` level with origin/main.
    2. Push main to the mirror remote.
    3. Create the annotated tag snapshot/<Epic>-start — never move an existing one.
    4. Push the tag.
    5. Re-read the mirror and compare SHAs. Nothing is reported OK on the strength
       of a push's own exit code.

  Exit 0 = SNAPSHOT VERIFIED. Exit 1 = the snapshot does not exist; do not dispatch.

  NOTE (this machine): the mirror's credentials resolve under PowerShell/Windows
  Credential Manager, not under the WSL-backed Bash tool. Run this with pwsh.

.PARAMETER Epic
  Epic label for the tag, e.g. E15. Tag becomes snapshot/E15-start.

.PARAMETER Remote
  Mirror remote name. Default: codeberg.

.EXAMPLE
  pwsh -File scripts/mirror-snapshot.ps1 -Epic E15
#>
param(
    [Parameter(Mandatory = $true)][string]$Epic,
    [string]$Remote = 'codeberg'
)

$ErrorActionPreference = 'Stop'
$script:failed = $false

function Section([string]$t) { Write-Host "`n== $t" -ForegroundColor Cyan }
function Ok([string]$t) { Write-Host "  OK    $t" -ForegroundColor Green }
function Fail([string]$t) { Write-Host "  FAIL  $t" -ForegroundColor Red; $script:failed = $true }

# 0. Where am I (incident 0008).
$top = git rev-parse --show-toplevel
Set-Location $top
$branch = git branch --show-current
$tag = "snapshot/$Epic-start"
Section "mirror-snapshot @ $top | branch: $branch | HEAD: $(git rev-parse --short HEAD) | tag: $tag"

# 1. Preconditions. A snapshot of a dirty or lagging tree records the wrong thing.
Section 'preconditions'
if ($branch -ne 'main') { Fail "not on main (on '$branch') — snapshot the integration branch, not a feature branch" }
else { Ok 'on main' }

if (git status --porcelain) { Fail 'working tree is dirty — commit or stash before snapshotting' }
else { Ok 'working tree clean' }

git fetch origin --quiet
$ahead = [int](git rev-list --count 'origin/main..main')
$behind = [int](git rev-list --count 'main..origin/main')
if ($ahead -ne 0 -or $behind -ne 0) { Fail "main is not level with origin/main (ahead $ahead, behind $behind)" }
else { Ok 'main level with origin/main' }

if (-not (git remote get-url $Remote 2>$null)) { Fail "remote '$Remote' is not configured" }
else { Ok "mirror remote '$Remote' configured" }

if ($script:failed) {
    Section 'result'
    Write-Host '  SNAPSHOT: FAIL — preconditions unmet, nothing was pushed' -ForegroundColor Red
    exit 1
}

$local = git rev-parse main

# 2. An existing tag is never moved — it would erase the state it was taken to preserve.
Section 'tag'
$existing = git rev-parse -q --verify "refs/tags/$tag" 2>$null
if ($existing) {
    if ((git rev-parse "$tag^{commit}") -eq $local) { Ok "$tag already exists at $($local.Substring(0,7))" }
    else { Fail "$tag already exists at $((git rev-parse "$tag^{commit}").Substring(0,7)), not at main $($local.Substring(0,7)) — pick a different epic label rather than moving it" }
}
else {
    git tag -a $tag -m "Epic $Epic start — pre-dispatch snapshot (ADR-0010)"
    Ok "created $tag at $($local.Substring(0,7))"
}

if ($script:failed) {
    Section 'result'
    Write-Host '  SNAPSHOT: FAIL — tag conflict, nothing was pushed' -ForegroundColor Red
    exit 1
}

# 3. Push. Exit codes are recorded, never trusted as the verification.
Section "push -> $Remote"
git push $Remote main
if ($LASTEXITCODE -ne 0) { Fail "push of main to '$Remote' reported failure" } else { Ok 'main pushed (unverified)' }
git push $Remote $tag
if ($LASTEXITCODE -ne 0) { Fail "push of $tag to '$Remote' reported failure" } else { Ok 'tag pushed (unverified)' }

# 4. The actual gate: re-read the mirror. Incident 0019 — a push that reports success
#    can still leave the remote unchanged under a stale credential cache (incident 0018).
Section 'verify against the mirror'
$refs = @(git ls-remote $Remote 2>$null)
if (-not $refs) { Fail "could not read refs from '$Remote' — the snapshot is unverified, treat it as absent" }
else {
    $remoteMain = ($refs | Where-Object { $_ -match "\srefs/heads/main$" }) -split "\s+" | Select-Object -First 1
    if ($remoteMain -eq $local) { Ok "$Remote/main == local main @ $($local.Substring(0,7))" }
    else { Fail "$Remote/main is $($remoteMain ?? '<missing>'), local main is $($local.Substring(0,7))" }

    if ($refs | Where-Object { $_ -match "\srefs/tags/$([regex]::Escape($tag))$" }) { Ok "$tag present on $Remote" }
    else { Fail "$tag NOT present on $Remote" }
}

Section 'result'
if ($script:failed) {
    Write-Host '  SNAPSHOT: FAIL — do not dispatch the epic until the mirror holds this state' -ForegroundColor Red
    exit 1
}
Write-Host "  SNAPSHOT: VERIFIED — $Remote holds main @ $($local.Substring(0,7)) as $tag" -ForegroundColor Green
exit 0
