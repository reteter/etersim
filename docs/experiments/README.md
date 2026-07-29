# Experiments

Systematic characterization of the economy and game mechanics via Batch runs.

## Convention

Each experiment is a **dated file** in this directory, named in the form `YYYY-MM-DD-<slug>.md`
(e.g., `2026-07-29-w1-price-variance.md`).
Every file records:

- **Question**: the experimental hypothesis or property being checked.
- **Batches run**: which policies, seeds, and days each Batch covered.
- **Findings**: what the data shows (e.g., median values, distributions, anomalies).
- **Conclusion**: what this tells us about the game state.

Experiments live alongside code and are committed together with their implementation (e.g., an
invariant assertion that validates an experiment's hypothesis lands in the same PR as the
experiment's README entry).
An experiment proves a property or catches a regression;
it is *not* a design decision —
design decisions stay in `docs/specs/`, grill notes in `docs/design-notes/`, and the outcome of a
playtest-triggered analysis in an Analyst's findings (if replayed, a note links to it).

## Bug-hunt mode

When an assertion lands or a hypothesis is under pressure, run a Batch with a **perverse policy** —
one designed to violate a known invariant or stress-test a boundary —
plus `--enable-assertions` to exercise the checking logic itself.

Worked example: `harness/policies/greedyContractor.ts` enrolls in every guild it hasn't joined and
spams `acceptContract` for every open offer, every tick, regardless of rank-gating or whether the
fleet can actually deliver — the kind of enroll/accept churn a well-behaved reference policy
(`gradientLoop`/`doNothing`) never generates, aimed at the guild/contract invariants
(`harness/invariants.ts`: the desperation clause, the offer cap, offer-ID uniqueness, haulability).

```bash
npm run harness -- run --policy greedyContractor --seeds 1,2,3,7,42 --days 100 --enable-assertions --out ./report-bug-hunt
```

Run against those seeds/days on 2026-07-29: **zero anomalies** across all 5 seeds. This means
either the guild/contract invariants held under this policy's pressure, or `greedyContractor` isn't
perverse enough yet to trip them — reported plainly as a real, honest result, not as proof the
invariants are bulletproof (incident 0020: never treat an unverified/undiscriminating result as
the finding).

The resulting report will have an `anomalies` section if the policy successfully triggers a
violation;
an empty list means the assertions are working (the policy didn't break the invariant) or the policy
isn't perverse enough.
Commit the adversarial policy and a summary of what the bug-hunt validated —
so a regression is catchable next time without re-inventing the probe.

## See also

- `docs/specs/E11-proving-grounds.md` — Portfolio note, how Batch reports are read.
- `harness/batch.ts` — the Batch runner.
- `harness/cli.ts` — CLI flags for run control and reporting.
