# HANDOFF — exportable session-state snapshot

**Updated only when the owner asks** (ceremony decision, 2026-07-16). The date below
is the freshness marker: when it looks stale, trust `git log` and `gh issue list`
over this file. Written for any model in any harness; Claude Code's per-machine
auto-memory is the day-to-day working channel and may be ahead of this snapshot.
Keep it one screen: state → queue → watch. Standing gotchas live in `CLAUDE.md`
(§Git & worktrees), `docs/agent-memory.md`, and `docs/incidents/README.md` §Log —
not here.

_Last update: 2026-07-19 s12 (owner-requested; a design-only session — the E13 grill
escalated into a new sub-epic, zero production code shipped, deliberately)._

## Design sessions are the work (owner framing, 2026-07-19)

Extending §Running-in below. The owner's ruling after a session with no code in it:
**coders write code — our job is organizing and designing whole processes.** Better to
spend several sessions writing nothing than to work *po łebkach* and ship code already
doomed to refactor or outright rejection. Do not treat a code-free session as a loss;
treat a spec built on an outgrown model as one.

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
- s11 and s12 datapoint: **Opus drove both** — a full implementation wave (s11) and a full
  design session with an Engineer subagent pass (s12) — without frontier involvement.

## State

- **main @ f6d33f0**, clean, pushed, postmerge CLEAN (single worktree).
- **E13 is blocked.** The E13 grill (2026-07-19) opened on two agenda items and closed with
  a new sub-epic. Reading the spec against the code showed the site-registry decision locked
  the previous day guarded the wrong shape, and its E15 trigger rested on a premise the E15
  spec contradicts. **Reopened at the owner's request and replaced.**
- **[ADR-0008](adr/0008-one-goods-store.md) landed**: every place goods can sit is one
  encapsulated **Goods store** (PL: miejsce na towary) with a derived policy and one
  **Transfer** primitive. Contents opaque behind three accessors; per-lot receipt time
  deliberately not built. Professor **F4 and F7 are both closed** by it — addressing becomes
  constitutive rather than conventional, so the `deliver` priority chain gets *deleted*.
- **New sub-epic E13.0 — One Goods store**, spec **approved**, milestone #13, cut into
  **#306** (golden-run digest + phase-order snapshot — the cover) → **#307** (`GoodsStore` +
  Transfer, migrate the four stores, sim+ui, tier 3). Docs slice shipped as PR #305 rather
  than as its own issue.
- **E13.0 is a behavior-preserving refactor** — zero new gameplay. Addressing lands in E13,
  not here. `market↔hold` unification and the store's direction rules deferred (no consumer).
- **#100's AC amended a third time** (newest comment supersedes everything before it): the
  site-registry criteria are **withdrawn in full**; it gains `GoodsStore`, the
  `StorePolicy` variant, explicit addressing and the `commissionGuildBuilding` rename.
- **#304 rewritten, milestone cleared.** Its trigger was void; the netWorth half is closed by
  E13.0. Remaining debt = the four *loud* enumerations. New trigger: the **M5 grill**, where
  the Great Work may be a genuine fourth singleton.
- Still open from s11: **#302**, **#303** (cheap tails, batchable into any wave).

## Queue (owner-agreed order)

1. **Docs-vs-docs sweep** — owner's call for the next session's opener. Neither of s12's two
   decisive findings was catchable by any gate: both were documents contradicting each other
   (a trigger naming another epic's spec; a chain recipe colliding with a building's goods
   filter). Sweep the rest of the design surface the same way before building on it.
2. **#306 → #307** (E13.0). Strict order: the digest must merge and be green **before** any
   store code changes.
3. **E13 grill, short** — one item left, **OQ8**: does the Storehouse's value join
   `siteStoreValue` or get its own `NetWorthBreakdown` field? The latter changes the
   `netWorth` Ledger event shape. Decide before #100 starts.
4. **E13 implementation:** #100 → #101 → #102 (#100 should be visibly smaller now — measure).
5. Cheap tails: **#302**, **#303**.
6. Then **E11 v1** (#232→#234) → **E15** (#281→#284; its spec now depends on E13.0 + E13).

## Watch items

- **Two process rules proposed in the s12 retro, not yet written into WORKFLOW.** (a) The
  **spec-vs-code skim** as a standing first step of any epic's implementation phase — it has
  now paid off twice (`e3-spec-refresh-grill-2026-07-14`, and s12's entire outcome). (b) When
  a decision names a re-evaluation **trigger living in another epic**, verify it against that
  epic's spec in the same commit — #304's void trigger would never have been written.
- **Reversed decisions vs the HANDOFF update rule.** This file went actively misleading
  within one session (it described the reversed site-registry lock as binding). Proposal on
  the table: full refresh stays owner-request, but a *reversed* decision gets a one-line
  strike-through immediately.
- **`design-notes` LIVE→HIST flips.** The index now marks the Professor construction review
  as LIVE only for F5/F6. Check in a few sessions whether rows actually get flipped.
- **Parked-in-a-lot-with-no-exit.** Four `grill-brief-m4/m5/m6-*` scenarios awaiting grills,
  `route-conditionals`, `e8-followups`. None have issues. Sweep when planning M4.
- **Grill format** (owner, s12 retro): a turn may pair analysis with a question, but on **one
  thread only**. Four threads in a turn overloads the owner and degrades the answers.
- **Incident 0018 amended** (s12): `git ls-remote origin` does **not** verify push identity —
  it is a read, and the other account has read access, so it passes under the wrong token.
  Verify with a write, or expect a 403 at push time.
- Refit status violet `#a373d6` vs mining `#7e55ab` proximity — eyeball at playtest.
- Recurring e2e smell: `dispatchEvent` standing in for real interaction.
- ~~**Machine handoff: s12 was the last session on the brother's PC** (Kacper). From s13 the
  owner is back on their own machine — the `gh` switch dance no longer applies.~~
  **Falsified 2026-07-19 (s13):** s13 ran on Kacper's PC too, and the dance applied in full —
  `gh auth switch` to `reteter` at open, `Darecik` at close, global `.gitconfig` verified free
  of `credential.*`. **Struck, not refreshed** (WORKFLOW §Documentation law): a prediction
  about a future session had been recorded as settled state, and this file went misleading
  within one session for the second time running (sweep F2). Do not trust a machine-handoff
  claim until the session actually opens elsewhere. Bootstrap notes for any *new* machine
  (fresh clone, `npm install`, `gh auth login`, no `scripts/setup.ps1` yet — #239) still stand.
