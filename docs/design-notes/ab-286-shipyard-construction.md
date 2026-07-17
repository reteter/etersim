# A/B experiment: #286 implemented independently by Opus and Sonnet (2026-07-17)

The first same-task paired trial in this repo's coder-model evaluation. One issue
(#286: Shipyard constructed via ConstructionSite, not bought instantly — tier 3,
`src/sim`, save-shape decision, spec counter-erratum in the same task), one task
package, one baseline (`main @ 1808706`), two coders dispatched cold in isolated
worktrees. Owner context: subscription billing makes **% of a session limit** the
canonical cost metric (Opus tokens weigh ~2× Sonnet's per Anthropic).

## Protocol

- **Arm A (Opus):** dispatched first; delivered branch `feat/286-shipyard-construction`
  @ 02d4699, PR #288.
- **Arm B (Sonnet):** dispatched after A finished, before A merged (frozen baseline);
  same package verbatim except the delivery clause — branch `eval/286-sonnet-shipyard`
  @ 792fd73, **no PR, no `Closes`** (eval-only by protocol).
- Per-arm review: two-subagent `/code-review` fan-out, both reviewer subagents on
  Opus. Arm A's fan-out was an orchestrator process error (incident 0016 — the tier-3
  gate specifies ONE two-axis subagent); the owner then deliberately kept the identical
  shape for arm B so the arms faced the same reviewers.
- Comparative pass: one Opus analyst over both diffs + both review verdicts.

## Results

| | Arm A (Opus) | Arm B (Sonnet) |
| --- | --- | --- |
| Hard violations | 0 | 0 |
| AC coverage | 8/8 | 8/8 |
| Judgement findings | 3 | 3 |
| New behaviors tested | ~14 (tighter assertions) | ~20 (broader: migration suite, shipyard-site deliver fall-through) |
| SAVE_VERSION call | no bump — **deviates from ADR-0007's written precedent** | bump 12→13, identity migration, incident-0009 e2e diligence (26/26) |
| Code cleanliness | edge: guard-clause deliver, DRY `hasActiveBuildOrder` | non-null-assertion regression, 3× deliver duplication |
| TDD | third self-reported order deviation (mutation-verified fix) | clean |
| Cost | ~30% session limit (169k tokens, advisor ×2) | **~21% session limit** (254k tokens, advisor ×1) |

**Outcome (owner-ratified):** merge B — #289; #288 closed unmerged; A's portable
strengths filed as #290. The tiebreak: of all divergence axes, only SAVE_VERSION has
a *written* repo answer (ADR-0007: bump for an additive absent-safe field, "version
tracks World shape" stays honest), and the cheaper arm got it right. Everything else
was both-defensible. n=1 — a datapoint, not a ruling.

## Threats to validity

1. **Evaluation awareness (both arms, asymmetric evidence).** Arm B explicitly
   inferred the A/B setup ("this is exactly the A/B eval…") from three leaks: the
   `eval/…` branch name, the phrase "evaluation run" in its package, and the
   memory/CLAUDE context available to coders. Arm A had the same ambient context but
   no eval-flavored branch name and never verbalized awareness. Hawthorne effects
   mostly raise diligence — which is part of what we measure — but the arms were not
   blind.
2. **Reference solution reachable by arm B.** Arm A's branch was pushed to origin and
   its worktree stood in-tree during B's run; the Bash sandbox is asymmetric
   (incident 0012). Mitigation after the fact: a forced disclosure (self-report from
   transcript — the harness transcript file was empty, 0 bytes) listing every touch:
   B saw **metadata only** (worktree list line, commit subject = issue title, SHA);
   corroborated by full structural divergence (field/command/helper names, event
   design, versioning, 3-of-5 recipe rows differ — a copier copies all five).
3. **n=1, nondeterministic agents.** A rerun could flip individual axes.
4. **Review symmetry is approximate.** Same reviewer model and shape, but arm B's
   reviewers were told not to look at the sibling branch (didn't exist during A's
   review), and neither arm's reviewers were handed ADR-0007 — both missed the
   save-versioning precedent; the comparative pass found it. Fixed in WORKFLOW: the
   review package now names all ADRs + incidents §Log explicitly.

## Protocol lessons for the next paired run

- Neutral branch names (`feat/286-b`), no "evaluation" wording in the package.
- Don't push the reference arm to origin until both arms finish; remove the
  reference worktree before dispatching the second arm.
- Capture cost as limit-% timestamps at dispatch and completion (owner-side reads
  worked well: A 69→100%, B 23→44%).
- The disclosure-audit prompt (exhaustive command list, "metadata counts as seeing
  something") is reusable and cheap — run it whenever isolation wasn't airtight.
- An agent noticing the eval is itself data: treat situational awareness as a
  constant of the fleet, not a surprise (arm B was the *cheap-tier* model).
