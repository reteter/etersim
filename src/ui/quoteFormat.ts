/**
 * Shared thaler-quote formatter (PortPanel.tsx, PriceBoardOverlay.tsx):
 * renders a quote total/unit price, or "—" when the good isn't tradable
 * (quoteBuy/quoteSell returned null — e.g. zero stock).
 */
export function quoteLabel(value: number | null): string {
  return value === null ? "—" : `₸${value}`;
}
