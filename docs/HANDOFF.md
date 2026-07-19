# HANDOFF — exportable session-state snapshot

**Updated only when the owner asks** (ceremony decision, 2026-07-16). The date below
is the freshness marker: when it looks stale, trust `git log` and `gh issue list`
over this file. Written for any model in any harness; Claude Code's per-machine
auto-memory is the day-to-day working channel and may be ahead of this snapshot.
Keep it one screen: state → queue → watch. Standing gotchas live in `CLAUDE.md`
(§Git & worktrees), `docs/agent-memory.md`, and `docs/incidents/README.md` §Log —
not here.

_Last update: 2026-07-19 s14 (owner-requested, mid-session). s13 and s14 were both
design-surface sessions: the docs-vs-docs sweep, no production code but one
behaviour-preserving rename._

## Design sessions are the work (owner framing, 2026-07-19)

The owner's ruling after a session with no code in it: **coders write code — our job is
organizing and designing whole processes.** Better to spend several sessions writing
nothing than to work *po łebkach* and ship code already doomed to refactor. Do not treat
a code-free session as a loss; treat a spec built on an outgrown model as one.

The unfalsified half of this bet: E13.0 is supposed to make #100 *smaller*. **Measure it
at E13 close** — if #100 did not visibly shrink, the running-in framing is a feeling
rather than a thesis.

## Running-in, not sanding down (owner framing, 2026-07-19)

We are **breaking the process in with fresh oil, not sandpaper.** Instructions should be
clear, consistent, and **not collide with the driving model's trained nature** — where a
rule fights the model's grain, the rule gets reshaped, not the model. The owner runs an
extended retro at session end and ranks process tension alongside shipped code.

## Model access

- **Fable left paid plans 2026-07-19, 11:59 pm PT.** No extension materialized. It now
  runs only on prepaid credits ($10/M in, $50/M out); Anthropic says it aims to restore it
  to subscriptions "once capacity allows" — worth a re-check, but stop treating it as
  imminent.
- **Fallback driver: the owner's OpenAI subscription includes frontier-model access.**
  This file, `docs/PROCESS.md` and `docs/WORKFLOW.md` are model-agnostic on purpose. For a
  non-Anthropic driver: the casting ladder names Anthropic tiers (frontier/strong/cheap =
  Fable/Opus/Sonnet) — translate tiers to the available pool; the *shape* (frontier
  orchestrates and grills, strong reviews, cheap codes pre-resolved packages) is durable.
- s11–s14 datapoint: **Opus drove all four** — an implementation wave, a design session,
  and two sweep sessions — without frontier involvement.

## State

- **main @ 1d12850**, clean, single worktree; 611 tests / typecheck / lint green. Everything
  below is merged.
- **Closing additions after this file's own refresh** (#329), listed because the line above
  went stale within the same session: `design-notes/knowing-is-not-binding-2026-07-19.md`
  (#330) — the standing principle that **a system acts on what obliges it, not on what it
  knows**, drawn from three s14 failures where the correct knowledge was already written down
  and changed nothing. Plus **#331** (HANDOFF tsunami — *and first, are this file's
  foundations right at all?*, since §State and §Queue duplicate `git log` / `gh issue list`
  while §Watch and the owner framings are held by nothing else), **#332** (detectors for the
  sweep's four laws — three landed in s14, propagation in s13 — **none of them automated**),
  and **incident 0021** (a second task's files
  edited onto the previous PR's branch; SELFCHECK §5 now says pushing a PR ends the task).
- **The design-surface sweep is the through-line of s13+s14.** Pass A (referential
  integrity) **complete**; Pass B (subject adjudication) **1 of 7 rows** done — Trade &
  economy, verified clean against `src/sim`. Findings F1–F14, all resolved except **F14**,
  open for an owner call. `design-notes/design-surface-sweep.md` **is the resumable state** —
  take the topmost pending row in its Order column.
- **Four rules came out of it, each with a detector rather than good intentions:**
  - *decisions propagate at the moment they change* (#313) — walk the citations the edited
    document already carries; the commit names what you checked, unstated means unchecked;
  - *counts are anchored before they are trusted* (#315, incident 0020);
  - *behavior-preserving exemption* — a pure `src/sim` rename drops to tier 1, but only while
    the suite passes with no assertion changed (#317);
  - *a trigger is a promise, and promises live in the issue tracker* (#327) — a note may hold
    the reasoning, never the only record of an obligation; the detector is greppable.
- **[ADR-0009](adr/0009-no-direct-combat.md)** (#328) — no direct combat at any lens
  level, with its operative boundary (piracy only as an abstract voyage hazard) and a
  four-condition reversal path. It corrects a citation that was **false from the foundation
  commit**: the PRD credited ADR-0004 for 3D and combat, which that ADR has never contained.
- **`CONTEXT.md` gained `Elasticity` and `Storability`** (#317). `elasticity` had been
  carrying two opposite meanings in live text; flows keep the name, the price-from-stock
  exponent became `PRICE_CURVE_EXPONENT`.
- **Two new LIVE notes:** `design-surface-sweep`, and `world-model-implications` — the W1–W10
  register of statements that must hold if this world is what we say it is. Its finding:
  **structure is guarded, dynamics are not**, and it is the assertion content E11 lacks.
- **Incidents 0019 and 0020 filed** — the same defect twice: a report that did not measure
  what it claimed.
- **37 open issues**, eight opened in s14 (#319–#326).

**E13 / E13.0 are exactly as s12 left them — nothing in s13 or s14 touched them:**

- **[ADR-0008](adr/0008-one-goods-store.md)**: every place goods can sit is one encapsulated
  **Goods store** with a derived policy and one **Transfer** primitive. Professor F4 and F7
  both closed by it; the `deliver` priority chain gets *deleted*.
- **E13.0 — One Goods store**, spec approved, cut into **#306** (golden-run digest — the
  cover) → **#307** (`GoodsStore` + Transfer, migrate four stores). Behavior-preserving:
  zero new gameplay; addressing lands in E13.
- **#100's AC amended a third time** (newest comment supersedes): site-registry criteria
  withdrawn in full; it gains `GoodsStore`, `StorePolicy`, explicit addressing and the
  `commissionGuildBuilding` rename.
- **#304** rewritten, milestone cleared; remaining debt = the four *loud* enumerations, new
  trigger the **M5 grill**. **#302**, **#303** still open cheap tails.

## Queue (owner-agreed order)

Statuses verified at the s14 refresh; the *order* is the standing owner agreement, not a
re-planning.

1. **Docs-vs-docs sweep — in progress, no longer the unstarted opener.** Pass A closed,
   Pass B row 1 of 7 closed, F14 open. **Whether it continues before E13.0 is an owner
   call** — it has already returned four process rules and an ADR, and it has six Pass B
   rows left.
2. **#306 → #307** (E13.0). Strict order: the digest must merge and be green **before** any
   store code changes.
3. **E13 grill, short** — one item left, **OQ8**: does the Storehouse's value join
   `siteStoreValue` or get its own `NetWorthBreakdown` field? The latter changes the
   `netWorth` Ledger event shape. Verified still open (`E13.0-goods-store.md:298`,
   `E13-guild-buildings.md:143`). Decide before #100 starts.
4. **E13 implementation:** #100 → #101 → #102 (#100 should be visibly smaller now — measure).
5. Cheap tails: **#302**, **#303**.
6. Then **E11 v1** (#232→#234) → **E15** (#281→#284; its spec depends on E13.0 + E13).

Not in the numbered queue, filed and waiting: **#309** (index `docs/specs`, sweep F7's second
half), **#319–#322** (Professor findings unparked in s14), **#324–#326** (the world-model
register's checks and the pre-law parking audit).

## Watch items

- **Spec-vs-code skim still not written into WORKFLOW.** Proposed in the s12 retro as a
  standing first step of any epic's implementation phase; it has now paid off twice
  (`e3-spec-refresh-grill-2026-07-14`, and s12's entire outcome). Verified s14: it exists
  only in this file and in note prose. *The sibling proposal from that retro — verify a
  trigger against the other epic's spec — landed as the propagation law (#313).*
- **The strike-through proposal landed.** "A falsified line is struck immediately" is now a
  corollary in `WORKFLOW.md` §Documentation law, and a strike is explicitly **not** a
  refresh — so this file can be corrected without touching its owner-request rule.
- **`design-notes` LIVE→HIST flips: the answer came in, and it was no.** Sweep F5 found
  three findings parked in a HIST note whose triggers had all fired unnoticed for five days,
  one of them a file that grew 23% while waiting. Now governed by the trigger-is-a-promise
  law, whose detector is greppable: every unpark trigger names an issue.
- **Parked-in-a-lot-with-no-exit** — four `grill-brief-m4/m5/m6-*` scenarios,
  `route-conditionals`, `e8-followups`; still none have issues. **Now owned by #326**, which
  also has to decide the question this line never asked: whether a permanently-LIVE grill
  brief needs an issue at all.
- **Grill format** (owner, s12 retro): a turn may pair analysis with a question, but on **one
  thread only**. Four threads in a turn overloads the owner and degrades the answers.
- **Incident 0018 amended** (s12): `git ls-remote origin` does **not** verify push identity —
  it is a read, and the other account has read access, so it passes under the wrong token.
  Verify with a write, or expect a 403 at push time. s14 hit this three times; the per-push
  override in `CLAUDE.md` §Git cleared it each time.
- **Never read a count from the tail of a pipeline** (incident 0020). `grep -i` with `-F`
  aborts on this machine (exit 134) and `wc` counts the empty output as `0`, so a crash was
  recorded as a data point — 26% of the corpus seen, ten fabricated findings. What caught it
  was a domain check, not a technical signal.
- Refit status violet `#a373d6` vs mining `#7e55ab` proximity — eyeball at playtest.
- Recurring e2e smell: `dispatchEvent` standing in for real interaction.
- ~~**Machine handoff: s12 was the last session on the brother's PC** (Kacper). From s13 the
  owner is back on their own machine — the `gh` switch dance no longer applies.~~
  **Falsified 2026-07-19 (s13):** s13 ran on Kacper's PC, and so did s14 — the dance applied
  in full both times (`gh auth switch` to `reteter` at open, `Darecik` at close, global
  `.gitconfig` verified free of `credential.*`). **Struck, not refreshed** (WORKFLOW
  §Documentation law): a prediction about a future session had been recorded as settled
  state. Do not trust a machine-handoff claim until the session actually opens elsewhere.
  Bootstrap notes for any *new* machine (fresh clone, `npm install`, `gh auth login`, no
  `scripts/setup.ps1` yet — #239) still stand.
