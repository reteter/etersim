# Professor review — `src/sim` (tick pipeline, market, commands)

*Dispatch: 2026-07-13, emulated harness def (general agent, Opus), pre-E3/E12/E13. Verbatim report below.*

---

*"Watch it carefully now!"* I have read the whole of `src/sim`, the three approved specs that will lean on it (E3, E12, E13), and the ADRs that fence it. Here is my judgement.

---

## 1. The Dramatic Opening

This subsystem is **honestly built** — and I do not say that to flatter. The purity line holds (`src/sim/index.ts:1-7`), every draw threads one seeded state (`rng.ts:10`), and the E9 equivalence guarantee — that a routed order can never out- or under-perform the identical manual trade — is *enforced by construction*, not by hope: `executeStop` dispatches the very same `applyCommand` a player's finger would (`tick.ts:101-106`). Beautiful.

But three of the load-bearing beams were carved for a **five-archetype, one-building, one-RNG-consumer** world. M3 arrives with a sixth archetype, a second building, and new day-boundary consumers. The wood is sound; the joinery is about to be asked to carry weight it was never jointed for. *Why is it so?!* — let us look.

---

## 2. The Immediate Analysis

### Finding A — `PortArchetype` is one union serving two populations *(blocks E12)*

`PORT_ARCHETYPES` (`region.ts:18-24`) does **double duty**: it is both the canonical exhaustiveness/iteration order for the archetype-keyed records *and* the worldgen draw pool (`worldgen.ts:58,72,75`). E12 adds `"freeport"` to the union (`E12-region-v2.md:54`) — and the moment it does, `archetypeWeights: Record<PortArchetype, number>` (`template.ts:10`) becomes exhaustive over six keys, so TypeScript **compile-forces a freeport weight** that the very same spec forbids: *"the freeport is not in the weights table"* (`E12:57`). Worse, `drawWeighted` sums and iterates `PORT_ARCHETYPES` (`worldgen.ts:72,75`) and `drawArchetypes` shuffles it (`worldgen.ts:58`) — so a freeport in that array silently perturbs both the weighted draw and the "one of each first" guarantee, and the spec's *"exactly one freeport"* invariant now fights the machinery instead of riding it.

The tell that this union wants splitting is that **E3 independently reaches for the same seam**: `GuildId = Exclude<PortArchetype, "freeport">` (`E3-contracts-and-guilds.md:147`). Two epics, same fracture line. The resolution is a deliberate split — a weighted-pool list distinct from the canonical all-kinds list (or the `Exclude` type made load-bearing) — decided *before* E12's first issue is cut, not discovered inside it.

### Finding B — one linear RNG stream, and the day boundary is about to get crowded *(shapes E3)*

`RngState = number` (`rng.ts:10`) — a single linear stream, no substream facility. Today `driftStep` is the lone day-boundary consumer (`tick.ts:34-53,223`). E3's spec says contract generation runs *"from a seeded RNG substream (the flow drift pattern)"* (`E3:172`) — but *"the flow drift pattern"* **is** linear threading; there is no isolation to inherit. Heed it: the hazard is a coder reading "substream" and expecting independence the code does not give. The instant contract-gen joins `driftStep` at the boundary, the **order of their draws becomes a permanent, testable determinism contract** (ADR-0003). The E3 grill must choose deliberately: build a `deriveSubstream(state, tag)` helper so independent day-boundary consumers don't perturb one another, or accept one stream and *freeze-and-test the order*. Either is fine — chosen by accident is not.

### Finding C — the day boundary has no seam *(blocks E3)*

The entire day-boundary sequence lives as **inline statements** inside `tick()` (`tick.ts:219-241`): drift → snapshot → netWorth, no named phase. E3 prescribes an *ordered* insertion — *"drift step → price snapshots → upkeep → contract settlements → offer refresh → netWorth"* (`E3:176-178`), with the ordering *"asserted via netWorth"* (`E3:216`). There is no `dayBoundary(world)` function to be that assertion's single home; the contract E3 wants to test does not yet have an address. Extract the seam before the phases pile in, or the ordering law will be smeared across an ever-longer inline block.

### Finding D — the active `BuildOrder` is nested under `headquarters` *(blocks E13)*

The one active build lives at `Company.headquarters.buildOrder` (`world.ts:24`, `building.ts:37-40`), and every construction routine hardcodes the HQ port as the market to buy from: `runBuildSiteAutoDraw` reads `hq.portId` (`building.ts:237,248`), `computeRushQuote` likewise (`building.ts:125,130`), and `rushBuild` indexes `hq.portId` (`commands.ts:184-185`). E13 needs a build order that targets a **different** port's market (`E13-guild-buildings.md:87-88`) while keeping *"one active Build Order per Company, ship or building"* (`E13:64`). A build order for a storehouse at a non-HQ port, physically nested inside the Headquarters object, is a coupling the code will resent. *Why is it so?!* — where does the singular active BuildOrder *live* once it can target any legal port? That placement decision (lift to `Company`, keep the E9 `headquarters` shape untouched per `E13:83-84`) belongs at the E13 grill, ahead of the generalization issue.

### The deep-module wins — do not let anyone "fix" these

- **The trade seam is already where E3 hooks.** Every buy and sell funnels through one `applyTrade` (`commands.ts:275,286,334`), and the routed sell reaches it via the same `applyCommand` (`tick.ts:104`). E3's sale attribution — *"manual or routed, same quotes, same purse"* (`E3:96`) — has exactly one place to increment `deliveredThisPeriod`. That is a deep module paying off.
- **The E9 equivalence guarantee is real and inherited for free.** Route orders are dispatched as commands, so E3 contract fulfilment and E13 store/withdraw inherit "route == manual" without new math (`tick.ts:81-110`).
- **The Ledger is a genuine single seam.** Every mutation appends through `appendLedgerEvent` (`ledger.ts:89-91`); E3/E13's new kinds slot in without a new plumbing regime.

### Watch, don't invest — tick cost

The per-tick `.find` by id over ships/ports/lanes (`tick.ts:89,93`, `ship.ts:82`, and throughout) is O(n²)-flavoured, but at 7–9 ports and a handful of hulls it is *nothing*. A note for the ledger of awareness, not a task.

---

## 3. The "Why is it so?!" Dilemmas

1. **One `PortArchetype`, two populations** — can the neutral Free port and the five economic archetypes keep sharing a single union and a single `PORT_ARCHETYPES` array when one epic wants freeport *excluded* from weights and another wants it *excluded* from guilds?
2. **What does "substream" mean on a scalar RNG?** — a real `deriveSubstream` helper, or a frozen-and-tested linear draw order?
3. **Where does the singular active BuildOrder live** once it can target a port other than the Headquarters?
4. **Does the day boundary deserve to be a named phase** before three more consumers move in?

---

## 4. The Routing Table

Ranked by what **blocks issue-cutting** versus what is cleanup.

| # | Finding | Cite | Channel | Blocks |
|---|---------|------|---------|--------|
| A | `PortArchetype` double-duty; exhaustive `archetypeWeights` compile-forces a freeport weight the spec forbids; `PORT_ARCHETYPES` is also the draw pool | `region.ts:18`, `template.ts:10`, `worldgen.ts:58,72,75`, `E12:54,57`, `E3:147` | **E12 grill** — resolve the union split (`Exclude`/separate pool) before the template issue | E12 issue 1 |
| C | No day-boundary seam; E3's ordered upkeep→settlement→offer sequence has no home to be asserted in | `tick.ts:219-241`, `E3:176-178,216` | **E3 grill** — extract `dayBoundary(world)` as an enabling step | E3 settlements issue |
| D | Active `BuildOrder` nested under `headquarters`; HQ port hardcoded as the buy market | `world.ts:24`, `building.ts:130,237,248`, `commands.ts:184`, `E13:83-88` | **E13 grill** — decide BuildOrder placement before the generalization issue | E13 issue 1 |
| B | "Substream" is linear threading; day-boundary draw order becomes a frozen determinism contract | `rng.ts:10`, `tick.ts:223`, `E3:172` | **E3 grill** — `deriveSubstream` helper *or* freeze-and-test order (settled-decision touchpoint: ADR-0003, extended not challenged) | Shapes E3 generator |
| E | New E3/E13 commands must preserve the ADR-0005 invariant `applyCommand(w,c)` then `tick(w',[])` ≡ `tick(w,[c])` | ADR-0005, `commands.ts:84` | **Note to E3/E13 coders** — a law new command authors honor, not a change | — |
| F | `applyCommand` monolithic switch grows to ~19 kinds; `executeStop` must stay in sync with `StopOrder`↔`Command` | `commands.ts:84-325`, `tick.ts:81-110` | **`docs/design-notes/`** — dispatch-table refactor as a *quality* option; keep adding cases meanwhile | No |
| G | `netWorth` event fields fixed `{thalers,cargoValue,siteStoreValue,total}`; E13 adds a storehouse term — fold vs. new field | `ledger.ts:77-84,128-145`, `E13:104-105` | **E13 grill footnote** — field semantics (save-break is already a pre-1.0 non-goal, ADR-0004) | No |
| — | Deep-module wins (trade seam, equivalence, Ledger seam) | `commands.ts:334`, `tick.ts:104`, `ledger.ts:89` | **Preserve** — do not refactor away | — |

A review that routes nowhere is theatre without physics — so there is the table, and there is the physics. The three blockers (A, C, D) each want a grill answer *before* their epic's first issue is written; B shapes E3's core; the rest are lifts, not gates.

*And that — is why it is so.*
