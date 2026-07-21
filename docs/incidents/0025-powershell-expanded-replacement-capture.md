# 0025 — PowerShell expanded a replacement capture

- **Date:** 2026-07-21
- **Detected by:** immediate semantic-anchor verification after a mechanical edit
- **Status:** Closed (fixture restored from `HEAD`, transform reapplied safely)

## What happened

A Node replacement containing `$1` was embedded in a PowerShell double-quoted command. PowerShell expanded the capture token first, so Node briefly erased matched `siteStoreValue` values in an uncommitted golden fixture.

## Impact

- **Outcome:** Low — caught immediately; no commit or lasting data loss
- **Failure-mode class:** Medium — plausible-looking fixture corruption could land
- **Rules broken/skipped:** none; this was a command-safety near-miss

## Recurrence

Medium — two interpreters make replacement capture syntax structurally fragile.

## Recommendation

- **Prevent:** use replacement callbacks or `apply_patch`, not shell-expanded captures
- **Detect:** verify preserved semantic anchors and run the fixture's focused tests
- **Contain / follow-up:** restore from `HEAD` before reapplying; prevention used here, no issue needed
