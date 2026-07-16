/**
 * CC BY attribution overlay (#34, docs/adr/0006-svg-icon-strategy.md): lists
 * the vendored icon set's source and authors. Reached via the "Credits"
 * button in the top-bar menu (GameMenu.tsx).
 */
export function CreditsOverlay({ onClose }: { onClose: () => void }) {
  return (
    <div className="overlay" role="dialog" aria-label="Credits" aria-modal="true">
      <div className="overlay__panel">
        <h2 className="overlay__title">Credits</h2>
        <p className="overlay__text">
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
        <p className="overlay__text">
          Good icons: Grain (
          <a href="https://game-icons.net/1x1/lorc/triple-corn.html" target="_blank" rel="noreferrer">
            Triple corn
          </a>
          ) and Aether Salt (
          <a
            href="https://game-icons.net/1x1/lorc/crystal-cluster.html"
            target="_blank"
            rel="noreferrer"
          >
            Crystal cluster
          </a>
          ) and Electronics (
          <a href="https://game-icons.net/1x1/lorc/microchip.html" target="_blank" rel="noreferrer">
            Microchip
          </a>
          ) by Lorc; Textiles (
          <a href="https://game-icons.net/1x1/delapouite/wool.html" target="_blank" rel="noreferrer">
            Wool
          </a>
          ) and Timber (
          <a
            href="https://game-icons.net/1x1/delapouite/wood-pile.html"
            target="_blank"
            rel="noreferrer"
          >
            Wood pile
          </a>
          ) by Delapouite, from{" "}
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
