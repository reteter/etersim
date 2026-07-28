# HANDOFF — orientation for the next session

Rewritten by the session-driving model at both session boundaries, ~15 lines, admitting
nothing `git log` or `gh issue list` already answers. Full contract:
[workflows/session.md](workflows/session.md). Previous versions: `git log -p docs/HANDOFF.md`.

_Rewritten 2026-07-28, s29 close._

## State

E16 Workbench is in flight; **#393 is its last fan-out item** and its gate cleared when #419
merged. Outside E16 the owner-agreed order stands: **E11 v1** (#232 → #233 → #234), then
**E15**. s29 spent itself on the process docs, not on code.

## For the next session

- **Two specs will mislead a coder before they mislead you.** E11's §Ledger schema no longer
  matches `src/sim/ledger.ts`, and #233 says "emit JSONL per spec" — refresh it **before
  #232**. E15's spec bumps `SAVE_VERSION` to v14, which E13 consumed; OQ8 settled v15, so as
  written it instructs a broken migration. Both are flagged in `docs/specs/README.md`.
- **Owner call pending:** `docs/owner-framings-PARKED.md` holds three owner framings with no
  permanent home, plus seven watch items still unsorted into promise / issue / observation.
- **Owner call pending since s12:** make the spec-vs-code skim a standing first step of an
  epic's implementation phase. It has paid off twice and is still only a proposal.
- **Bet to settle at E13 close:** did #100 visibly shrink? If not, "running-in" was a feeling
  rather than a thesis.
