import { amountOf, GOOD_IDS, GOODS, SHIP_RECIPE, type GoodId, type GoodsStore } from "../sim";

/**
 * Per-good progress bar for an active construction site (docs/specs/E9 —
 * Budowa tab: "active Build Order per-good progress"; PortPanel's
 * Headquarters section: "per-good build progress bar"). Shared by
 * `HeadquartersPanel.tsx` and `PortPanel.tsx` — one rendering, several
 * entrances (UX skeleton). `recipe` defaults to `SHIP_RECIPE` (the original,
 * ship-construction-only shape) so existing callers are unaffected;
 * `PortPanel`'s Shipyard section (#276) passes `SHIPYARD_RECIPE` or a live
 * `refitRecipe(ship)` instead, so the bar reads the right per-good totals for
 * whichever site is active.
 */
export function BuildProgress({
  siteStore,
  recipe = SHIP_RECIPE,
}: {
  siteStore: GoodsStore;
  recipe?: Record<GoodId, number>;
}) {
  return (
    <div className="headquarters-progress">
      {GOOD_IDS.map((good) => {
        const have = amountOf(siteStore, good);
        // Defensive (#292): a caller's recipe (e.g. a Refit's ladder step)
        // isn't guaranteed to carry every GoodId at a positive quantity —
        // don't rely on the full-recipe invariant holding forever.
        const need = recipe[good] ?? 0;
        const pct = need > 0 ? Math.min(100, (have / need) * 100) : 100;
        return (
          <div key={good} className="headquarters-progress__row">
            <span className="headquarters-progress__label">{GOODS[good].name}</span>
            <div
              className="headquarters-progress__bar"
              role="progressbar"
              aria-label={`${GOODS[good].name} build progress`}
              aria-valuenow={have}
              aria-valuemin={0}
              aria-valuemax={need}
            >
              <div className="headquarters-progress__fill" style={{ width: `${pct}%` }} />
            </div>
            <span className="headquarters-progress__count">
              {have}/{need}
            </span>
          </div>
        );
      })}
    </div>
  );
}
