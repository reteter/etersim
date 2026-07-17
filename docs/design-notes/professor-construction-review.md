# Professor review — the construction subsystem, end-to-end (2026-07-17)

Dispatch: sim construction (sites, commissioning, build progress, stalls, delivery,
refit), its commands, save v13, and the store→UI bridge. Persona:
docs/personas/PROFESSOR.md. Read set: CONTEXT.md, ADR-0002/0003/0004, E14 spec,
E13/E15 specs where they touch the seam, ab-276-shipyard-ui.md, issues #290/#292
(known port-arm-A items — referenced, not re-reported).

## 1. The Dramatic Opening

Watch it carefully now! Three construction sites — a hull at the Headquarters, the
Shipyard building itself, a Refit against a docked ship — and every one of them fills
through **one** engine (`drawConstructionSite`, `quoteConstructionSiteRush`,
`applyDeliveryToConstructionSite`, src/sim/building.ts:333, 171, 122), quotes with the
same function that charges, and never once reaches for the RNG. The #99 seam did what
a seam is supposed to do: the second and third callers arrived and the engine did not
move. The determinism suite pins a deep-equal world mid-refit
(src/sim/shipyard.test.ts:858-887); the persistence suite round-trips a mid-refit
world through the real envelope (src/store/persistence.test.ts:234-252). This is
physics done properly.

And yet — heed it! — the subsystem enforces its own scarcity law at two sim gates but
tells the player about only one of them; it enumerates "what is a construction site"
in **five separate hand-maintained lists**; and it stores half of a Refit's target
while deriving the other half. The engine is deep; the bookkeeping around it is
starting to shallow out. Why is it so?! Let us see.

## 2. The Immediate Analysis

### Sound and verified (the settled physics, confirmed)

- **ADR-0003 determinism**: no `Math.random`, no `Date.now`, no RNG draw anywhere in
  the construction path; auto-draw walks GOOD_IDS in fixed order
  (src/sim/building.ts:345), the three site runners run in a fixed tick order
  (src/sim/tick.ts:452-461), and the shared-purse race is deterministic and tested
  (src/sim/shipyard.test.ts:726).
- **ADR-0002 purity**: src/sim/shipyard.ts and building.ts import only sim modules;
  the UI-side derivations (`refitBubbleData`, src/ui/refitBubble.ts:40;
  `deriveSiteStallReason`, src/store/siteStall.ts:24) are pure functions over the
  World — the seam holds.
- **Save v13 (ADR-0004)**: `migrateV12ToV13` is an honest documented identity
  (src/store/persistence.ts:84-90), `READABLE_VERSIONS = {12, 13}`
  (src/store/persistence.ts:82) per the one-step precedent; the rationale comment
  (persistence.ts:67-75) is exactly the paper trail the format needs.
- **The Reserve (#122)** binds at every spend point: `commissionBuilding`
  (src/sim/building.ts:406-409), the auto-draw skip (building.ts:352), the rush purse
  cap (building.ts:176), and all three commission commands reuse the same gate
  (src/sim/commands.ts:229, 429, 501).
- **Ledger grammar law (#203)**: `refitStart` carries `thalers`
  (src/sim/commands.ts:521-527); `shipyardBuilt` deliberately carries none, with the
  "fee already logged by laborFee" reasoning written at the type
  (src/sim/ledger.ts:124-133). Net worth counts all three site stores
  (src/sim/ledger.ts:210-219) per the owner's #285/#286 rulings.
- **Quote/charge no-drift**: `computeRushQuote` / `computeShipyardRushQuote` /
  `computeRefitRushQuote` each preview the exact walk their command executes
  (building.ts:243, shipyard.ts:160, shipyard.ts:253) — the E9 discipline survived
  two generalizations intact.
- A note for the dispatch's own wording: there is **no worldgen of sites** — sites
  are commissioned at runtime; src/sim/worldgen.ts is untouched by this subsystem,
  and correctly so.

### F1 — DEFECT: the scarcity law is UI-mirrored in only one direction (silent no-op)

The one-Build-Order-per-Company law is enforced at two sim gates: `placeBuildOrder`
rejects while `shipyard.site` is active (src/sim/commands.ts:226) and
`commissionShipyard` rejects while `headquarters.buildOrder` is active
(src/sim/commands.ts:427). The Shipyard side surfaces its gate properly —
disabled-with-reason (src/ui/PortPanel.tsx:571-577), the very precedent arm B was
merged for honoring. But the Headquarters side does not: `canPlace` at
src/ui/HeadquartersPanel.tsx:52 checks only `!buildOrder` and the purse. While the
Shipyard is under construction, the Budowa tab's "Zleć budowę" button is
**enabled**, the confirm dialog opens, the player confirms — and `applyCommand`
returns the world unchanged. A paying-attention player watches a confirmation do
nothing. This is precisely the "never a silent no-op" rule (#124 precedent, cited in
PortPanel.tsx:555 itself!) — violated one panel over, by the sibling of the code that
honors it. Not covered by #290 or #292 (their scope is the deliver-chain internals
and the arm-A ports; #292 item 6 is the market rows, not this button).

### F2 — DEFECT (small): a disabled reason that contradicts the glossary

src/ui/PortPanel.tsx:574 disables the Shipyard commission with "Budowa siedziby
wciąż trwa". But `headquarters.buildOrder` is a **ship** under construction — the
Headquarters itself is never under construction (CONTEXT.md — Headquarters: "active
immediately"; the HQ is the one instant Building, E14 spec counter-erratum). The
string tells the player their siedziba is still being built, which is impossible.
Should read as ship construction ("Trwa budowa statku w siedzibie" or kin). Glossary
fidelity is law; a player-facing string that names the wrong concept is a defect,
not polish.

### F3 — Edge defect: the stall readout is blind to same-tick cross-site sequencing

`deriveSiteStallReason` (src/store/siteStall.ts:42-43) tests each good's 1-unit cost
against the **current** purse. But the tick draws sites in fixed order — HQ first,
then Shipyard construction, then Refit (src/sim/tick.ts:452-461) — from one shared
purse. An HQ hull build and a Refit *can* be concurrently active (the scarcity law
deliberately excludes the RefitOrder — E14 spec §Scarcity; tested at
src/sim/shipyard.test.ts:726). With a thin purse, the Refit's stall readout can show
"no stall" (or "brak towaru" instead of "rezerwa") for a tick in which the HQ's
draws will floor the purse before the Refit ever walks. Within one site the
derivation is sound (any-good-affordable matches the sim's first affordable draw);
across sites it is not modeled, and no test visits it. A small honesty gap — in a
feature whose entire purpose is honesty. The natural moment to fix it is #292 item 1
(the stall-walk collapse), which is why I flag it now rather than after that port.

### F4 — Structural: "what is a site" lives in five hand-maintained enumerations

Count them: (1) the tick phase trio (src/sim/tick.ts:452-461); (2) the deliver
priority chain (src/sim/commands.ts:280-413, three near-identical blocks — #290
already owns the dedup); (3) the netWorth `stores` array
(src/sim/ledger.ts:211-215); (4) the rush command trio (commands.ts:242/445/529);
(5) the UI section branches (PortPanel.tsx:620/645 plus HeadquartersPanel's tab).
E13's Storehouse and E15's Plant each add a site to **all five**. The typechecker
guards none of them — forget the netWorth array entry for the Storehouse site and
the company-value chart silently under-reports, with no red anywhere. The engine
(#99) was generalized; the *registry of its callers* was not. E13's own spec already
gestures at a generalized `BuildOrder` target-kind union (E14 spec §Scarcity notes
it as unimplemented) — that refactor should carry an **ordered Company-sites
iterator** that tick, deliver, rush, netWorth and the stall derivation all walk, so
a new site type is one list entry, not five edits.

### F5 — Structural: rebuild-not-spread `Shipyard` literals

Every transition reconstructs the `Shipyard` literal field-by-field:
`completeShipyardIfDone` (src/sim/shipyard.ts:180), `completeRefitIfDone`
(shipyard.ts:279), `runShipyardAutoDraw` (shipyard.ts:317-320),
`runShipyardConstructionAutoDraw` (shipyard.ts:217), and the command handlers
(src/sim/commands.ts:347, 390, 436, 477, 512, 563) — roughly ten literals. Because
every `Shipyard` field beyond `portId` is optional (shipyard.ts:131-135), the day
the type grows a field (refit cancellation is an explicit save-compatible v2
extension, E14 spec non-goals!), the compiler will flag **none** of these sites as
silently dropping it. Today the drop is the intent ("clear `site`") — but the
intent is implicit in an object literal, not named. One transition helper (or a
discriminated state union: commissioned / active / refitting) makes each drop a
decision. File this alongside #290's dedup pass — same shape of debt, same fix
window.

### F6 — Hidden assumption: `RefitOrder` stores half its truth and derives the other half

`targetHold` is frozen at commission (src/sim/commands.ts:511) while the recipe is
recomputed live on every read — `refitRecipe(ship)` at shipyard.ts:245,
commands.ts:375/544, PortPanel.tsx:651, refitBubble.ts:51 — from `nextHoldStep`'s
walk over the **current** `HOLD_LADDER` (shipyard.ts:62-68). Today they cannot
diverge: the lock freezes `hold`. But `HOLD_LADDER` is declared a *tuning constant*
(shipyard.ts:28-31; spec: "tuning is not spec drift") — and the moment it is tuned
under a loaded mid-refit save, the live recipe (new ladder) and the stored
completion target (old ladder) split: the ship completes to a `hold` that may sit
between the new ladder's rungs, and its derived refit level shifts. The comment at
shipyard.ts:110-114 proudly says "nothing to drift out of sync" — true of the
*store*, not of the *ladder*. Either all-stored (freeze the recipe at commission,
like `targetHold`) or all-derived (recompute `targetHold` too) is self-consistent;
half-and-half is the one shape that can split. The stored `targetHold` is itself in
the spec (E14 Tech, `RefitOrder { targetHold }`), so this routes as a
settled-adjacent watch, not a fix: the new fact is the divergence-under-tuning of a
mixed derivation, and it matters only if ladder tuning is ever actually on the
table.

## 3. The "Why is it so?!" Dilemma

1. **Who owns the site registry?** (F4) E13's generalized-BuildOrder slice is the
   scheduled moment. Does the grill commit to an ordered Company-sites iterator as
   part of that slice, or do E13/E15 each hand-extend five lists and we trust
   review to catch the netWorth omission?
2. **Does `deliver` ever learn an address?** The command carries no target
   (src/sim/commands.ts:75); priority-by-convention is documented and, note well,
   the E15 spec *extends* it (E15 spec lines 183-184: site first, then plant). So
   this is settled ground — but here is the fact to weigh at the E15 grill: once a
   plant and any construction site share a port, "feed the plant" and "feed the
   site" are **inexpressible as different intents** — the chain decides, the player
   cannot. Two sites deep that was tie-breaking; four deep it is gameplay.
   Challenge routed with its spec label (E15 §Deliver targeting rule), not
   relitigated here.
3. **One stall vocabulary or two?** `reserve`/`goods` served a single site. With
   cross-site purse sequencing (F3) and E15's starved/backlogged pair, the stall
   taxonomy is quietly becoming a system. Is "stalled because an earlier site in
   the fixed order drank the purse" a third reason the player deserves to see, or
   deliberate opacity?

## 4. The Routing Table

| # | Finding | Channel | Destination |
|---|---------|---------|-------------|
| F1 | HQ Budowa button enabled while Shipyard site active — confirmed click is a silent no-op (HeadquartersPanel.tsx:52 vs commands.ts:226); #124 precedent | **Defect — GitHub issue draft** | New issue: "UI: mirror the scarcity gate on the Budowa tab (disabled-with-reason)"; natural sibling of #292 item 6, but HQ-side and precedent-violating — do not let it ride along silently |
| F2 | "Budowa siedziby wciąż trwa" names the wrong concept (PortPanel.tsx:574) | **Defect — fold into F1 issue** | Same issue, second checkbox |
| F3 | Refit stall readout ignores HQ-first purse sequencing (siteStall.ts:42-43 vs tick.ts:452-461); untested | **Defect (minor) — comment on #292** | Fix inside #292 item 1 stall-walk collapse; add the concurrent-sites readout test there |
| F4 | Five hand-maintained "what is a site" enumerations; netWorth array is the silent one (ledger.ts:211-215) | **Architectural dilemma — grill agenda** | E13 grill (generalized BuildOrder slice): commit to the ordered site iterator |
| F5 | ~10 rebuild-not-spread `Shipyard` literals; optional fields mean the compiler cannot flag drops when the type grows | **Design-note — comment on #290** | Same dedup window as #290 deliver-chain helper; name the transitions |
| F6 | `RefitOrder` mixed stored/derived truth splits under `HOLD_LADDER` tuning mid-save | **Settled-adjacent watch — grill, conditional** | Label: E14 spec Hold ladder + Tech `RefitOrder`; new fact: divergence-under-tuning. Raise only if ladder tuning enters a session agenda |
| F7 | Deliver addressing is inexpressible intent once E15 plants coexist with sites | **Settled-decision challenge — grill agenda** | Label: E15 spec Deliver targeting rule; new fact: four-deep chain makes the convention gameplay-significant |
| — | Determinism, purity, v13, Reserve, ledger grammar, quote/charge discipline: verified sound | No routing needed | — |

*The Professor reads, cites and questions; he edits nothing. These findings reach
the codebase through the owner's pipeline — grill, spec, issues — never directly.*
