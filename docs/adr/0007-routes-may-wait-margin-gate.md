# Routes may wait: the Margin Gate exception to E9 equivalence

E9 shipped Routes under an **equivalence guarantee**: a routed Stop executes by dispatching
the very same buy/sell/deliver Commands a manual player could issue, so a route can do nothing
a player couldn't do by hand (ADR-0005; E9 spec, `route.ts`, the docking-phase pass in
`tick.ts`). The E9.1 grill (2026-07-15, from #254) added two route features — a per-good
**quantity** (`qty`, "up to N") and a **Margin Gate** (`minMargin` on buy orders: wait in port
until a good's predicted per-unit margin clears a threshold). `qty` stays inside the guarantee
("buy N" / "sell N" are ordinary Commands). The Margin Gate does **not**: there is no single
manual Command meaning "wait for margin," so a gated route expresses intent the sim could not
express before. Decided with the owner alongside `docs/specs/E9.1-route-qty-and-margin-gate.md`.

## Decision

- **The Margin Gate is a deliberate, scoped exception to E9 equivalence.** A routed Ship may
  now *wait* — dwell docked at its own next Stop, re-evaluating each tick — which no manual
  Command does. The exception is recorded here rather than buried in spec prose.
- **Scope is buy-only and narrow.** `minMargin` is valid on **buy** orders only (never sell,
  never deliver); `qty` does **not** break equivalence and is not part of this exception. No
  waiting to *sell* for a better price (owner: deliberately excluded).
- **Determinism is preserved (ADR-0003 intact).** The gate is a pure per-tick evaluation:
  `unitMargin(here, reference port) ≥ minMargin`, computed with the same market pricing
  functions the real Commands use (no phantom margin, no `Math.random`, no `Date.now`). Gate
  evaluation reads pre-`marketTick` prices, exactly as the docking-phase Commands do, so the
  same seed + inputs yield the same wait/advance decision every run.
- **The wait requires new persistent state — the `waiting` bit.** The gate creates a route
  configuration unreachable before: "docked at my own next Stop, siblings already executed,
  `nextStopIndex` not advanced." Today arrival executes *and* advances in one call, so this
  mid-tick state never exists in `World`. The gate makes it real, and it **must be persisted**
  (`ShipAssignment.waiting?`) — autosave (every 24 ticks) can land mid-wait, and a reload must
  distinguish "just arrived" from "been waiting" or it re-runs non-idempotent sibling buys.
  The stored bit is the correctness state; the UI "czeka na marżę" display stays *derived*
  from route + live prices.
- **Multiple gated buys at one Stop are atomic (v1).** The ship waits until **all** gates at
  the Stop pass, then fires all gated buys together and advances. This forces a specific
  ordering consequence: gated buys fire as a **deferred atomic group on the advance tick**, not
  in list position — because non-gated siblings must already have run on arrival, a gated buy
  cannot execute in its list slot. Firing the group once, only on the advance tick, keeps it
  idempotent across the autosave boundary. Per-order gate satisfaction is a parked,
  save-compatible future extension.

## Considered Options

- **No gate — routes stay strictly equivalent (status quo).** Rejected: the owner wants the
  intent "don't buy here until carrying this good onward is worth it," which the equivalence
  model structurally cannot express. Keeping equivalence would mean not building the feature.
- **Express the gate as a new manual Command** ("wait-for-margin" a player could issue), keeping
  equivalence formally intact. Rejected: a manual waiting Command is a mechanic no one asked
  for and a worse UX than a route condition; it would smuggle the same hidden state in under a
  different name without honestly recording the exception.
- **Derive the wait state instead of storing it** (recompute "am I waiting?" from route + prices
  on load). Rejected: not reconstructible — a reload cannot tell "just arrived, siblings not yet
  run" from "been waiting, siblings already run" from `World` alone, so sibling buys would
  re-run after an autosave mid-wait. The bit must be stored.
- **A deliberate, scoped, ADR-recorded exception with a stored `waiting` bit (chosen).** Builds
  the feature, keeps determinism and save/load identity, and records the one place routes step
  outside equivalence so no future reader mistakes it for a bug.

## Consequences

- Routes are no longer "a frozen bet that its spreads keep paying" without qualification — a
  gated route can dwell indefinitely (by design; the player owns the threshold). Two humane
  safeguards are load-bearing, not optional: a **visible UI indicator** (a waiting ship shows
  *"czeka na marżę ≥ X (teraz Y)"*) and the existing escape hatch (a manual `sailTo`
  auto-suspends the route). Natural counter-pressure needs no code: flat daily upkeep burns on a
  waiting ship with zero revenue, so an absurd threshold is self-punishing.
- `World` gains genuinely hidden route state (`ShipAssignment.waiting?`), so the save format
  bumps `SAVE_VERSION 10 → 11`. The migration is an additive identity (absent ⇒ not-waiting),
  documented as lossless — the bump keeps "version tracks World shape" honest rather than
  silently reinterpreting v10 as v11.
- The equivalence guarantee remains the rule; this is its **one** recorded exception. Any future
  route condition that makes a ship wait or otherwise act outside the Command set must extend or
  cite this ADR, not quietly widen the gap.
- CONTEXT.md gains a **Margin Gate** glossary entry, and the **Route**/**Stop** entries are
  amended (`waiting?` in ship-side state; `qty`/`minMargin` on Stop orders; the "no waiting, no
  conditions" wording gains the gate exception).
