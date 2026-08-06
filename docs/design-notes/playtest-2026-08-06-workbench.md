# Playtest 2026-08-06 — the Workbench field run

**Status: raw.** Owner playtest against `main@40dceaf`, run overnight 2026-08-05/06 —
the general playtest [#440](https://github.com/reteter/etersim/issues/440) that gated E11 v1's close
and, behind it, the [#448](https://github.com/reteter/etersim/issues/448) grill and the first E15
dispatch.
Screenshots:
`tmp/ss/playtest-lastone-1.png` … `-4.png`.

Every causal claim below is checked against the code (`docs/personas/ANALYST.md` §The verification
law).
Item 2 additionally carries a **reproduction**, written and run during triage and then deleted —
it is named per-item, not implied.

## The session

Owner's own summary, verbatim in intent:
play for "kilkanaście minut";
strategy —
earn fast toward a full hold of timber, run several timber selling trips, Shipyard → Refit, then a
timber Route.
End state read off screenshots 3 and 4: **Day 743, 17:00**,
purse **₸228 641**, two ships (`Aether Wing` 50/100 on Trasa 1, `Lumen Trader` 0/100), Konsorcjum
Żywodrzewu at rank 2 (7/10 pkt), one saved Route of five Stops reporting `Kurs: 366t/pętla`,
`Opłaty dokowe/pętla: 53`, `Ostatnia pętla: +₸12074`.

Four defects were reported.
Two more are the analyst's own, found in the screenshots and flagged as such.

---

## 1. The right infobar's good name overlaps the price next to it

**Seen** (owner: "w prawym infobarze tekst nachodzi na siebie"):
screenshot 1 —
`Tekstylia`, `Sól eteryczna`, `Elektronika` and `Drewno` each collide with the SPRZEDAŻ value beside
them;
`Zboże`, the shortest name, does not.
Screenshot 4 shows the same collision in the live panel (`Tekstylia`/`₸73`).

**Root cause.** The market table's column list is one custom property,
`--market-columns: minmax(0, 1fr) 2.75rem 4rem 4rem 3.5rem` (`src/index.css:612`) — **five**
tracks, deliberately shared by the header and every row so the two can't drift
(`src/index.css:604-610`, the #75 desync guard).
Since #468 D2 removed the price trend, both grids render **four** children:
`.market__header` four `<span>`s (`src/ui/PortPanel.tsx:995-1000`) and `.market-row__head` name /
bid / ask / stock (`src/ui/PortPanel.tsx:298-315`).
Grid auto-placement fills tracks 1–4, so:

- the **last track is dead** — 3.5rem plus its gap, reserved and never filled;
- the bid value lands in the **2.75rem track that was sized for a trend glyph**, not for a
  thaler quote, and is `text-align: right` (`src/index.css:627-633`) — so it sits hard against
  the name;
- the name track is `minmax(0, 1fr)`, whose **0 minimum is the point** (it is what stops a
  long name blowing the grid wider than the header), and `.market-row__name`
  (`src/index.css:647-651`) sets no `overflow`/`text-overflow`. A name wider than its track
  therefore paints over its neighbour instead of pushing it.

The rules for the removed cell also survive:
`.market-row__trend` in the shared `text-align` list (`src/index.css:628`) and
`.market-row__trend--up/down/flat` (`src/index.css:691-701`).

Not already owned:
#469 §E lists D2's dead CSS, but only the board-side `.price-board__*` rules —
the PortPanel's column list is not on it, and #470 covers `priceSnapshots`, not this.

**Classification: presentational.**

**Direction candidates** —
(a) drop the dead track and re-measure the remaining four against the real panel width;
(b) give `.market-row__name` overflow containment so a long name truncates rather than overlapping;
(c) both —
(a) buys the room, (b) makes the failure mode graceful when the panel is narrow anyway.
The pixel budget is for the fix to measure;
the structural mismatch above is what is established here.

---

## 2. Auto-max quantity is dead for any row that first rendered undocked

**Seen** (owner: "nadal nie działa auto maxowanie ilości kup/sprzedaj w porcie"):
screenshot 4 —
`Zboże` sits at qty **1** while its own hint reads "Zostało tylko 100 miejsca w ładowni";
`Tekstylia` in the same panel sits at 52 with "W zapasie tylko 52".

**Root cause.** `MarketRow` seeds the quantity with a **lazy `useState` initialiser**,
`useState(() => (maxQty > 0 ? maxQty : 1))` (`src/ui/PortPanel.tsx:278`) —
#73's "qty defaults to the current max" call.
A lazy initialiser runs **once per mount**, and nothing here ever remounts the row:
`PortPanel` is rendered from `src/App.tsx:25` with no `key`, and each `MarketRow`'s key is the good
id (`src/ui/PortPanel.tsx:1002`), so neither selecting a different port nor the ship arriving swaps
the element.
So a row that first renders while the ship is elsewhere gets `trading === false` → `maxQty === 0` → **qty 1, permanently**.
In the other direction `clampQty` (`src/ui/PortPanel.tsx:272`) only ever clamps *down*, which is why
`Tekstylia` shows 52:
a larger stale quantity trimmed to the current cap, never a quantity raised to it.

**Reproduction (run during triage, then deleted).** A temporary RTL test mounted `PortPanel` for
port A while the ship was docked at port B, then docked the ship at A and re-rendered.
Result, printed by the test:
`qty="1" capHint="Zostało tylko 50 miejsca w ładowni"` —
the screenshot's exact shape.
This is verified, not inferred.

**Why "nadal".** [#375](https://github.com/reteter/etersim/issues/375) (owner playtest 2026-07-21)
reported this same symptom and was closed as a **hint-phrasing** bug;
its analysis stated "Qty **does** auto-max", which is true only for a row that mounts already docked
—
the case it examined.
`src/ui/buyCap.ts:29-38` still carries that reasoning.
The initialiser was never touched, so the owner is reporting the same defect a second time against a
fix that addressed its wording.

Existing coverage cannot catch it:
`e2e/market.spec.ts:179` opens the market at the home port with the ship already docked there, i.e.
exactly the mounting order that works.

**Classification: mechanical** (UI state), presenting as a broken affordance.

**Direction candidates** —
(a) derive the displayed quantity rather than storing it, keeping state only for a player-entered
override;
(b) re-seed on the `maxQty` 0 → positive edge;
(c) key the row on `(portId, good)` so a port change remounts it —
cheapest, but it also throws away a deliberately-typed quantity on every port switch.
Whichever lands, the regression test is the docking transition, not the docked steady state.

---

## 3a. A settled Contract is indistinguishable from a reset one

**Seen** (owner: "jest bug z finalizacją kontraktów — po wykonaniu zamiast rozliczyć resetują się").

**Root cause — the settlement is real; its evidence is nowhere the player is sent.** `settleOne`
credits `feePerPeriod`, adds `POINTS_SETTLED`, and appends both a `contractFee` and a
`settlement{outcome:"met"}` event before rolling the contract into its next period with
`deliveredThisPeriod: 0` (`src/sim/contract.ts:331-359`).
That path is covered green —
`src/sim/commands.test.ts:534`, whose name ends "**contract continues**" —
and again at `src/sim/dayBoundary.test.ts:247-249`.
So money and points do move;
the counter returning to zero is the design, not a lost settlement.

What the player can see is only `{deliveredThisPeriod}/{quotaPerPeriod}`
(`src/ui/KontraktyTab.tsx:123`), which reads `0/70` before the first delivery and `0/70` again after
a successful period —
the same string for "nothing yet" and "just paid".
The surface that announces the event makes it worse:
the Powiadomienia strip counts `settlement` events since `lastSeenTick` (`src/ui/TopBar.tsx:88`) and
opens the board **on the Kontrakty tab**, whose comment claims "the settlement audit trail lives"
there (`src/ui/TopBar.tsx:194-196`).
It does not —
`KontraktyTab` renders open offers and active contracts and nothing else
(`src/ui/KontraktyTab.tsx:161-197`).
The trail lives in Siedziba → Wartość firmy (`src/ui/CompanyValueTab.tsx:103,177`), where E16 moved
the Ledger. **The badge routes the player to the one surface that cannot show what the badge is announcing.**

E2E pins the badge mechanics only —
appears, clears, survives a keyboard path (`e2e/guildhouse.spec.ts:186-263`) —
and never asserts that a settlement is readable anywhere.
The E3 spec did ask for this:
"settlement notice fires in a seeded fast scenario" (`docs/specs/E3-contracts-and-guilds.md`, UI E2E
list).

**Classification: presentational.**

**Direction candidates** —
(a) point the strip at the surface that actually holds the trail;
(b) give the Kontrakty tab the settlement history the comment already promises;
(c) mark the contract row itself ("okres 3 — rozliczono +₸850"), which is the only option that
answers the question at the place the doubt arises.
Not mutually exclusive.

## 3b. `minPeriods` is advertised on every offer and enforced nowhere

Found while diagnosing 3a;
the likelier half of "instead of settling, they reset".

Every offer row prints "min.
{minPeriods} okr." (`src/ui/KontraktyTab.tsx:68`), and the field is generated per tier
(`minPeriodsForTier`, `src/sim/contract.ts:107`). **Nothing reads it again.**
`settleContracts` increments `periodIndex` without bound (`src/sim/contract.ts:423-436`);
the only exits from `company.contracts` are a two-miss breach (`src/sim/contract.ts:363-387`) and
`resignContract` (`src/sim/commands.ts:852-879`).
A contract therefore **never completes** —
it renews silently, forever, and a player who read "min.
3 okr." as a term waits for an end that has no code.

The doc comment on `minPeriodsForTier` states it is "required before the contract can be
resigned/expires naturally at term" (`src/sim/contract.ts:103-106`).
Both halves are false:
the spec grants resignation "at any time" (`docs/specs/E3-contracts-and-guilds.md` §Fulfilment and
settlement) and names no natural term at all.

**Classification: mechanical** —
a displayed number with no mechanism behind it. **This one is not a straight fix**:
whether contracts were ever meant to end is a design question the spec does not answer, and §Laws 8
puts new facts in front of the owner rather than into a quiet override.
Routes to a **Designer grill**, with the same-session alternative of deleting the claim (drop the
label and correct the comment) if the answer is "no term was ever intended".

---

## 4. The route editor's order drawers overlap each other (analyst's own)

**Seen:** screenshots 2 and 3 —
with the drawer open on several Stops at once, the kind buttons truncate (`Sprzed…`, `Dostar…`) and
adjacent Stops' quantity/margin boxes sit on top of one another.
The owner did not report this;
it is read off the screenshots.

**Root cause.** A ribbon node is fixed at `width: 5.5rem`, `flex: none` (`src/index.css:2477-2483`),
and its orders column is fixed at `width: var(--orders-w)` (`src/index.css:2572-2578`).
Chips were taught to respect that —
`.route-ribbon__chip { overflow: hidden }` (`src/index.css:2607-2609`) and the
`max-width`/`min-width: 0` pair on `.route-ribbon__order`, whose comment records the same failure
being fixed once already:
"adjacent Stops' chips overlapped on a long Route —
measured at 15.6px before this line existed" (`src/index.css:2611-2617`).
The **drawer** renders inside that same constrained column (`src/ui/RouteRibbon.tsx:287`) and
received none of those guards:
`.price-board__order-more` is a non-wrapping flex row (`src/index.css:1436-1439`) holding a
three-button kind picker plus inputs of `width: 4.5rem` each (`src/index.css:1441-1443`) —
several times `--orders-w`, with nothing to wrap or clip it.

So it is the #469 collision recurring one element over:
the guard was applied to the chip, and the drawer that opens beside the chip never got it.

**Classification: presentational.**

**Direction candidates** —
(a) extend the chip's containment to the drawer;
(b) lift the drawer out of the per-node column into a single row-width panel below the ribbon, since
its content is inherently wider than a node;
(c) allow one drawer open at a time.
(b) is the only one that stops fighting the 5.5rem node.
Belongs with #469's iteration 2 rather than as a lone fix.

---

## 5. What this playtest did **not** produce

Recorded so the next session does not read silence as coverage.
#440 carried three deliberate observations into the session; **none came back**:

- **#429 — the two violets** (refit `#a373d6` vs mining `#7e55ab`). Not reported.
  #440 states this "cannot be closed from a desk", so it stays open and un-evidenced.
- **#128 — the Headquarters explaining its own mechanics.** The owner's route went
  Shipyard → Refit, and no confusion point was reported. The cold HQ build loop, and the
  Budowa tab never naming its own output, remain un-observed.
- **M4's success measure** — whether authoring on the board is faster than the retired
  Trasy editor, and whether anything can no longer be done at all. Not answered. Screenshots
  2 and 3 show a five-Stop Route authored and saved, which is evidence that it *works*, not
  that it is faster.
- **D3's highlight legibility** and #469 item A's ribbon splay: not reported. The Route
  actually built has five Stops, the case #469 already records as looking right.
- **#477** (no inactive-gate warning on the board) — #440 asked specifically whether its
  absence bit the owner in play. No answer either way, so its priority is still unsupported.
- Nothing was reported as **boring**, confusing-and-abandoned, or wanted-but-unreachable.

## 6. Pacing datapoint (inference, flagged as such)

Day 743 with ₸228 641 and a rank-2 guild standing, after "kilkanaście minut". **The owner did not name a speed rung**
—
the following is the analyst's arithmetic, not a report:
at 100× the loop runs 100 ticks per real second (`MS_PER_TICK_AT_1X = 1000`, `src/sim/speed.ts:12`)
against `TICKS_PER_DAY = 24` (`src/sim/region.ts:5`), i.e. ~250 world days per real minute, so
roughly three minutes at 100× accounts for the whole run.
Relevant to #448 and the 8–12h pacing lock it exists to test:
two world years elapsed inside a "kilkanaście minut" session, and the purse ended two orders of
magnitude above the ₸5 000 founding goal.
No conclusion is drawn here —
the 100× rung is *supposed* to compress.
It is logged because #448 will need a starting number and this is the only field one there is.

---

## Parked hooks

- **The stale comment at `src/ui/TopBar.tsx:194-196`** ("the settlement audit trail lives" on
  the Kontrakty tab) is a decision record that E16's Ledger relocation falsified without
  updating. Whichever direction 3a takes, that comment is part of the change — a line learnt
  to be false gets struck at the moment it is learnt (CLAUDE.md §Rules).
- **The #375 pattern, not the #375 bug.** A symptom whose first triage stops at the copy and
  never reaches the state that produced it will be re-reported verbatim by the next playtest.
  Worth a line in the coder/reviewer habit rather than an issue: when a hint reads wrong, ask
  what the hint is describing.
- **`.market-row__trend*` and `.route-ribbon` guard asymmetry** are both #468 D2 residue of
  the same shape — a removal that took the element and left its rules. #469 §E holds the
  board-side list; the PortPanel side had none until item 1 above.
