# 0026 — Route-editor E2E omitted from affected set

- **Date:** 2026-07-21
- **Detected by:** full GitHub Actions E2E after local affected specs passed
- **Status:** Closed (affected test updated and full E2E rerun)

## What happened

A change in `HeadquartersPanel` altered route-order creation, but the local affected set included only Headquarters and Ledger specs. The dedicated qty/margin route-editor spec was omitted and still attempted implicit delivery at a port without a target.

## Impact

- **Outcome:** Low — CI caught one failing test before review/merge
- **Failure-mode class:** Medium — a stale E2E contract could leave the branch non-reviewable
- **Rules broken/skipped:** WORKFLOW §Verification gates, affected E2E uses the whole diff

## Recurrence

Medium — behavior spans one component and several feature-named E2E files.

## Recommendation

- **Prevent:** map changed controls and behaviors to specs, not only changed filenames
- **Detect:** run focused specs plus full E2E when route-editor order semantics change
- **Contain / follow-up:** CI remains the final backstop; no separate issue needed
