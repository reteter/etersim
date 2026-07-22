# 0029 — Engineer hat worn silently; feasibility claims locked as Designer decisions

- **Date:** 2026-07-22
- **Detected by:** Owner observation — the owner noticed the Engineer altitude had been worn without the required announcement, and asked; the driver confirmed on review.
- **Status:** Closed (explicit Engineer pass run same session; prevention trigger landed in ENGINEER.md).

## What happened

The E16 Workbench and #390 profitability sessions were framed and run as **Designer** grills
(the owner's "co", Engineer's "jak" to follow). Q1–Q4 stayed correctly at the Designer altitude
(mechanics, UX, which metrics). But two of #390's forks were **feasibility questions in disguise**:

- **Q1** locked net margin as "gross − route docking" with the aside that docking was "derivable
  cleanly, doesn't need per-ship attribution" — an **Engineer claim about the data**, presented as a
  clean Designer decision.
- **Q2** locked ROI *velocity* as "markup × loops-per-period" — which silently assumes a **loop
  count exists in the data**.

Neither claim was checked against the Ledger/route model at the time it was made. The Engineer
altitude was thus worn **without the ENGINEER.md-required explicit announcement** ("Zakładam
kapelusz Engineera"), and **ENGINEER.md working-law 1** ("every claim names the test that proves it;
a claim with no nameable test goes on the open-questions list") was skipped.

The defect surfaced at the pre-writeup `advisor` call, which performed the Engineer feasibility pass
that should have been conscious: the `dockingFee` `routeId` tag gives a *sum* but not a *loop
boundary*, and `ShipAssignment` (`{routeId, nextStopIndex, suspended, waiting}`) plus the Ledger
union carry **no loop counter and no loop-close event** — so "per loop" was underivable without a
*second* sim change. This forced two corrections grilled after the fact: **Q5** (tag `dockingFee`
rather than approximate) and **Q6** (reframe velocity to per-**day**, dropping "loop"). The owner
then flagged the implicit hat-switch as the root process slip.

## Impact

- **Outcome:** Low — caught before the E16 spec or #390 shipped the false claims; the corrected
  decisions (per-day velocity, `dockingFee` tag) are sound. Net cost: two extra grill turns.
- **Failure-mode class:** Med — an unvalidated feasibility claim locked as a Designer decision can
  reach an approved spec and an issue-cut, dispatching a coder against a decomposition built on an
  **underivable metric** — the "spec built on an outgrown model" the owner names as the real loss
  (HANDOFF §Design sessions are the work). Here only the advisor call stood between the claim and a
  doomed coder package.
- **Rules broken/skipped:** `docs/personas/ENGINEER.md` §Altitude contract ("worn in conversation …
  **announced explicitly**") and working-law 1 (claims name their test). Persona-hat discipline,
  WORKFLOW §Roles.

## Recurrence

**Medium** — structural driver: feasibility-shaped forks arrive *inside* Designer grills (a "what"
question whose answer secretly depends on "how"), and a flowing grill's momentum (owner: "pomysły
idą, żelki dobrze wprowadziły cukier") is a solvent on the announce-the-hat ceremony — the same
soft-precondition-dissolves-under-flow shape as 0022 (budget pressure dissolved the selfcheck) and
0021 (task-boundary discipline).

## Recommendation

- **Prevent:** name the trigger. A grill fork that hinges on **feasibility / derivability** ("can we
  compute X?", "does the data carry Y?") is an **Engineer-hat trigger**: announce the hat and apply
  law 1 (name the test / check the code) **before** the owner locks the fork. Landed as a trigger
  line in ENGINEER.md §Invocation this session.
- **Detect:** hard to mechanize — hat-announcement is a discipline, like 0022's "say the
  classification out loud." The working human detector is the **`advisor`-before-substantive-writeup**
  call, which fired here and did the Engineer's job; keep that habit.
- **Contain:** feasibility *interleaving* in a Designer grill is legitimate and even required
  (design must respect the model it runs on). The residual risk is only the missing
  announce-and-law-1 step, not the interleaving.

## Follow-up

- ENGINEER.md §Invocation gains the feasibility-fork trigger line (this session, session-close docs
  batch).
- The explicit Engineer pass on the E16/#390 decomposition was run the same session (announced hat,
  ENGINEER.md laws applied) — the "jak" that had been done silently, redone consciously.
