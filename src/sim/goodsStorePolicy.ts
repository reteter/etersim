import type { GoodId } from "./goods";
import { amountOf, totalHeld, type GoodsStore } from "./goodsStore";

/**
 * E13.0 (#307, docs/adr/0008-one-goods-store.md; docs/specs/E13.0-goods-store.md
 * §Tech — Policy): the receiving store owns the policy — goods filter,
 * capacity, remaining need — expressed as a discriminated union **derived at
 * the point of use, never serialized** (a stored closure would not survive
 * ADR-0004's `JSON.stringify`). `hold`'s capacity is always `Ship.hold`,
 * passed in by the caller (Refit mutates it, `shipyard.ts:290-291` — never a
 * second stored copy, ADR-0008). `constructionSite`'s recipe is likewise
 * always recomputed live (e.g. `refitRecipe(ship)`), never stored on the
 * policy itself.
 *
 * `noFallthroughCasesInSwitch` (tsconfig.app.json) plus the exhaustive
 * `never` check in `accepts` makes an unhandled `kind` a compile error —
 * this is deliberately NOT the rejected site registry (ADR-0008, owner
 * ruling OQ4): one union consumed by one function answering "what do I
 * accept", not a registry consumed by five subsystems.
 */
export type StorePolicy =
  | { readonly kind: "hold"; readonly capacity: number }
  | { readonly kind: "constructionSite"; readonly recipe: Record<GoodId, number> };
// E13: | { kind: "storehouse"; filter: readonly GoodId[]; capacity: number }
// E15: | { kind: "plantInput"; chain: ChainId; capacity: number }
//      | { kind: "plantOutput"; good: GoodId; capacity: number }

/**
 * The single home for goods filter + capacity + remaining need: given a
 * proposed `qty` of `good` offered to `store` under `policy`, returns how
 * much would actually be accepted right now (never more than `qty`, never
 * negative). Pure; callers (`transfer.ts`'s `moveOwnGoods`,
 * `resolveDeliveryTarget`) use the returned amount both to decide whether a
 * site accepts a good at all (`> 0`) and to clamp the actual transfer.
 */
export function accepts(store: GoodsStore, policy: StorePolicy, good: GoodId, qty: number): number {
  if (qty <= 0) return 0;
  switch (policy.kind) {
    case "hold": {
      const remaining = Math.max(0, policy.capacity - totalHeld(store));
      return Math.min(qty, remaining);
    }
    case "constructionSite": {
      const remaining = Math.max(0, (policy.recipe[good] ?? 0) - amountOf(store, good));
      return Math.min(qty, remaining);
    }
    default: {
      const exhaustive: never = policy;
      throw new Error(`accepts: unhandled StorePolicy kind ${JSON.stringify(exhaustive)}`);
    }
  }
}
