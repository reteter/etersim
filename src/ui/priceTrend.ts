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

/** Shared trend glyphs (PortPanel.tsx, PriceBoardOverlay.tsx). */
export const TREND_GLYPH: Record<Trend, string> = { up: "▲", down: "▼", flat: "=" };

/**
 * Trend legend text (#127): a fresh player read `▲/▼` as "vs the starting
 * price" and found `=` opaque. States the real comparison (the last
 * day-boundary snapshot, not the initial price), the window, and what `=`
 * means. Shared by PortPanel.tsx and PriceBoardOverlay.tsx so both surfaces
 * carry identical wording (Polish, 2026-07-14 UI grill).
 */
export const TREND_LEGEND =
  "Trend: ▲ cena wzrosła, ▼ spadła, = bez zmian — względem ostatniej granicy dnia (nie ceny początkowej), zaokrąglone do pełnych thalerów.";
