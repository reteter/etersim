import type { ReactNode } from "react";
import { useOverlayDismiss } from "./useOverlayDismiss";

/**
 * Shared overlay frame (#181, professor-review-ui-store-2026-07-14 Finding 2):
 * backdrop + panel + title + Close, with a body that owns the max-height/
 * scroll region ONCE. Before this, every overlay (LedgerOverlay,
 * HeadquartersPanel, PriceBoardOverlay) hand-rolled `.overlay > .overlay__panel
 * > {title, body, Close}` and bolted its own scroll onto an inner list
 * (`.price-board`, `.ledger-list`) — `.overlay__panel` itself had no
 * max-height, so a long list (many-Stop Trasy routes, #176) grew the panel
 * past the viewport; centered layout clipped both ends and made Save/Cancel
 * unreachable. Here the panel is height-bounded (viewport-relative) and only
 * `.overlay__body` scrolls — title, tabs and Close stay pinned outside that
 * region and are always reachable.
 *
 * `useOverlayDismiss` (Esc + backdrop click, #126) is wired here so callers
 * no longer each re-derive `onBackdropClick`.
 */
export function OverlayShell({
  ariaLabel,
  title,
  onClose,
  wide = false,
  tabs,
  children,
}: {
  ariaLabel: string;
  title: string;
  onClose: () => void;
  /** Wider panel variant (#62 price board, #86 ledger, #84/#85 headquarters —
   *  all need more room than the Options/Credits dialogs). */
  wide?: boolean;
  /** Optional tab strip rendered between the title and the scrolling body
   *  (e.g. `<Tabs .../>`) — stays pinned outside the scroll region. */
  tabs?: ReactNode;
  children: ReactNode;
}) {
  const { onBackdropClick } = useOverlayDismiss(onClose);

  return (
    <div className="overlay" role="dialog" aria-label={ariaLabel} aria-modal="true" onClick={onBackdropClick}>
      <div className={wide ? "overlay__panel overlay__panel--wide" : "overlay__panel"}>
        <h2 className="overlay__title">{title}</h2>
        {tabs}
        <div className="overlay__body">{children}</div>
        <button type="button" className="menu-btn" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
