/**
 * CC BY attribution overlay (#34, docs/adr/0006-svg-icon-strategy.md): lists
 * the vendored icon set's source and authors. Reached via the "Credits"
 * button in the top-bar menu (GameMenu.tsx).
 */
export function CreditsOverlay({ onClose }: { onClose: () => void }) {
  return (
    <div className="credits-overlay" role="dialog" aria-label="Credits" aria-modal="true">
      <div className="credits-overlay__panel">
        <h2 className="credits-overlay__title">Credits</h2>
        <p className="credits-overlay__text">
          Ship and port icons by{" "}
          <a href="https://game-icons.net/1x1/lorc/galleon.html" target="_blank" rel="noreferrer">
            Lorc
          </a>{" "}
          and{" "}
          <a
            href="https://game-icons.net/1x1/delapouite/modern-city.html"
            target="_blank"
            rel="noreferrer"
          >
            Delapouite
          </a>
          , from{" "}
          <a href="https://game-icons.net" target="_blank" rel="noreferrer">
            game-icons.net
          </a>
          , licensed under{" "}
          <a href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noreferrer">
            CC BY 3.0
          </a>
          .
        </p>
        <button type="button" className="menu-btn" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
