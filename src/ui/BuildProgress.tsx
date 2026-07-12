import { GOOD_IDS, GOODS, SHIP_RECIPE, type GoodId } from "../sim";

/**
 * Per-good progress bar for the active Build Order (docs/specs/E9 — Budowa
 * tab: "active Build Order per-good progress"; PortPanel's Headquarters
 * section: "per-good build progress bar"). Shared by `HeadquartersPanel.tsx`
 * and `PortPanel.tsx` — one rendering, two entrances (UX skeleton).
 */
export function BuildProgress({ siteStore }: { siteStore: Record<GoodId, number> }) {
  return (
    <div className="headquarters-progress">
      {GOOD_IDS.map((good) => {
        const have = siteStore[good] ?? 0;
        const need = SHIP_RECIPE[good];
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
