/**
 * CC BY attribution overlay (#34, docs/adr/0006-svg-icon-strategy.md): lists
 * the vendored icon set's source and authors. Reached via the "Credits"
 * button in the top-bar menu (GameMenu.tsx).
 */
export function CreditsOverlay({ onClose }: { onClose: () => void }) {
  return (
    <div className="overlay" role="dialog" aria-label="Autorzy" aria-modal="true">
      <div className="overlay__panel">
        <h2 className="overlay__title">Autorzy</h2>
        <p className="overlay__text">
          Ikony statków i portów:{" "}
          <a href="https://game-icons.net/1x1/lorc/galleon.html" target="_blank" rel="noreferrer">
            Lorc
          </a>{" "}
          oraz{" "}
          <a
            href="https://game-icons.net/1x1/delapouite/modern-city.html"
            target="_blank"
            rel="noreferrer"
          >
            Delapouite
          </a>
          , z{" "}
          <a href="https://game-icons.net" target="_blank" rel="noreferrer">
            game-icons.net
          </a>
          , na licencji{" "}
          <a href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noreferrer">
            CC BY 3.0
          </a>
          .
        </p>
        <p className="overlay__text">
          Ikony towarów: Zboże (
          <a href="https://game-icons.net/1x1/lorc/triple-corn.html" target="_blank" rel="noreferrer">
            Triple corn
          </a>
          ) oraz Sól eteryczna (
          <a
            href="https://game-icons.net/1x1/lorc/crystal-cluster.html"
            target="_blank"
            rel="noreferrer"
          >
            Crystal cluster
          </a>
          ) oraz Elektronika (
          <a href="https://game-icons.net/1x1/lorc/microchip.html" target="_blank" rel="noreferrer">
            Microchip
          </a>
          ) autorstwa Lorc; Tekstylia (
          <a href="https://game-icons.net/1x1/delapouite/wool.html" target="_blank" rel="noreferrer">
            Wool
          </a>
          ) oraz Drewno (
          <a
            href="https://game-icons.net/1x1/delapouite/wood-pile.html"
            target="_blank"
            rel="noreferrer"
          >
            Wood pile
          </a>
          ) autorstwa Delapouite, z{" "}
          <a href="https://game-icons.net" target="_blank" rel="noreferrer">
            game-icons.net
          </a>
          , na licencji{" "}
          <a href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noreferrer">
            CC BY 3.0
          </a>
          .
        </p>
        <button type="button" className="menu-btn" onClick={onClose}>
          Zamknij
        </button>
      </div>
    </div>
  );
}
