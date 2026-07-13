/**
 * Which constraint binds the current Buy max — hold space, port stock, or
 * thalers (fresh-eyes playtest, #124: a capped Buy gave no reason, so a
 * player with a full hold concluded the game was broken).
 *
 * `computeBuyMax` (PortPanel.tsx) walks `quoteBuy` up to
 * `min(holdSpace, stock)`, breaking early only when the running total
 * exceeds `thalers` — so `buyMax` reaching that structural cap means
 * hold/stock bound it; falling short means thalers broke the walk first.
 */
export type BuyCapReason = "hold" | "stock" | "thalers";

/**
 * `holdSpace` and `stock` are the same integers `computeBuyMax` capped its
 * walk at (`ship.hold - cargoUsed(ship)`, `Math.floor(entry.stock)`);
 * `buyMax` is its result. Ties between hold and stock favour hold — the
 * exact constraint the reported playtest hit (hold space 0).
 */
export function buyCapReason(holdSpace: number, stock: number, buyMax: number): BuyCapReason {
  const structuralCap = Math.min(holdSpace, stock);
  if (buyMax < structuralCap) return "thalers";
  return holdSpace <= stock ? "hold" : "stock";
}

/**
 * Player-facing hint text for a binding reason, near the Buy control
 * (docs/design-notes/playtest-2026-07-12-fresh-eyes-kacper.md item 5).
 * Zero-remaining hold/stock get the blunter phrasing that matches the
 * reported case (hold 50/50 → "Hold full"); a >0 binding constraint
 * reports the room left, since it isn't literally full/empty.
 */
export function buyCapHint(reason: BuyCapReason, holdSpace: number, stock: number): string {
  switch (reason) {
    case "hold":
      return holdSpace <= 0 ? "Hold full" : `Only ${holdSpace} hold space left`;
    case "stock":
      return stock <= 0 ? "Out of stock" : `Only ${stock} in stock`;
    case "thalers":
      return "Not enough thalers";
  }
}
