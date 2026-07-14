import { useEffect } from "react";
import type { MouseEvent } from "react";

/**
 * Standard overlay dismissal (#126, fresh-eyes playtest 2026-07-12 item 6):
 * Esc closes the overlay from anywhere, and clicking the backdrop — the
 * `.overlay` shell, outside `.overlay__panel` — closes it too. A click that
 * starts inside the panel never has the backdrop `<div>` as its event
 * target, so nothing here needs `stopPropagation` to protect it.
 *
 * Shared because every current overlay built on `OverlayShell`
 * (PriceBoardOverlay, LedgerOverlay, HeadquartersPanel; #181) renders the
 * same `.overlay` > `.overlay__panel` shape — `OverlayShell` wires
 * `onBackdropClick` onto that outer `<div>` once, so individual overlays no
 * longer call this hook directly. CreditsOverlay and OptionsOverlay share
 * the shape too but are deliberately left untouched — out of scope for
 * #126/#181.
 */
export function useOverlayDismiss(onClose: () => void) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const onBackdropClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  return { onBackdropClick };
}
