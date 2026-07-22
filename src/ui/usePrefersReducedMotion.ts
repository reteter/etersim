import { useEffect, useState } from "react";

/**
 * True while the user's OS/browser requests reduced motion. Read once at
 * mount plus a live listener (Playwright's `emulateMedia` sets this before
 * `page.goto`, so the initial `matchMedia` read already reflects it in E2E).
 *
 * Extracted (E16 #392) from `RegionMap.tsx`'s original local hook (#69 review
 * precedent, carried over from the ambient osmosis pulses this glyph
 * replaced) so `RouteRibbon`'s ship-glide animation shares the exact same
 * reduced-motion read instead of re-declaring it.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return reduced;
}
