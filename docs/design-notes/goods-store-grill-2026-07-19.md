# Grill record — one Goods store (E13.0), 2026-07-19

Owner-led. Opened as the **E13 grill** with a two-item agenda: (a) skim the E13 spec against
the code, since #99 had shipped the BuildOrder generalization and #100's body might overlap
it; (b) Professor **F7**, deliver addressing. It closed with a new sub-epic, an ADR, and the
HANDOFF queue invalidated. This note records how, because the path matters more than the
destination.

Outputs: [ADR-0008](../adr/0008-one-goods-store.md),
[E13.0 spec](../specs/E13.0-goods-store.md), CONTEXT.md (*Goods store*, *Transfer*, Ledger
§Value law).

## What the agenda's item (a) actually found

Not the feared overlap — the opposite. Four findings from reading the spec against the code:

1. **The E13 spec prescribed a road E14 never took.** Tech said `BuildOrder` gains a target
   union; reality is that `BuildOrder` is still bare `{ siteStore }` (`building.ts:44`) and
   #99 extracted a shared *engine* while E14's Shipyard kept its own state. Three parallel
   holders, no union.
2. **Name collision:** `commissionBuilding(thalers, laborFee)` already existed
   (`building.ts:396`) as a generic helper, while the E13 spec named a *command* the same
   thing.
3. **The scarcity law was already generalized** (`commands.ts:126-137`), with a comment
   inviting E13 to consume it — that slice was pre-paid.
4. **The netWorth array was exactly as the Professor described** — and the thing E13 needed to
   add to it was a *building's store*, not a construction site. The locked "site registry"
   decision had no name for it.

Finding 4 is what reopened the settled decision, at the owner's explicit request.

## The chain of reasoning, in order

**The rule.** Translated to the player's side, the question "what does the registry protect"
became "what does the company-value chart promise". Answer: goods you own count wherever they
lie. Omit a place and storing goods reads as burning money — the mechanic inverted, silently.
The owner accepted the rule as **"every place my goods can sit"**, which immediately made
"site registry" the wrong instrument for the wrong shape.

**Collections versus singletons.** The silent failure was never about *how many* places exist;
it was that construction sites are three *named singleton fields* while ships and buildings
are collections a loop already covers. The Storehouse arrives as a collection, so the
registry as specced protected nothing E13 shipped.

**The trigger was void.** E15's spec says plants are "at most one per port; **total count
unlimited**" (`E15-processing.md:52`) — a collection, not a fourth singleton. The locked
decision's re-evaluation trigger ("at E15 start, when the Plant makes it four concurrent site
kinds") rested on a premise the E15 spec itself contradicts. #304 therefore needs rewriting,
not closing; its real trigger is the **M5 grill**, where the Great Work may be a genuine
fourth singleton. **Corrected in-session:** the claim "singletons are closed at three" is true
only *through E15*, not forever — PRD's Law of the Great Work guarantees a new
super-construction every level.

**The instrument that ends the discussion, not just the bug.** An exhaustive switch over site
kinds would *generate* this same conversation for every future author ("am I a site kind? must
I register?"). What ends a recurring discussion is a named rule with an obvious place to apply
it, plus an invariant that enumerates nothing. Three tiers were costed; the third — inverting
the state model so every goods place is one collection — was recommended **against** on price
and then chosen anyway by the owner, consciously, after the price was named.

**F7 dissolved rather than answered.** The Professor's "four deep" does not materialize in
E13: the scarcity law makes HQ, Shipyard and Storehouse construction mutually exclusive, so
the chain is one site plus an orthogonal refit. But a sharper problem surfaced underneath.
E15's provisions chain is **3 grain + 1 textiles** (`E15-processing.md:76`) and the Granary
stores grain — so a port hosting both gives the player one good and two legitimately different
intents. It resolves today **only by accident**, because E13 gives storage its own verb while
E15 leaves the plant on `deliver`. Unifying the model removes that accident and makes an
explicit address constitutive rather than optional.

**Where the fear was right and the remedy wrong.** Asked whether patching now means a 4×
future epic, the answer was: the multiplier comes from *fragmentation*, not from missing
properties. The unification is the insurance; per-lot receipt time is one property among many
that the unification makes cheap, and it has no consumer today. It was replaced by
encapsulation behind three accessors plus a **testable** acceptance criterion — adding a
property must touch only the type, the accessors and the migration.

## What was rejected, and why it stays rejected

| Rejected | Reason |
| --- | --- |
| Typed site registry (union + exhaustive switch over site kinds) | Guards a set closed at three; obliges every future author to ask "must I register?" — reproduces the discussion it was meant to end |
| Pulling the #304 ordered-iterator refactor into E13 | Trigger premise void; four-subsystem refactor mid-epic buys the loud cases little |
| Per-lot receipt time now | No consumer; encapsulation is the cheaper insurance |
| "The entire existing suite passes unchanged" as the acceptance shape | Not achievable alongside encapsulation (~105 test sites); replaced by a golden-run digest generated on `main` before the refactor |

## Two corrections the driver owes the record

Both were claims made to the owner during the grill and corrected by the Engineer pass:

- **"The suite passes unchanged"** was proposed as E13.0's acceptance shape. It cannot hold —
  encapsulation stops ~72 test index sites and ~33 literal constructions from compiling, and
  keeping tests indexing contents directly would make the acceptance criterion false exactly
  where it is later tested.
- **"The invariant enumerates nothing"** was overstated. `companyStores` is still an
  enumeration; the invariant bites only because the test generates its moves from it. What is
  true is the conversion of a **silent** failure into a **loud** one — a store missing from
  `companyStores` is one the player cannot fill.

## The transferable lesson

**When you extract a shared engine because a second caller appeared, ask whether the *concept*
needs unifying — not just the code.** #99 deduplicated the construction-site engine and left
three parallel state holders; the code was shared, the concept was not, and "a place where
goods can sit" went unnamed for two more epics. Naming a concept is cheap; building machinery
for an imagined future is not. The debt here was the missing *name*, not missing machinery.

Framed for the record without blame (`docs/incidents/README.md` culture; this is not an
incident — no rule was broken): the model simply lagged the game, and the moment it became
visible was #99, not the start of the project. Designing this model at E2 was not possible —
it required knowing that plants are collections, that provisions consume grain, that the Great
Work recurs every level, and that a Storehouse variant *is* a goods filter. You cannot find
the seam of a system with one instance.

## Process observations for the retro

- Both findings that reopened the decision **had been sitting in the documents**, and no
  verification gate looks for them: a void trigger was one `grep` away in the E15 spec, and
  the grain collision was plainly in the chain table. They surfaced only when someone read two
  specs side by side with a specific question. Gates check diffs; nothing checks *documents
  against each other*.
- The Engineer subagent ("Carl") was dispatched only after the Design closed, per
  ORCHESTRATOR.md's rule of thumb. It returned two corrections to owner-facing claims and one
  objection to a locked item (OQ1), which is the routing behavior the persona is meant to
  have. Dispatching mid-grill would have burned a cold package on a moving design.
- **E13.0 is attached to E13 practically, not conceptually** — its scope is the four stores
  from E9/E14 and contains nothing about guild buildings. Recorded so nobody later searches
  E13.0 for the Storehouse.
