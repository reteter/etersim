/**
 * The five E2 goods (docs/specs/E2-trade-loop.md — Goods). Base prices form
 * the affordability ladder: grain runs first, timber freight as the horizon.
 */

export type GoodId = "grain" | "textiles" | "aetherSalt" | "electronics" | "timber";

export interface GoodDef {
  readonly id: GoodId;
  readonly name: string;
  /** Price in thalers at equilibrium stock. */
  readonly basePrice: number;
}

/** Canonical iteration order for all market math (determinism: never
 *  iterate object keys). Sorted by base price, cheapest first. */
export const GOOD_IDS: readonly GoodId[] = [
  "grain",
  "textiles",
  "aetherSalt",
  "electronics",
  "timber",
];

export const GOODS: Record<GoodId, GoodDef> = {
  grain: { id: "grain", name: "Grain", basePrice: 10 },
  textiles: { id: "textiles", name: "Textiles", basePrice: 40 },
  aetherSalt: { id: "aetherSalt", name: "Aether Salt", basePrice: 60 },
  electronics: { id: "electronics", name: "Electronics", basePrice: 150 },
  // Living wood is one of the rarest materials in the aether — timber is
  // a luxury freight here, not a building commodity (owner's setting call).
  timber: { id: "timber", name: "Timber", basePrice: 250 },
};
