# E13.0 shrink measurement — did the prerequisite make #100 smaller? (interim)

**Date:** 2026-07-21 (E13.0 close). **Status:** LIVE — interim projection; the definitive
measure is due at **E13 close**, per the bet's own terms.

## The bet being measured

`docs/HANDOFF.md` (§"Design sessions are the work", owner framing 2026-07-19):

> The unfalsified half of this bet: E13.0 is supposed to make #100 *smaller*.
> **Measure it at E13 close** — if #100 did not visibly shrink, the running-in framing is
> a feeling rather than a thesis.

E13.0 (ADR-0008: one opaque `GoodsStore` + `Transfer`) shipped ahead of E13 explicitly so
that #100 (the Storehouse) would consume primitives instead of inventing them. This note
records whether that paid off.

## Why this is interim, not definitive

The bet says measure **at E13 close**. E13 has not started; #100 is not implemented, so
**no shipped `#100` diff exists** and the definitive LOC delta is physically unavailable
today. What is available now, at E13.0 close, is a **scope-delta projection** read from
#100's own acceptance-criteria history — a strong signal about direction and risk, but not
the shipped number. **Do not read this note as "bet confirmed."** The confirmation is a
future measurement (see §At E13 close, do this).

## Method

Compare #100's acceptance criteria across its three recorded states — original body →
first amendment (2026-07-19 00:19) → second amendment (2026-07-19 08:25, current) — and
classify each obligation as *build a mechanism* vs *consume a primitive*. The shrink, if
real, shows up as mechanism-building obligations either **deleted outright** or **moved
into E13.0**.

## Finding 1 — an entire guard sub-project was deleted from #100

The first amendment grew #100 a **typed site registry**: a discriminated union of site
kinds + an exhaustive `switch` as a compile-error guard against the silent netWorth
omission, an explicit **"not an array"** prohibition, **per-kind netWorth coverage tests**,
and *"quote the compiler error in the completion report"* named as a deliverable.

The second amendment **withdrew all of it** ("The site-registry amendment posted earlier
today is withdrawn in full"). Dropped, verbatim: typed site registry / exhaustive switch /
compile-error guard; "not an array"; per-kind netWorth coverage. Replaced by a single line:
netWorth includes Storehouse stores via the `companyStores` walk, *"omissions are caught by
the value-neutrality invariant, not by an enumeration or a compile error."* That invariant
ships in **E13.0**, not #100.

This is the strongest evidence: a whole guard mechanism that was about to be #100-local
work no longer exists anywhere in #100's scope — E13.0's design dissolved the problem it
guarded.

## Finding 2 — the abstractions #100 needs pre-exist in E13.0

| #100 body (pre-E13.0) | #100 current (post-E13.0) | Who builds it |
| --- | --- | --- |
| `store: Record<GoodId, number>` | `store: GoodsStore`, touched via `amountOf` / `withAdded` / `withRemoved` | **E13.0** builds the type; #100 consumes |
| capacity / hold / filter clamps written **inside** `storeGood` | a `StorePolicy` variant `{ kind: "storehouse"; filter; capacity }` consumed by `accepts` | **E13.0** builds `accepts`/`StorePolicy`; #100 adds one variant + wires it |
| "daily netWorth adds storehouse stores" against the hand-built `stores` array (`ledger.ts:211-213`) — the silent-omission risk | `computeNetWorth` walks `companyStores`; registering the Storehouse is **data, not a new guarded code path** | **E13.0** builds the walk + invariant; #100 registers a member |
| goods movement written ad hoc | the `Transfer` primitive | **E13.0** builds it; #100 expresses store/withdraw as Transfers |
| — | `resolveDeliveryTarget` seam already extracted | **E13.0** extracted it; #100 *replaces* it with `StoreRef` addressing (a swap, not an invention) |

## Countable scope delta (per the "count items, not LOC" rule)

- **Deleted outright from #100 (~4):** typed site registry (union + exhaustive switch);
  the "not an array" constraint; per-kind netWorth coverage tests; the "quote the compiler
  error" deliverable.
- **Moved out of #100 into E13.0 (~4):** the `GoodsStore` type; the `Transfer` primitive;
  the `accepts` / `StorePolicy` machinery; the `computeNetWorth`-over-`companyStores` walk
  + value-neutrality invariant.

## What #100 still owns (the shrink is not to zero)

`CompanyBuilding` + Granary variant and `commissionGuildBuilding`; `storeGood` /
`withdrawGood` commands (built **on** `Transfer`); `StopOrder` kind union += store/withdraw
+ docking-phase execution; explicit `StoreRef` addressing and deleting
`resolveDeliveryTarget`; Ledger `store` / `withdraw` kinds; the `buildingStoreValue`
netWorth field + `SAVE_VERSION` 14 migration (OQ8); the one-active-order law via the
existing helper; and the TDD suite (clamps/filter, route–manual parity, byte-equal Ledger,
save/load round-trip).

## Interim verdict

On scope evidence the bet's **direction holds**: the invent-a-mechanism parts — the store
abstraction and the omission guard, which are the hard, high-risk parts — moved out of #100
into E13.0, and one whole guard sub-project (the typed site registry) was deleted outright.
#100's residual scope is *wiring the Storehouse onto pre-built primitives*. That is a
visible reduction in **scope and risk**, sourced from the issue's own AC history rather than
a feeling.

The claim this note does **not** make: that #100's shipped line count is smaller than some
counterfactual. That number does not exist yet.

## At E13 close, do this

Record the merged `#100` PR's diff size (sim + tests), then compare against the pre-E13.0
projection — which would have carried the `GoodsStore`/`Transfer`/`accepts` abstraction
**plus** the typed-site-registry guard **plus** per-kind coverage tests, none of which the
post-E13.0 #100 contains. Only then flip this note to a definitive result (confirm or
falsify) and retire the bet. Until then it stays LIVE.
