import { GOOD_IDS, GOODS, SHIP_RECIPE, type GoodId } from "../sim";

/**
 * Per-good progress bar for a construction site (docs/specs/E9 — Budowa tab:
 * "active Build Order per-good progress"; PortPanel's Headquarters section:
 * "per-good build progress bar"). Shared by `HeadquartersPanel.tsx` and
 * `PortPanel.tsx` — one rendering, several entrances (UX skeleton).
 *
 * `recipe` defaults to `SHIP_RECIPE` (the Headquarters Build Order, the
 * original caller); E14's Shipyard section passes `SHIPYARD_RECIPE` (the
 * Shipyard's own build) or `refitRecipe(ship)` (an active Refit) so the same
 * bar renders every ConstructionSite the ConstructionSite engine backs
 * (docs/specs/E14 — "mirror … the Budowa tab's site widgets"). Goods absent
 * from a recipe (a zero-need line) render as complete, so a refit recipe with
 * a zero for some good doesn't show a stuck 0/0 bar.
 */
export function BuildProgress({
  siteStore,
  recipe = SHIP_RECIPE,
}: {
  siteStore: Record<GoodId, number>;
  recipe?: Record<GoodId, number>;
}) {
  return (
    <div className="headquarters-progress">
      {GOOD_IDS.map((good) => {
        const have = siteStore[good] ?? 0;
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
