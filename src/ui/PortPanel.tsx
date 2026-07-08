import { useState } from "react";
import {
  cargoUsed,
  effectiveBase,
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
import { ShipIcon } from "./icons";
import { priceTrend, type Trend } from "./priceTrend";
import { previewRouteTicks } from "./routePreview";

const TREND_GLYPH: Record<Trend, string> = { up: "▲", down: "▼", flat: "=" };

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
                  <ShipIcon
                    className={
                      controlled ? "harbor__glyph harbor__glyph--controlled" : "harbor__glyph"
                    }
                  />
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

/** Inline "(₸n/u)" hint for the next single unit's marginal price, or "" when untradable. */
function unitHint(total: number | null): string {
  return total === null ? "" : ` (₸${total}/u)`;
}

/**
 * Largest buyable quantity: bounded by available stock and hold space, then
 * walked unit-by-unit (via `quoteBuy`, which itself sums the marginal price
 * per unit) to find the most units affordable within `thalers`. The walk is
 * capped at `min(stock, hold space)` up front, so it's bounded by the ship's
 * hold size regardless of market stock (docs/specs/E2-trade-loop.md — Buy /
 * sell improvements).
 */
function computeBuyMax(entry: MarketGood, base: number, ship: Ship, thalers: number): number {
  const cap = Math.min(Math.floor(entry.stock), ship.hold - cargoUsed(ship));
  let max = 0;
  for (let qty = 1; qty <= cap; qty++) {
    const total = quoteBuy(entry, base, qty);
    if (total === null || total > thalers) break;
    max = qty;
  }
  return max;
}

/** Largest sellable quantity: held cargo, bounded by what `quoteSell` accepts. */
function computeSellMax(entry: MarketGood, base: number, ship: Ship, good: GoodId): number {
  const held = ship.cargo[good];
  return held > 0 && quoteSell(entry, base, held) !== null ? held : 0;
}

/**
 * One good's market row: price, trend arrow vs. the last day snapshot and
 * stock — plus buy/sell controls with a live marginal quote when the
 * player's ship is docked here (docs/specs/E2-trade-loop.md — Market model).
 */
function MarketRow({
  good,
  entry,
  base,
  snapshotPrice,
  ship,
  thalers,
  trading,
}: {
  good: GoodId;
  entry: MarketGood;
  /** The port's effective base price for this good (E8 price bias). */
  base: number;
  snapshotPrice: number;
  ship: Ship;
  thalers: number;
  trading: boolean;
}) {
  const dispatch = useGameStore((s) => s.dispatch);
  const [qty, setQty] = useState(1);

  const unitPrice = price(entry, base);
  const trend = priceTrend(unitPrice, snapshotPrice);

  const buyMax = trading ? computeBuyMax(entry, base, ship, thalers) : 0;
  const sellMax = trading ? computeSellMax(entry, base, ship, good) : 0;
  // Qty is shared by both actions, so it's clamped to whichever side allows
  // more — each button still disables independently via canBuy/canSell.
  const maxQty = Math.max(buyMax, sellMax);
  const clampQty = (n: number) => (maxQty <= 0 ? 0 : Math.min(Math.max(n, 1), maxQty));
  const clampedQty = clampQty(qty);

  const buyTotal = trading ? quoteBuy(entry, base, clampedQty) : null;
  const sellTotal = trading ? quoteSell(entry, base, clampedQty) : null;
  const nextBuyUnit = trading ? quoteBuy(entry, base, 1) : null;
  const nextSellUnit = trading ? quoteSell(entry, base, 1) : null;

  const canBuy =
    clampedQty > 0 &&
    buyTotal !== null &&
    buyTotal <= thalers &&
    cargoUsed(ship) + clampedQty <= ship.hold;
  const canSell = clampedQty > 0 && sellTotal !== null && ship.cargo[good] >= clampedQty;

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
        <>
          <div className="market-row__trade">
            <input
              className="market-row__qty"
              type="number"
              min={1}
              step={1}
              value={clampedQty}
              disabled={maxQty <= 0}
              aria-label={`${GOODS[good].name} quantity`}
              onChange={(e) => setQty(clampQty(Math.floor(Number(e.target.value) || 0)))}
            />
            <button
              type="button"
              disabled={buyMax <= 0}
              aria-label={`Buy max ${GOODS[good].name}`}
              onClick={() => setQty(buyMax)}
            >
              Buy max
            </button>
            <button
              type="button"
              disabled={sellMax <= 0}
              aria-label={`Sell max ${GOODS[good].name}`}
              onClick={() => setQty(sellMax)}
            >
              Sell max
            </button>
          </div>
          <div className="market-row__trade">
            {/* Explicit aria-labels keep the action buttons' accessible names
                distinct from the "Buy max"/"Sell max" buttons above (exact
                names: e2e and assistive tech disambiguate on them). */}
            <button
              type="button"
              disabled={!canBuy}
              aria-label={`Buy ${GOODS[good].name}`}
              onClick={() => dispatch({ kind: "buy", shipId: ship.id, good, qty: clampedQty })}
            >
              Buy {quoteLabel(buyTotal)}
              {unitHint(nextBuyUnit)}
            </button>
            <button
              type="button"
              disabled={!canSell}
              aria-label={`Sell ${GOODS[good].name}`}
              onClick={() => dispatch({ kind: "sell", shipId: ship.id, good, qty: clampedQty })}
            >
              Sell {quoteLabel(sellTotal)}
              {unitHint(nextSellUnit)}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Why the Controlled Ship can't sail to a given port right now, or null when
 * it can — in which case `eta` carries the previewed voyage ticks. The
 * "no route" case is belt-and-suspenders: worldgen guarantees a connected
 * region, but a disabled button with a hint beats a vanishing one.
 */
function sailability(
  ship: Ship,
  portId: PortId,
  region: Region,
): { disabledHint: string; eta: null } | { disabledHint: null; eta: number } {
  if (ship.location.kind !== "docked") {
    return { disabledHint: "Underway — dock to sail elsewhere.", eta: null };
  }
  if (ship.location.portId === portId) {
    return { disabledHint: "Already docked here.", eta: null };
  }
  const eta = previewRouteTicks(region, ship.location.portId, portId);
  if (eta === null) return { disabledHint: "No route to this port.", eta: null };
  return { disabledHint: null, eta };
}

/**
 * Sail-here control (#33): always rendered directly under the Harbor, so it
 * reads as the primary action for the Controlled Ship. Disabled — with a
 * title hint — when the ship can't sail here right now (underway, already
 * docked at this port, or unreachable); otherwise a live ETA.
 */
function SailControl({ ship, portId, region }: { ship: Ship; portId: PortId; region: Region }) {
  const dispatch = useGameStore((s) => s.dispatch);
  const { disabledHint, eta } = sailability(ship, portId, region);
  const label = `Sail ${ship.id} here`;

  if (disabledHint !== null) {
    return (
      <button type="button" className="sail-btn" disabled title={disabledHint}>
        {label}
      </button>
    );
  }

  return (
    <button
      type="button"
      className="sail-btn"
      onClick={() => dispatch({ kind: "sailTo", shipId: ship.id, portId })}
    >
      {label} (~{eta} ticks)
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

      <SailControl ship={ship} portId={port.id} region={world.region} />

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
            base={effectiveBase(port, good)}
            snapshotPrice={snapshot[good]}
            ship={ship}
            thalers={world.company.thalers}
            trading={dockedHere}
          />
        ))}
      </div>
    </>
  );
}
