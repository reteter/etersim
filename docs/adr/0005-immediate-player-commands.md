# Player commands apply immediately in the store bridge

Trading requires pausing the sim to think (docs/specs/E2-trade-loop.md), but the store
previously queued dispatched commands into the next tick's command list; while paused,
`advance` early-returns and never flushes the queue, so paused trades silently never
applied. The store bridge now calls the sim's `applyCommand(world, command)` immediately
on `dispatch`, and the `requestAnimationFrame` loop folds elapsed time with empty command
lists (`tick(world, [])`).

## Considered Options

- **Queue into the next tick's command list (previous behavior)** — rejected: while
  paused, `advance` never runs, so queued commands never flush and trades silently
  never apply, breaking pause-to-trade.
- **Apply immediately via `applyCommand`, fold time separately** — chosen: matches how
  `tick()` already applies commands at tick start, so no new state-transition logic is
  needed and determinism is unaffected.

## Consequences

- Pausing to trade works: the player sees the effect of a command the instant they issue
  it, regardless of speed.
- Determinism is preserved: `tick()` already applies queued commands at the start of a
  tick (ADR-0003), so `applyCommand(world, cmd)` followed by `tick(next, [])` yields the
  same world as `tick(world, [cmd])` would have.
- Invalid commands are still safe: `applyCommand` returns the input world unchanged on
  rejection, so a bad dispatch is a no-op rather than requiring extra store-side handling.
