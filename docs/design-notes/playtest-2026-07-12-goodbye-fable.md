# Playtest 2026-07-12 — seed `playtest-goodbye-fable` (Ledger + Fleet list verification)

Owner playtest of the shipped Ledger (#114 sim, #117 overlay) and Fleet list (#118) on the
post-E9-sim build (81b43c7). Screenshots: `tmp/ss/playtest-goobye-fable_1..3.png` (Day 13
and Day 22 states). Terms per [CONTEXT.md](../../CONTEXT.md); process per
[WORKFLOW.md](../WORKFLOW.md).

Scope caveat: E9's Headquarters/routes sim (#81, closed) has **no UI yet** (#84/#85 open),
so founding, construction and Route assignment were not exercisable this session. The
playtest exercised the manual E8 trade loop plus the new observability layer.

---

## Verified in play ✅

1. **Ledger overlay** — Transactions tab lists the full event stream (trades, docking
   fees) with the per-ship filter working (Aether Wing) and income/expense coloring;
   Wartość firmy tab charts the daily net-worth snapshots with the current value readout
   (₸5,129 at Day 22). Matches the E9 spec's Ledger section.
2. **Fleet list** — ship display name ("Aether Wing"), one-word status with location
   ("Docked at Saltmere"), hold readout (50/50); replaces the Controlled Ship header
   as specced.
3. **Feel** — owner reports the familiar *"chcę jeszcze"* pull is back. The Ledger
   makes results legible: the value chart's big step is immediately traceable to its
   transaction (see below).

## Analyst read of the screenshots

- **The observability loop closes**: the chart's Day 20 step reads directly against the
  Transactions tab — bought 50 Aether Salt at Kruxhaven for ₸1,559 (Day 17), sold at
  Brassmoor for ₸4,468 (Day 20), ~2.9× on the expensive good. Exactly the
  observe-and-orchestrate legibility the E9 grill asked of the performance board.
- **Grain loop still the early ramp**: Saltmere → Kruxhaven hauls net ~₸850–950 per
  50-hold run (buy ₸334–359, sell ₸1,182–1,291), consistent with the E8-verified pace.
- **Docking fees land as designed**: ₸8 (Saltmere) to ₸20 (Brassmoor), differentiated
  per archetype, felt but not punitive at current margins.
- Company value ₸500 → ₸5,129 by Day 22 of natural play.

## Defects & polish (filed)

| # | Item | Home |
|---|------|------|
| 1 | Port market panel: `Buy max`/`Sell max` 3-line-per-good layout — **re-reported independently**, second playtest in a row | [#73](https://github.com/reteter/etersim/issues/73) (comment added) |

No new defects: no route/idle-state observations were possible (no route UI yet — see
scope caveat), and the economy observations above are all within already-verified E8/E9
behavior.

---

*(Session 2026-07-12. Fresh-clone machine; deps installed and `.claude/launch.json`
added locally as session setup.)*
