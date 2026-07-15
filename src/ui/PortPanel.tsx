import { useState } from "react";
import {
  cargoUsed,
  CONSTRUCTION_RESERVE,
  effectiveBase,
  ENROLLMENT_FEE,
  GOOD_IDS,
  GOODS,
  HEADQUARTERS_COST,
  price,
  quoteBuy,
  quoteSell,
  RANK_THRESHOLDS,
  rankOf,
  type GoodId,
  type GuildId,
  type MarketGood,
  type Port,
  type PortId,
  type Region,
  type Ship,
  type ShipId,
  type World,
} from "../sim";
import { useGameStore } from "../store/gameStore";
import { BuildProgress } from "./BuildProgress";
import { buyCapHint, buyCapReason } from "./buyCap";
import { FOUNDING_GOAL, foundingProgress, foundingSavings } from "./foundingProgress";
import { GUILD_NAME_PL, GuildBadge } from "./guildDisplay";
import { ShipIcon } from "./icons";
import { priceTrend, TREND_GLYPH } from "./priceTrend";
import { quoteLabel } from "./quoteFormat";
import { previewCourseTicks } from "./coursePreview";

/** Archetype label text (CONTEXT.md: Port archetype). The other five render
 *  as their raw identifier — `.side-panel__subtitle`'s `text-transform:
 *  capitalize` (src/index.css) capitalizes every word, same trick already
 *  relied on for ShipPanel's "Docked at" (e2e/ui.spec.ts). "freeport" is one
 *  word in code but CONTEXT.md's Free port entry explicitly avoids "freeport"
 *  as one word in prose — "Free port" (two words) here renders "Free Port"
 *  after the same CSS transform. */
function archetypeLabel(archetype: Port["archetype"]): string {
  return archetype === "freeport" ? "Free port" : archetype;
}

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
                  <span className="harbor__id">{ship.name}</span>
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
  // Two-sided single-unit quotes (E8 bid-ask spread, #61): always shown,
  // independent of docking, so the spread is visible while just browsing.
  const askUnit = quoteBuy(entry, base, 1);
  const bidUnit = quoteSell(entry, base, 1);

  const buyMax = trading ? computeBuyMax(entry, base, ship, thalers) : 0;
  const sellMax = trading ? computeSellMax(entry, base, ship, good) : 0;
  // Which constraint binds Buy max — hold space, port stock or thalers
  // (#124: a capped Buy gave no reason, so a fresh player with a full hold
  // concluded the game was broken). Shown near the Buy control below.
  const holdSpace = ship.hold - cargoUsed(ship);
  const stockMax = Math.floor(entry.stock);
  const capHint = trading ? buyCapHint(buyCapReason(holdSpace, stockMax, buyMax), holdSpace, stockMax) : null;
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
        <span className={`market-row__trend market-row__trend--${trend}`}>
          {TREND_GLYPH[trend]}
        </span>
        <span className="market-row__bid">{quoteLabel(bidUnit)}</span>
        <span className="market-row__ask">{quoteLabel(askUnit)}</span>
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
          {capHint && (
            // Names the binding constraint on Buy max — hold space, port
            // stock, or thalers (#124) — instead of leaving a capped Buy
            // unexplained.
            <p className="market-row__cap-hint">{capHint}</p>
          )}
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
 * "no course" case is belt-and-suspenders: worldgen guarantees a connected
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
  const eta = previewCourseTicks(region, ship.location.portId, portId);
  if (eta === null) return { disabledHint: "No course to this port.", eta: null };
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
  const label = `Sail ${ship.name} here`;

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
 * Headquarters section (docs/specs/E9 — UX skeleton: "PortPanel gains the
 * Headquarters section"): before founding, every port's panel offers the
 * founding button; after founding, only the HQ port's own panel shows the
 * per-good build progress bar — "readable from the port level" (owner
 * requirement). Renders nothing at any other port.
 */
function HeadquartersSection({ world, portId }: { world: World; portId: PortId }) {
  const dispatch = useGameStore((s) => s.dispatch);
  const headquarters = world.company.headquarters;

  if (!headquarters) {
    // Founding may not dip into the Reserve (#122 — E9 spec §The Reserve).
    const thalers = world.company.thalers;
    const savings = foundingSavings(thalers);
    const canAfford = thalers >= FOUNDING_GOAL;
    return (
      <div className="founding-goal">
        <button
          type="button"
          className="headquarters-found-btn"
          disabled={!canAfford}
          title={
            canAfford
              ? undefined
              : `wymaga ₸${FOUNDING_GOAL} — koszt ₸${HEADQUARTERS_COST} + nienaruszalna rezerwa ₸${CONSTRUCTION_RESERVE}`
          }
          onClick={() => dispatch({ kind: "foundHeadquarters", portId })}
        >
          Załóż siedzibę — ₸{HEADQUARTERS_COST}
        </button>
        <div
          className="founding-goal__bar"
          role="progressbar"
          aria-label="Founding savings progress"
          aria-valuenow={savings}
          aria-valuemin={0}
          aria-valuemax={FOUNDING_GOAL}
        >
          <div
            className="founding-goal__fill"
            style={{ width: `${foundingProgress(thalers) * 100}%` }}
          />
        </div>
        <span className="founding-goal__count">
          ₸{savings} / ₸{FOUNDING_GOAL}
        </span>
      </div>
    );
  }

  if (headquarters.portId !== portId) return null;

  return (
    <div className="headquarters-section">
      <h3 className="side-panel__heading">Headquarters</h3>
      {headquarters.buildOrder ? (
        <BuildProgress siteStore={headquarters.buildOrder.siteStore} />
      ) : (
        <p className="side-panel__hint">
          No active build order — open Headquarters from the TopBar to start one.
        </p>
      )}
    </div>
  );
}

/** The next rank's point threshold, or null once already at the top rank
 *  (spec: Ranks — four steps). `RANK_THRESHOLDS[rank]` is the next
 *  threshold because `rankOf` returns `i + 1` when floored points clear
 *  `RANK_THRESHOLDS[i]` (guild.ts) — rank `r`'s own floor is
 *  `RANK_THRESHOLDS[r - 1]`, so its ceiling is one index further. */
function nextRankThreshold(rank: number): number | null {
  return rank < RANK_THRESHOLDS.length ? RANK_THRESHOLDS[rank] : null;
}

/**
 * Guildhouse section (#97, docs/specs/E3-contracts-and-guilds.md — UX
 * skeleton: "PortPanel gains a guildhouse section"): every non-freeport
 * port hosts its archetype's guild (CONTEXT.md — Guildhouse). Pre-enrollment:
 * the guild's badge, Polish working name, and an enroll button stating the
 * fee, disabled pre-Headquarters or when unaffordable with a Polish reason
 * (never a silent no-op). Post-enrollment: a neutral rank badge (never gold,
 * never the archetype hue — ADR-0006, its own visual axis) plus a points
 * progress bar toward the next rank threshold.
 */
function GuildhouseSection({ world, portId }: { world: World; portId: PortId }) {
  const dispatch = useGameStore((s) => s.dispatch);
  const port = world.region.ports.find((p) => p.id === portId);
  if (!port || port.archetype === "freeport") return null;

  const guildId: GuildId = port.archetype;
  const enrollment = world.company.guilds[guildId];

  if (enrollment) {
    const rank = rankOf(enrollment.points);
    const ceiling = nextRankThreshold(rank);
    const points = Math.max(0, enrollment.points);
    const rankFloor = RANK_THRESHOLDS[rank - 1];
    const progress = ceiling === null ? 1 : (points - rankFloor) / (ceiling - rankFloor);

    return (
      <div className="guildhouse-section">
        <h3 className="side-panel__heading">Dom gildii</h3>
        <div className="guildhouse-header">
          <GuildBadge guildId={guildId} />
          <span className="guildhouse-name">{GUILD_NAME_PL[guildId]}</span>
          <span className={`rank-badge rank-badge--${rank}`} title={`Ranga ${rank}`}>
            {rank}
          </span>
        </div>
        <div
          className="rank-progress__bar"
          role="progressbar"
          aria-label={`Postęp rangi — ${GUILD_NAME_PL[guildId]}`}
          aria-valuenow={points}
          aria-valuemin={rankFloor}
          aria-valuemax={ceiling ?? points}
        >
          <div className="rank-progress__fill" style={{ width: `${progress * 100}%` }} />
        </div>
        <span className="rank-progress__count">
          {ceiling === null ? `${points} pkt (ranga maksymalna)` : `${points} / ${ceiling} pkt`}
        </span>
      </div>
    );
  }

  const headquarters = world.company.headquarters;
  const thalers = world.company.thalers;
  const disabledReason = !headquarters
    ? "Wymaga założonej siedziby"
    : thalers < ENROLLMENT_FEE
      ? `Za mało thalerów (₸${ENROLLMENT_FEE})`
      : null;

  return (
    <div className="guildhouse-section">
      <h3 className="side-panel__heading">Dom gildii</h3>
      <div className="guildhouse-header">
        <GuildBadge guildId={guildId} />
        <span className="guildhouse-name">{GUILD_NAME_PL[guildId]}</span>
      </div>
      <button
        type="button"
        className="guildhouse-enroll-btn"
        disabled={disabledReason !== null}
        title={disabledReason ?? undefined}
        onClick={() => dispatch({ kind: "enroll", guildId })}
      >
        Wstąp do gildii — ₸{ENROLLMENT_FEE}
      </button>
      {disabledReason !== null && (
        <p className="guildhouse-enroll-reason">{disabledReason}</p>
      )}
    </div>
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
      <p className="side-panel__subtitle">{archetypeLabel(port.archetype)}</p>

      <Harbor port={port} ships={world.company.ships} controlledShipId={controlledShipId} />

      <SailControl ship={ship} portId={port.id} region={world.region} />

      <HeadquartersSection world={world} portId={port.id} />

      <GuildhouseSection world={world} portId={port.id} />

      <div className="market" role="table" aria-label={`${port.name} market`}>
        <div className="market__header" role="row">
          <span>Good</span>
          <span>Trend</span>
          <span>Bid</span>
          <span>Ask</span>
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
