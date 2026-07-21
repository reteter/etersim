import { GOOD_IDS, type GoodId } from "./goods";

/**
 * E13.0 (#307, docs/adr/0008-one-goods-store.md; docs/specs/E13.0-goods-store.md
 * §Tech — the store): every place goods can sit — a Ship's Cargo, a
 * construction site's materials, a Building's contents — is one encapsulated
 * `GoodsStore`. It is an **opaque alias over today's on-disk
 * `Record<GoodId, number>`**: same JSON, same runtime object, but the
 * non-exported `unique symbol` brand below forbids every consumer outside
 * this module from touching contents directly (dotted access, dynamic
 * indexing, raw-literal construction — all compile errors; proven by
 * `goodsStore.typeguard.ts`). Reachable only through the six functions
 * below — CONTEXT.md: Goods store.
 *
 * `tsconfig.app.json` sets `noEmit` with no declaration emit, so the usual
 * "exported type uses private name" objection to `unique symbol` brands does
 * not apply here (verified against this repo's own `tsc` before adoption,
 * ADR-0008).
 */
declare const HELD: unique symbol;
export type GoodsStore = { readonly [HELD]: true };

/** The real on-disk shape `GoodsStore` brands over — private to this module;
 *  every other file reaches contents only through the accessors below. */
type Contents = Record<GoodId, number>;

function asContents(store: GoodsStore): Contents {
  return store as unknown as Contents;
}

function asStore(contents: Contents): GoodsStore {
  return contents as unknown as GoodsStore;
}

/** A store with every GoodId at 0, filled in `GOOD_IDS` order (determinism —
 *  spec §Persistence and determinism: a fresh store's JSON key order is
 *  canonical). The `emptyCargo()`/`emptySiteStore()` wrappers (`ship.ts`,
 *  `building.ts`) keep call sites unchanged. */
export function emptyStore(): GoodsStore {
  const contents = {} as Contents;
  for (const good of GOOD_IDS) contents[good] = 0;
  return asStore(contents);
}

/** A store built from a partial map, zero-filled in `GOOD_IDS` order for
 *  every good not named — never `Object.keys(partial)` order, so the result
 *  is canonical regardless of what order the caller wrote its literal in. */
export function storeOf(partial: Partial<Record<GoodId, number>>): GoodsStore {
  const contents = {} as Contents;
  for (const good of GOOD_IDS) contents[good] = partial[good] ?? 0;
  return asStore(contents);
}

/** The quantity of `good` held, 0 if absent (defensive — every store built by
 *  `emptyStore`/`storeOf` is already fully zero-filled). */
export function amountOf(store: GoodsStore, good: GoodId): number {
  return asContents(store)[good] ?? 0;
}

/** A new store with `qty` more of `good` (every other good unchanged, input
 *  untouched — pure). Object-spread, so a store parsed from JSON keeps the
 *  file's key order for every already-present good (spec §Persistence,
 *  hazard 1) — harmless, since no production code ever iterates a store's
 *  own keys instead of `GOOD_IDS`. */
export function withAdded(store: GoodsStore, good: GoodId, qty: number): GoodsStore {
  const contents = asContents(store);
  return asStore({ ...contents, [good]: (contents[good] ?? 0) + qty });
}

/** A new store with `qty` less of `good`. Does not clamp at zero — matches
 *  the pre-refactor spread's un-clamped subtraction exactly (every existing
 *  caller already validates `qty <= amountOf(store, good)` before calling
 *  this, e.g. `accepts`/`applyTrade`'s own checks). */
export function withRemoved(store: GoodsStore, good: GoodId, qty: number): GoodsStore {
  const contents = asContents(store);
  return asStore({ ...contents, [good]: (contents[good] ?? 0) - qty });
}

/** The sum of every good held, folded in `GOOD_IDS` order (spec §Persistence,
 *  hazard 2 — fixed fold order). The `cargoUsed(ship)` fold, generalized. */
export function totalHeld(store: GoodsStore): number {
  return GOOD_IDS.reduce((sum, good) => sum + amountOf(store, good), 0);
}
