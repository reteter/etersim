import type { CSSProperties } from "react";
import {
  effectiveBase,
  GOOD_IDS,
  GOODS,
  price,
  quoteBuy,
  quoteSell,
  type GoodId,
  type Port,
  type PortId,
} from "../sim";
import { useGameStore } from "../store/gameStore";
import { priceTrend, TREND_GLYPH, type Trend } from "./priceTrend";
import { quoteLabel } from "./quoteFormat";

/** One port×good cell's two-sided quote plus the mid-price trend (E8). */
interface Cell {
  readonly bid: number | null;
  readonly ask: number | null;
  readonly trend: Trend;
}

/** All cells for one port, keyed by good. */
function portCells(port: Port, snapshot: Record<GoodId, number>): Record<GoodId, Cell> {
  const cells = {} as Record<GoodId, Cell>;
  for (const good of GOOD_IDS) {
    const entry = port.market[good];
    const base = effectiveBase(port, good);
    cells[good] = {
      bid: quoteSell(entry, base, 1),
      ask: quoteBuy(entry, base, 1),
      trend: priceTrend(price(entry, base), snapshot[good]),
    };
  }
  return cells;
}

/** Per-good column extremes: the cheapest ask (where to buy) and the
 *  highest bid (where to sell), ignoring ports where the good isn't
 *  tradable (null quote). Ties highlight every matching port. */
function columnExtremes(
  ports: readonly Port[],
  cellsByPort: Record<PortId, Record<GoodId, Cell>>,
): { bestAsk: Record<GoodId, number | null>; bestBid: Record<GoodId, number | null> } {
  const bestAsk = {} as Record<GoodId, number | null>;
  const bestBid = {} as Record<GoodId, number | null>;
  for (const good of GOOD_IDS) {
    const asks = ports
      .map((port) => cellsByPort[port.id][good].ask)
      .filter((v): v is number => v !== null);
    const bids = ports
      .map((port) => cellsByPort[port.id][good].bid)
      .filter((v): v is number => v !== null);
    bestAsk[good] = asks.length > 0 ? Math.min(...asks) : null;
    bestBid[good] = bids.length > 0 ? Math.max(...bids) : null;
  }
  return { bestAsk, bestBid };
}

/**
 * Region price board (#62): a bid/ask overview across every port and good so
 * the player can compare markets without sailing to each one and opening its
 * panel. Opened from TopBar.tsx (button + a "b" hotkey); clicking a row jumps
 * straight to that port's own panel (docs/specs/E8-living-economy.md — Price
 * bias, Bid-ask spread).
 */
export function PriceBoardOverlay({ onClose }: { onClose: () => void }) {
  const world = useGameStore((s) => s.world);
  const controlledShipId = useGameStore((s) => s.controlledShipId);
  const select = useGameStore((s) => s.select);

  if (!world) return null;

  const { ports } = world.region;
  const controlledShip = world.company.ships.find((s) => s.id === controlledShipId);
  const dockedPortId =
    controlledShip?.location.kind === "docked" ? controlledShip.location.portId : null;

  const cellsByPort = {} as Record<PortId, Record<GoodId, Cell>>;
  for (const port of ports) {
    cellsByPort[port.id] = portCells(port, world.priceSnapshots[port.id]);
  }
  const { bestAsk, bestBid } = columnExtremes(ports, cellsByPort);

  const openPort = (portId: PortId) => {
    select({ kind: "port", id: portId });
    onClose();
  };

  return (
    <div className="overlay" role="dialog" aria-label="Price board" aria-modal="true">
      <div className="overlay__panel overlay__panel--wide">
        <h2 className="overlay__title">Price Board</h2>
        <div className="price-board" role="table" aria-label="Region price board">
          <div className="price-board__row price-board__row--header" role="row">
            <span className="price-board__port-header">Port</span>
            {GOOD_IDS.map((good) => (
              <span key={good} className="price-board__good-header">
                {GOODS[good].name}
              </span>
            ))}
          </div>
          {ports.map((port) => {
            const docked = port.id === dockedPortId;
            return (
              <div
                key={port.id}
                className={
                  docked ? "price-board__row price-board__row--docked" : "price-board__row"
                }
                data-archetype={port.archetype}
                style={{ "--port-color": `var(--archetype-${port.archetype})` } as CSSProperties}
                role="row"
                tabIndex={0}
                onClick={() => openPort(port.id)}
                onKeyDown={(e) => {
                  // Enter/Space activate the row, matching native button
                  // behavior (Harbor.tsx uses real <button>s for its rows;
                  // here role="row" must stay valid grid semantics, so
                  // keyboard activation is wired explicitly instead).
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openPort(port.id);
                  }
                }}
              >
                <span className="price-board__port-name">{port.name}</span>
                {GOOD_IDS.map((good) => {
                  const cell = cellsByPort[port.id][good];
                  const isBestAsk = cell.ask !== null && cell.ask === bestAsk[good];
                  const isBestBid = cell.bid !== null && cell.bid === bestBid[good];
                  return (
                    <span key={good} className="price-board__cell" role="cell">
                      <span
                        className={
                          isBestBid
                            ? "price-board__bid price-board__bid--best"
                            : "price-board__bid"
                        }
                      >
                        {quoteLabel(cell.bid)}
                      </span>
                      <span className={`price-board__trend price-board__trend--${cell.trend}`}>
                        {TREND_GLYPH[cell.trend]}
                      </span>
                      <span
                        className={
                          isBestAsk
                            ? "price-board__ask price-board__ask--best"
                            : "price-board__ask"
                        }
                      >
                        {quoteLabel(cell.ask)}
                      </span>
                    </span>
                  );
                })}
              </div>
            );
          })}
        </div>
        <button type="button" className="menu-btn" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
