import type { CSSProperties } from "react";
import { effectiveBase, GOOD_IDS, GOODS, price, type GoodId, type Port, type PortId } from "../sim";
import { useGameStore } from "../store/gameStore";
import { computeMarketSignal, quotePortGood } from "../store/marketSignal";
import { KontraktyTab } from "./KontraktyTab";
import { OverlayShell } from "./OverlayShell";
import { priceTrend, TREND_GLYPH, TREND_LEGEND, type Trend } from "./priceTrend";
import { quoteLabel } from "./quoteFormat";
import { Tabs } from "./Tabs";

/** #96 (docs/specs/E3-contracts-and-guilds.md — UX skeleton): the overlay's
 *  two tabs. "ceny" behaves exactly as before this issue; "kontrakty" is new
 *  (KontraktyTab.tsx). */
type Tab = "ceny" | "kontrakty";

/** One port×good cell's two-sided quote plus the mid-price trend (E8). */
interface Cell {
  readonly bid: number | null;
  readonly ask: number | null;
  readonly trend: Trend;
}

/** All cells for one port, keyed by good. `quotePortGood` (store/marketSignal)
 *  is the single quote source this board and the market-quality signal both
 *  read — sharing it is load-bearing (E16 spec — Trap 2): reimplementing the
 *  quote here would let the board's numbers silently drift from the signal's. */
function portCells(port: Port, snapshot: Record<GoodId, number>): Record<GoodId, Cell> {
  const cells = {} as Record<GoodId, Cell>;
  for (const good of GOOD_IDS) {
    const { bid, ask } = quotePortGood(port, good);
    const base = effectiveBase(port, good);
    cells[good] = { bid, ask, trend: priceTrend(price(port.market[good], base), snapshot[good]) };
  }
  return cells;
}

/**
 * Region price board (#62): a bid/ask overview across every port and good so
 * the player can compare markets without sailing to each one and opening its
 * panel. Opened from TopBar.tsx (button + a "b" hotkey); clicking a row jumps
 * straight to that port's own panel (docs/specs/E8-living-economy.md — Price
 * bias, Bid-ask spread).
 */
export function PriceBoardOverlay({
  onClose,
  tab,
  onTabChange,
}: {
  onClose: () => void;
  /** Controlled, not mount-once (#195 rider 1): the caller (TopBar) owns the
   *  tab so a notice-strip click can retarget an already-open board straight
   *  to Kontrakty, not just pick its *initial* tab. */
  tab: Tab;
  onTabChange: (tab: Tab) => void;
}) {
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
  // Market-quality signal (store bridge, docs/specs/E16-workbench.md):
  // computed once here and subsumes this board's old local `columnExtremes`
  // helper — "best" highlight now reads tier === "strong" (a tie at the
  // regional extreme lights up every tied port, not just a singular id).
  const signal = computeMarketSignal(ports);

  const openPort = (portId: PortId) => {
    select({ kind: "port", id: portId });
    onClose();
  };

  return (
    <OverlayShell
      ariaLabel="Price board"
      title="Price Board"
      onClose={onClose}
      wide
      tabs={
        <Tabs
          ariaLabel="Price board tabs"
          active={tab}
          onChange={onTabChange}
          tabs={[
            { id: "ceny", label: "Ceny" },
            { id: "kontrakty", label: "Kontrakty" },
          ]}
        />
      }
    >
      {tab === "kontrakty" ? (
        <KontraktyTab world={world} />
      ) : (
        <>
          <p className="price-board__legend">{TREND_LEGEND}</p>
          <div className="price-board" role="table" aria-label="Region price board">
          <div className="price-board__row price-board__row--header" role="row">
            <span className="price-board__port-header">Port</span>
            {GOOD_IDS.map((good) => (
              <span key={good} className="price-board__good-header" title={TREND_LEGEND}>
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
                  const isBestAsk = signal.entries[port.id][good].buyTier === "strong";
                  const isBestBid = signal.entries[port.id][good].sellTier === "strong";
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
                      <span
                        className={`price-board__trend price-board__trend--${cell.trend}`}
                        title={TREND_LEGEND}
                      >
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
        </>
      )}
    </OverlayShell>
  );
}
