import type { GoodsStore } from "./goodsStore";

/**
 * E13.0 (#307, docs/adr/0008-one-goods-store.md; docs/specs/E13.0-goods-store.md
 * §Tech — the store): compile-time proof that `GoodsStore`'s opacity actually
 * holds outside `goodsStore.ts`. Three `@ts-expect-error` fixtures — dotted
 * access, dynamic access, raw-literal assignment — each of which must be a
 * compile error; TypeScript itself makes an *unused* `@ts-expect-error` a
 * build failure, so this file is self-red-evidencing (removing the brand, or
 * widening the accessors, turns one of these lines green and the build
 * fails). Sits inside `tsconfig.app.json`'s `include: ["src"]`, so
 * `npm run typecheck` — an existing merge gate — enforces it on every push.
 *
 * Never imported by anything; exists purely for the compiler to walk.
 */

declare const someStore: GoodsStore;

// 1. Dotted access — `GoodsStore` carries no `GoodId`-named properties.
// @ts-expect-error — GoodsStore is opaque: no dotted property access outside goodsStore.ts
void someStore.grain;

// 2. Dynamic/indexed access — same opacity, via a computed key.
declare const dynamicKey: string;
// @ts-expect-error — GoodsStore is opaque: no indexed access outside goodsStore.ts
void someStore[dynamicKey];

// 3. Raw-literal assignment — a plain `Record<GoodId, number>` literal is not
//    a `GoodsStore` (it lacks the private brand), so constructing one bypasses
//    `emptyStore`/`storeOf` and must fail to typecheck.
// @ts-expect-error — a raw object literal is not a GoodsStore outside goodsStore.ts
const rawLiteral: GoodsStore = { grain: 0, textiles: 0, aetherSalt: 0, electronics: 0, timber: 0 };
void rawLiteral;
