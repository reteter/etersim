# Automation must present an observable idle state at tick boundaries

A design principle surfaced while building E9 (#80 route execution, PR #110). Terms
per [CONTEXT.md](../../CONTEXT.md); process per [WORKFLOW.md](../WORKFLOW.md).

---

## The principle

**Any automated actor in the sim must present an observable idle state at a tick
boundary, so the player can intervene.** Player commands apply at tick boundaries and
the UI renders boundary state; an actor that is only ever mid-action *between*
boundaries can never be grabbed.

`sailTo` requires a **docked** ship — you cannot redirect a ship mid-voyage. So for the
spec's promise to hold — *"a manual `sailTo` to a routed ship auto-suspends its Route
… no rejected command"* ([E9 spec](../specs/E9-fleet-and-routes.md) — Routes) — a routed
ship **must be docked at some tick boundary**. Otherwise auto-suspend is unreachable and
the player loses agency over their own fleet.

## Where it bit (E9)

The first route implementation executed a Stop's orders and **re-dispatched the ship in
the same tick**. Consequence: a routed ship was underway at the end of *every* tick —
never docked at a boundary — so a manual `sailTo` (docked-only) could never land. The
feature compiled, most tests passed, and the gap was invisible until a behaviour test
(`suspend & resume`) failed because the ship was never observably docked.

The fix is the **1-tick dwell**: a ship arrives, executes its Stop, and *dwells docked
for one tick* before departing on the next Course. This also mirrors manual play's
natural quantization (a manual trader can't act until the tick after they dock either),
so routed behaviour moves *toward* the equivalence guarantee, not away from it.

## Why it generalizes

The same constraint governs every automation layer we've hooked or parked:

- **E11 Harness** (policies drive the same Commands) — a policy-driven ship needs the
  same intervention window; the dwell already provides it.
- **"Supplier" ship automation** (parked hook, E9 non-goals) and any future
  auto-behaviour — each must leave a boundary where the player can take manual control.
- **UI (#83–86)**: the fleet list can only show a grabbable "docked at Stop, on route"
  state because the dwell makes that state exist.

## The check, for next time

When designing any automated actor, ask at the **design** stage, not implementation:
*at which tick boundaries is this actor idle enough for the player to intervene, and
which command lands there?* If the honest answer is "never", the automation has quietly
taken agency away — add an observable idle state (a dwell, a pause, a docked beat)
before building it.

_Status: realized in E9 as the 1-tick Stop dwell (PR #110); recorded here as a standing
design rule for future automation. Not a spec of its own — the mechanic lives in the
[E9 spec](../specs/E9-fleet-and-routes.md) (Tech — docking phase)._
