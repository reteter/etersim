# Eval — GPT 5.6 as a solo driver of the E13 implementation loop (pre-registered)

**Date:** 2026-07-21 (s18). **Status:** LIVE — pre-registered; frozen before either arm
starts. **Baseline:** `main @ d5bac94` (post-E13.0). **Tracked by:** #369.

**This document is pre-registration.** Everything below the line "═ FROZEN ═" was written
**before GPT 5.6 touched #100 and before either arm produced code**, so the rubric and the
decision rule cannot be reshaped around the results. Results and the verdict are appended
**below** the frozen section, never edited into it. If a term proves unmeasurable, that is
recorded as a finding, not silently reinterpreted.

## The decision this eval feeds

Can etersim's process be delegated as a **whole implementation loop** to a foreign solo
driver — GPT 5.6 operating in its own harness, with **no access to Anthropic models**
(no advisor layer, no Claude coder/reviewer inside its harness)? Output: a go/no-go, with
conditions, on using GPT-solo to drive real E13-class milestones — and a datapoint for the
`PROCESS.md` thesis that *design intent survives delegation* / *any model in any harness*.

This is **not** a claim that "GPT 5.6 the model beats Sonnet." Role, harness, and model are
bundled on purpose (§Threats). We are casting a *bundle* and testing a *process*, not
isolating a model.

═══════════════════════════════════ FROZEN ═══════════════════════════════════

## Design (settled by the 2026-07-21 grill)

- **Unit:** one solo-driven loop over the **whole of #100** (GPT self-orchestrates the
  entire issue end-to-end: selfcheck → spec-read → branch → TDD → self-review → PR).
- **Comparison arm (control, not contest):** the **normal etersim pipeline** implements the
  same #100 — Orchestrator dispatches a Sonnet coder (decomposed via the frozen 100a/b/c cut
  below), Opus two-axis wave check. The Claude arm exists to **calibrate attribution** of
  GPT's gaps (task-difficulty vs pipeline/model), not to crown a winner.
- **Whole-vs-whole.** Both deliverables are compared as complete #100 implementations from
  the same frozen baseline. The split binds **only the Claude arm** — GPT's own
  decomposition is *output we evaluate* (Axis 4), not a boundary condition imposed on it.
- **Ruler held constant:** output quality is measured by the **same Opus two-axis wave
  check** that produced the Sonnet scorecard baseline, run out-of-band on the Claude side,
  on each deliverable's diff. GPT needs no Anthropic access — the measurement happens here,
  on the returned branch.
- **Sequencing — GPT-first, for structural no-leakage:** GPT solo-drives #100 from the
  frozen baseline and returns a branch **before the Claude arm is dispatched**. The Claude
  coder is dispatched fresh (no transcript) from the same baseline; GPT's work is never put
  in its package. GPT literally cannot see the Claude arm (it does not yet exist); the Claude
  coder cannot see GPT's (not in its package). See §Ordering confound for the residual risk
  and its fix.
- **Review is disclosed, not blinded.** True blinding is infeasible — the two arms have
  divergent shapes (Claude = a tidy 3-PR stack with `Co-Authored-By: Claude`; GPT = its own
  structure/style), which reveals authorship regardless of branch names. Bias control instead:
  each deliverable is judged **against the absolute merge bar first, findings recorded
  per-arm before any head-to-head**; every finding carries a `file:line` citation (repo
  standing discipline — verifiable, not vibes); the owner spot-audits the GPT arm's findings
  for same-vendor-reviewer fairness.
- **Winner merges** as the real #100 (unblocks #101/#102); the losing arm's branch is
  quarantined/discarded. Merge choice priority: **mergeable-safety > contract-conformance >
  output-quality > cost**; architecture elegance is a tiebreak, never a gate.

## Frozen Claude-arm package (pre-registered to close the ordering confound)

Because the Orchestrator sees GPT's deliverable before shaping the Claude arm, the Claude
decomposition, scope boundaries, and AC resolution are **frozen here now** — they may not be
adjusted after GPT's work is seen (no teaching-to-the-test). #100's operative AC is its
newest amendment comment (2026-07-19 08:25), which supersedes the body. That AC is split
into three sequential, individually-mergeable coder packages:

**100a — Building commission + Granary** (base = frozen baseline). Owns:
`CompanyBuilding = { type:"storehouse"; variant:GuildId; portId; store:GoodsStore }`; the
Granary variant; `commissionGuildBuilding(type, variant, portId)` (distinct from E14's
`commissionBuilding`); permit gating by guild rank; placement validation (archetype/freeport);
one-active-order via the existing `hasActiveBuildOrder` (`commands.ts:126-137`); construction
machinery reuse (auto-draw / deliver / rush / stall / completion → `completed` Ledger kind);
`Company.buildings` round-trip. **Boundary:** no goods movement, no route orders, no netWorth
term, no migration.

**100b — Manual store/withdraw + StorePolicy** (base = 100a). Owns: the `StorePolicy` variant
`{ kind:"storehouse"; filter; capacity }` consumed by `accepts` (`STOREHOUSE_CAPACITY = 200`,
Granary filter = grain); `storeGood(shipId, good)` / `withdrawGood(shipId, good)` via
`Transfer` (capacity clamp, hold clamp, goods-filter rejection, zero-qty no-op, market-free);
Ledger `store` / `withdraw` kinds. **Boundary:** no route/Stop-order execution, no explicit
`StoreRef`, no netWorth, no migration.

**100c — Route integration + netWorth + persistence (OQ8)** (base = 100b). Owns: `StopOrder`
kind union `+= "store" | "withdraw"`, executed in the docking phase (no-wait law);
route↔manual parity (equivalence); explicit `StoreRef` addressing with `resolveDeliveryTarget`
**deleted, not extended**; netWorth `buildingStoreValue` `NetWorthBreakdown` field via the
`companyStores` walk + value-neutrality invariant; `SAVE_VERSION` → 14, `migrateV13ToV14`
backfilling `buildingStoreValue: 0`; byte-equal Ledger over building scripts; the
no-dominance guardrail (buy-store-sell ⊁ carry loop, standard seed). **Boundary:** UI is out
of scope (that is #101).

## Pre-registered rubric

GPT's deliverable is a branch. What GPT *can* run (its coder-minimum, harness-agnostic):
tests / typecheck / lint green, affected e2e if UI touched, and an **AC→deliverable evidence
report**. What it *cannot* run — the Opus wave check — is measured out-of-band here.
Conformance is judged against what GPT can run, not against gates absent from its harness.

| Axis | What it measures | How scored |
| --- | --- | --- |
| **1. Contract conformance** (HEADLINE, harness-robust) | the laws a solo driver is subject to (see §Conformance threshold) | per-item checklist; hard-law breach = auto-NO-GO |
| **2. Output quality** (via the constant ruler) | Findings (count + worst severity), Fix-loop rounds the wave check would demand, Cert (gates pass on independent re-run) + Notes smells (weak-test / incident-0005, dishonest `dispatchEvent`, over-claiming test titles) | same three scorecard numbers; **both arms reviewed at the whole-#100 aggregate level** (§Granularity symmetry) |
| **3. Incident generation** (repo scar metric) | rule broken / wrong repo-branch-file / near-miss; a failure class no gate would have stopped before main | count + severity; an uncatchable class → NO-GO |
| **4. Autonomy / self-orchestration** (solo-specific) | its own decomposition quality (sane parts vs one monster PR); routed design/scope questions vs baked into the diff; correct override of wrong issue prose by operative AC; over-reach (re-scope) and under-reach (skipped named AC) | qualitative, `file:line`-cited |
| **5. Cost** (non-comparable, flagged) | common denominator = USD estimate (Claude arm also estimated in USD; %-session-limit noted alongside for scorecard continuity) | reported, never ranked on |

### Conformance threshold (Axis 1) — enumerated, frozen

- **Hard-law breach = automatic NO-GO**, regardless of output quality: non-determinism in
  `src/sim` (`Math.random`/`Date.now`), any action on `main`, suppress-to-green
  (`lint --fix` to clear, `--no-verify`, weakening a test to pass it), sim-purity violation
  (React/DOM in `src/sim`).
- **Soft-law miss that the gates/wave-check independently catch** (e.g. no §5 selfcheck
  report posted, but code correct and gates green; a missed docs-sync the sweep would flag)
  → **CONDITIONAL** (process-addable: a tighter package or a checklist closes it).
- **Soft-law miss that disarms the safety net** → tips toward **NO-GO**: weak self-authored
  assertions hiding a real bug (incident-0005 pattern) that GPT's own process did not catch;
  an after-the-fact `src/sim` test with no named red-evidence (revert/mutation) — because the
  entire point of TDD-in-sim is that net.

### Attribution rule (Axis 2/3) — trinary, frozen

A GPT-specific gap (present in GPT's arm, absent in Claude's) is attributed to exactly one of:
1. **Task difficulty** — *only if* the Claude arm hit the **same finding category with the
   same root cause** (not merely the same file). Then it is not a portability signal.
2. **Model/harness capability** — a genuine capability gap → weighs on the verdict.
3. **Missing pipeline layer** (the absent advisor, no Orchestrator pre-resolution) — a gap a
   Claude coder would also have made **without** its pipeline scaffolding → lands in
   **CONDITIONAL** (add the layer / guardrail), not a capability verdict.

A gap present in **both** arms is task difficulty by definition and does not count against GPT.

### Granularity symmetry

The Claude arm accrues three careful per-PR reviews *during production*; GPT's whole-#100 is
read as one diff. For the comparison, **both are scored at the whole-#100 aggregate** — the
per-PR Claude reviews inform its own scorecard rows but the head-to-head sums each arm to one
#100-level finding set, so GPT is not penalized for being read as a blob.

## Decision rule (frozen)

Primary axis of the verdict is the **absolute merge bar** (objective, harness-agnostic); the
head-to-head is **context**, weighted lower because it is n=1 and confounded by role / absent
advisor / ordering.

- **DELEGATE-VIABLE** ⇔ GPT clears the absolute merge bar (all gates green on independent
  re-run here; wave check yields zero blocking findings, or blocking findings fully resolvable
  in ≤2 fix-loop rounds) **∧** zero hard-law breach **∧** conformance ≥ threshold **∧** any
  output-quality gaps are *shared with the Claude arm* (task difficulty per the attribution
  rule).
- **CONDITIONAL / delegate-with-guardrails** ⇔ clears the merge bar, but with GPT-specific
  gaps that are **process-addable** (missing selfcheck, weaker-but-not-dishonest tests, missed
  spec-drift sync, poor decomposition, or a missing-pipeline-layer gap).
- **NO-GO** ⇔ a hard-law breach **∨** a GPT-specific correctness escape the wave check flags
  major **∨** a failure class no gate would have caught before `main`.

### Verdict inference asymmetry (n=1) — frozen

One paired run **falsifies strongly, confirms weakly.** A hard-law breach or a correctness
escape is **dispositive** — it *did* fail, and NO-GO from n=1 is trustworthy. A clean pass is
**not** evidence of reliability — it failed to fail *once*. Therefore **DELEGATE-VIABLE from
this single run is provisional-pending-more-n**, not a standing green light; it licenses
continuing to #101/#102 under observation, not unattended delegation. The owner's "strong
assessment" is honored in the **falsification** direction, where the power actually is.

## Threats to validity (named before results)

1. **Bundle confound (intentional):** role (solo vs pipeline) + harness + model move together;
   a quality gap is not attributable to the model alone. We cast the bundle, not the model.
2. **n = 1**, single task shape (#100: sim + save migration + Ledger) — a datapoint; the
   relative head-to-head is the weakest-powered part.
3. **Ordering confound:** GPT-first means the Orchestrator sees GPT's work before running the
   Claude arm and the wave check. **Mitigation (binding):** the Claude package is frozen above
   *now*; the wave-check rubric is frozen above *now*; both are pre-registered, so neither can
   be shaped around GPT's stumbles.
4. **Same-vendor reviewer:** the ruler is Opus (Anthropic) judging a cross-vendor comparison
   — possible pro-Claude bias. Mitigation: absolute-bar-first, `file:line` on every finding,
   owner spot-audit of GPT-arm findings. Residual risk acknowledged.
5. **Cost is non-comparable** across vendors (different meters); reported as an estimate,
   never ranked on.
6. **Advisor layer absent** from GPT's bundle — a real property of the bundle, recorded as
   such, not charged against GPT (a missing-pipeline-layer gap lands in CONDITIONAL).

## Protocol checklist (execution order)

1. Freeze this document (rubric + decision rule + Claude package) — **done at write time.**
2. Hand GPT: the repo at `main @ d5bac94`, the raw #100 issue (operative AC = newest comment).
   GPT reads the repo docs itself (the portability test). GPT returns a branch at the baseline.
3. Independent gate re-run here on GPT's branch; Opus wave check → Axis 1–5, findings
   `file:line`-cited, recorded against the absolute bar **before** the Claude arm exists.
4. Dispatch the Claude arm (Sonnet coder, 100a→100b→100c, Opus wave check per PR) from the
   same baseline, fresh package (no GPT content).
5. Aggregate the Claude arm to whole-#100; head-to-head at whole-#100 level (§Granularity).
6. Apply the decision rule; owner spot-audits GPT-arm findings; file any incident.
7. Merge the winner as #100; quarantine the loser. Record the verdict below, calibrated to the
   n=1 asymmetry. Append a scorecard row per PR (GPT rows marked *solo-driver unit*, advisor
   column N/A).

═══════════════════════════════════ RESULTS (append below; never edit the frozen section) ═══════════════════════════════════

_Pending — GPT arm not yet run._
