import { useState } from "react";
import {
  cargoUsed,
  GOOD_IDS,
  GOODS,
  price,
  quoteBuy,
  quoteSell,
  type GoodId,
  type MarketGood,
  type Port,
  type PortId,
  type Region,
  type Ship,
  type ShipId,
} from "../sim";
import { useGameStore } from "../store/gameStore";
import { priceTrend, type Trend } from "./priceTrend";
import { previewRouteTicks } from "./routePreview";

const TREND_GLYPH: Record<Trend, string> = { up: "▲", down: "▼", flat: "–" };

/** Compact cargo summary for a Harbor hover tooltip, e.g. "Grain 5, Iron 2". */
function cargoSummary(ship: Ship): string {
  const held = GOOD_IDS.filter((good) => ship.cargo[good] > 0).map(
    (good) => `${GOODS[good].name} ${ship.cargo[good]}`,
  );
  return held.length === 0 ? "empty" : held.join(", ");
}

/**
 * Harbor section (CONTEXT.md; #28): the player's Ships docked at this Port,
 * shown above the market. Each entry designates the ship as Controlled and
 * opens its ShipPanel on click; the current Controlled Ship is highlighted.
 * Other companies' ships are not modelled in E2, so only the player's
 * subsection renders for now.
 */
function Harbor({
  port,
  ships,
  controlledShipId,
}: {
  port: Port;
  ships: readonly Ship[];
  controlledShipId: ShipId | null;
}) {
  const openShip = useGameStore((s) => s.openShip);
  const docked = ships.filter(
    (s) => s.location.kind === "docked" && s.location.portId === port.id,
  );

  return (
    <div className="harbor">
      <h3 className="side-panel__heading">Harbor</h3>
      {docked.length === 0 ? (
        <p className="side-panel__hint">No ships docked here.</p>
      ) : (
        <ul className="harbor__list">
          {docked.map((ship) => {
            const controlled = ship.id === controlledShipId;
            return (
              <li key={ship.id}>
                <button
                  type="button"
                  className={controlled ? "harbor__ship harbor__ship--controlled" : "harbor__ship"}
                  title={`Hold ${cargoUsed(ship)}/${ship.hold} • ${cargoSummary(ship)}`}
                  onClick={() => openShip(ship.id)}
                >
                  <span className="harbor__glyph" aria-hidden="true">
                    ⛵
                  </span>
                  <span className="harbor__id">{ship.id}</span>
                  <span className="harbor__hold">
                    {cargoUsed(ship)}/{ship.hold}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Marginal quote total, or "—" when the quantity is not tradable. */
function quoteLabel(total: number | null): string {
  return total === null ? "—" : `₸${total}`;
}

/**
 * One good's market row: price, trend arrow vs. the last day snapshot and
 * stock — plus buy/sell controls with a live marginal quote when the
 * player's ship is docked here (docs/specs/E2-trade-loop.md — Market model).
 */
function MarketRow({
  good,
  entry,
  snapshotPrice,
  ship,
  thalers,
  trading,
}: {
  good: GoodId;
  entry: MarketGood;
  snapshotPrice: number;
  ship: Ship;
  thalers: number;
  trading: boolean;
}) {
  const dispatch = useGameStore((s) => s.dispatch);
  const [qty, setQty] = useState(1);

  const unitPrice = price(good, entry);
  const trend = priceTrend(unitPrice, snapshotPrice);

  const buyTotal = trading ? quoteBuy(good, entry, qty) : null;
  const sellTotal = trading ? quoteSell(good, entry, qty) : null;

  const canBuy =
    buyTotal !== null && buyTotal <= thalers && cargoUsed(ship) + qty <= ship.hold;
  const canSell = sellTotal !== null && ship.cargo[good] >= qty;

  return (
    <div className="market-row">
      <div className="market-row__head">
        <span className="market-row__name">{GOODS[good].name}</span>
        <span className={`market-row__price market-row__price--${trend}`}>
          {TREND_GLYPH[trend]} ₸{Math.round(unitPrice)}
        </span>
        <span className="market-row__stock">{Math.floor(entry.stock)}</span>
      </div>
      {trading && (
        <div className="market-row__trade">
          <input
            className="market-row__qty"
            type="number"
            min={1}
            step={1}
            value={qty}
            aria-label={`${GOODS[good].name} quantity`}
            onChange={(e) => setQty(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
          />
          <button
            type="button"
            disabled={!canBuy}
            onClick={() => dispatch({ kind: "buy", shipId: ship.id, good, qty })}
          >
            Buy {quoteLabel(buyTotal)}
          </button>
          <button
            type="button"
            disabled={!canSell}
            onClick={() => dispatch({ kind: "sell", shipId: ship.id, good, qty })}
          >
            Sell {quoteLabel(sellTotal)}
          </button>
        </div>
      )}
    </div>
  );
}

/** Sail-here control shown when the player's ship is docked at another port. */
function SailControl({ ship, portId, region }: { ship: Ship; portId: PortId; region: Region }) {
  const dispatch = useGameStore((s) => s.dispatch);

  if (ship.location.kind !== "docked") {
    return <p className="side-panel__hint">Ship is underway — dock to trade or sail.</p>;
  }

  const eta = previewRouteTicks(region, ship.location.portId, portId);
  if (eta === null) return null;

  return (
    <button
      type="button"
      className="sail-btn"
      onClick={() => dispatch({ kind: "sailTo", shipId: ship.id, portId })}
    >
      Sail here (~{eta} ticks)
    </button>
  );
}

/**
 * Contextual panel for a selected port (docs/specs/E2-trade-loop.md — UI
 * layout): the live market table, trading when the ship is docked here,
 * read-only with a sail control otherwise.
 */
export function PortPanel({ portId }: { portId: PortId }) {
  const world = useGameStore((s) => s.world);
  const controlledShipId = useGameStore((s) => s.controlledShipId);
  if (!world) return null;

  const port = world.region.ports.find((p) => p.id === portId);
  if (!port) return null;

  // Commands target the Controlled Ship (CONTEXT.md); fall back to the first
  // ship if none is designated yet.
  const ship =
    world.company.ships.find((s) => s.id === controlledShipId) ?? world.company.ships[0];
  if (!ship) return null;
  const dockedHere = ship.location.kind === "docked" && ship.location.portId === port.id;
  const snapshot = world.priceSnapshots[port.id];

  return (
    <>
      <h2 className="side-panel__title">{port.name}</h2>
      <p className="side-panel__subtitle">{port.archetype}</p>

      <Harbor port={port} ships={world.company.ships} controlledShipId={controlledShipId} />

      <div className="market" role="table" aria-label={`${port.name} market`}>
        <div className="market__header" role="row">
          <span>Good</span>
          <span>Price</span>
          <span>Stock</span>
        </div>
        {GOOD_IDS.map((good) => (
          <MarketRow
            key={good}
            good={good}
            entry={port.market[good]}
            snapshotPrice={snapshot[good]}
            ship={ship}
            thalers={world.company.thalers}
            trading={dockedHere}
          />
        ))}
      </div>

      {!dockedHere && <SailControl ship={ship} portId={port.id} region={world.region} />}
    </>
  );
}
