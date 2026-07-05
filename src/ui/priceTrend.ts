/**
 * Price trend vs. the last day-boundary snapshot (docs/specs/E2-trade-loop.md
 * — Market model: "each price shows a trend arrow"). Compares the rounded
 * displayed thaler prices so a sub-thaler drift never flips the arrow.
 */
export type Trend = "up" | "down" | "flat";

export function priceTrend(current: number, snapshot: number): Trend {
  const c = Math.round(current);
  const s = Math.round(snapshot);
  if (c > s) return "up";
  if (c < s) return "down";
  return "flat";
}
