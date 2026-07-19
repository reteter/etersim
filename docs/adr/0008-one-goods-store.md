# Every place goods can sit is one encapsulated Goods store

The simulation grew four places where goods sit — a Ship's Cargo (`ship.ts:60`), the
Headquarters build site (`building.ts:44-46`), the Shipyard's own construction site and the
active Refit site (`shipyard.ts:115-135`) — with no shared concept between them. "What is a
place goods can sit" therefore lived in five hand-maintained enumerations (Professor review
F4, `docs/design-notes/professor-construction-review.md`), of which the `computeNetWorth`
array (`ledger.ts:211-215`) fails **silently**: a forgotten entry under-reports company value
with no error, no failing test and no in-game symptom. Separately, delivery target selection
was expressed by *verb* rather than by address (Professor F7): `deliver` reaches a
construction site and a future `store` reaches a Storehouse only because they are different
words — a disambiguation that E15's provisions chain (3 grain + 1 textiles,
`docs/specs/E15-processing.md:76`) breaks, since the Granary stores the same grain a plant
consumes.

Decided at the owner-led E13 grill, 2026-07-19, which reopened the site-registry decision
locked earlier that day. A typed **site registry** — a discriminated union over site *kinds*
with an exhaustive switch, consumed by `netWorth` — was considered and rejected: it guards a
set that only happens to be closed at three, and it obliges every future author to ask "am I
a site kind? must I register?" — reproducing the very discussion it was meant to end. The
deeper finding was that "a place where goods can sit" had never been named at all; #99
extracted a shared construction-site *engine* but left three parallel state holders, so the
code was deduplicated while the concept was not.

## Decision

- **One type for every place goods can sit** — moving or fixed, ship or building: the **Goods
  store** (PL: miejsce na towary). A Ship's Cargo is a store that moves; a construction site's
  pile and a Building's contents are stores that do not. Movement is a property of the Ship,
  never of the store.
- **Contents are opaque.** They are reachable only through `amountOf`, `withAdded` and
  `withRemoved`. Enforced by the type system (a non-exported `unique symbol` brand), checked
  by the existing `npm run typecheck` gate — verified feasible against this repo's own
  compiler before adoption.
- **The receiving store owns the policy** — goods filter, capacity, remaining need,
  post-receipt behavior, withdrawal permission — expressed as a discriminated union
  **derived at the point of use, never serialized** (a stored closure would not survive
  ADR-0004's `JSON.stringify`). The repo already derives site views this way
  (`shipyard.ts:159-163, 256-265`).
- **Capacity is never a field on the store.** A Ship's capacity is `Ship.hold`, which Refit
  mutates (`shipyard.ts:290-291`); a construction site has no scalar capacity at all, only
  per-good remaining need. A `capacity` field would be a second source of truth — the
  stored-vs-derived split flagged as Professor F6. Capacity lives only in the policy.
- **One transfer primitive** moves goods between owned stores: the **Transfer** (PL:
  przeniesienie towaru). Company value changes **only** through a booked Ledger event; moving
  your own goods between places you own is not such an event and is therefore value-neutral.
  Mechanics that legitimately change value on movement (storage fees, spoilage, handling
  loss) must book an explicit event.
- **The guard against a forgotten store is an invariant, not an enumeration** — a property
  test asserting value-neutrality over the Company's stores, rather than an exhaustive switch
  over store kinds.
- **Per-lot receipt time is deliberately not modelled.** It has no consumer today (E15 defers
  ice decay to a later epic). Opaque contents are the insurance instead: adding a per-good
  property must touch only the type, the three accessors and the save migration.

## Consequences

- **Positive.** Adding a property to goods held in a store touches the type, the three
  accessors and the migration — nothing else, and the compiler proves it. A new policy kind
  that `accepts` does not handle is a compile error. The silent netWorth failure mode is gone.
  The four write closures threaded through `tryDeliver` (`commands.ts:156-182, 359-415`)
  collapse into one `writeStore`.
- **Negative — one enumeration remains.** `companyStores` is still hand-maintained, and the
  invariant only guards stores that appear in it. The trade is deliberate and is the whole
  point: a store missing from `companyStores` is a store the player cannot fill, which fails
  **loudly** in the first minutes of play, where the netWorth omission it replaces failed
  silently and forever. Converting silent to loud was the goal; eliminating enumeration was
  never achievable.
- **Cost paid once.** Every existing read of a store's contents — roughly 127 sites across
  production and tests — is rewritten through the accessors. This is what makes the
  encapsulation guarantee true for tests as well as production code; leaving tests indexing
  contents directly would make the guarantee false exactly where it is later tested.
- **Not decided here.** Explicit addressing, which deletes the `deliver` priority chain, lands
  in E13 — it is a behavior change and would blow E13.0's behavior-preservation cover.
  Unifying `market↔hold` with the transfer primitive is deferred: that path also carries the
  price walk, the purse, market impact and contract-fulfilment attribution
  (`commands.ts:746-798`), and folding it in is the one part of the collapse that risks the
  behavior-preservation guarantee. The store's **direction** rules (who may put goods in;
  whether withdrawal is allowed) are contract here but are not implemented in E13.0, which has
  no consumer for them — they arrive with withdraw (E13) and the plant's output store (E15).
