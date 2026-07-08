# 0002 — Gold reused for a price highlight (reserved color, near-collision)

- **Date:** 2026-07-08
- **Detected by:** The UI coder subagent self-reported it in its completion summary
  (caught mid-implementation, before finalizing); the orchestrator logged it.
- **Status:** Closed — the coder corrected it via a branch amend before the work was
  pushed, reviewed, or merged.

## What happened

While implementing E8 #62 (region price board overlay), the coder initially styled two
*different* UI signals with the same gold (`#e0a840`): the marker for the row of the
port where the Controlled Ship is docked, **and** the per-column best-price highlight
(cheapest ask / highest bid). ADR-0006 reserves gold for the Controlled Ship —
*one color, one meaning*.

The coder noticed before finalizing, reassigned the best-price highlight to a neutral
chip (light background + bold), kept gold only on the docked-port name, and amended the
#62 commit. The bad version never left the coder's worktree — not pushed, not reviewed,
not merged.

## Impact

- **Outcome:** Low — self-caught on an unpushed branch; zero user-facing effect, nothing
  to revert downstream.
- **Failure-mode class:** Medium — had it merged, gold would carry two meanings on a new,
  prominent overlay, quietly eroding the scarce-signal semantics ADR-0006 depends on.
  Cheap to introduce, expensive to notice later because it "looks fine."
- **Rules broken/skipped:** ADR-0006 §"Color semantics — one color, one meaning" (gold
  = Controlled Ship). Momentarily violated in code, reverted before the commit was
  finalized.

## Recurrence

**Medium** — structural: gold is already the repo's "this is important / selected"
accent, so it is the natural reach for any *new* highlight need. The reservation rule
lives in an ADR (0006) and the E10 spec — documents a coder building a fresh component
may never open. Every new UI surface with a "mark the best / selected thing" need
carries this pull.

## Recommendation

- **Prevent:** the lesson rides to every model — Anthropic or not — via the
  `README.md` §Log digest (this entry), which `CLAUDE.md` §Incidents already points to.
  A coder or reviewer scanning the log sees "gold is reserved; don't reuse it for
  highlights." No separate standing rule is added — the digest *is* the channel we built
  for exactly this.
- **Detect:** the two-axis `/code-review` Standards axis flags gold reuse against
  ADR-0006 — it would have caught this at the gate even without the self-catch. Standing
  net, no new work.
- **Contain:** none needed — prevention and detection are both cheap; residual risk is
  minimal.

## Follow-up

`README.md` §Log updated (0002). Unrelated observation from the same coder report — the
Playwright/`5173` `reuseExistingServer` masking trap — was carried into `CLAUDE.md`
§Commands as a coder-facing note (a docs-port, not an incident: the config already
documents the `PLAYWRIGHT_PORT` override).
