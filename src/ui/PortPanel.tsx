import { useState, type ComponentType, type SVGProps } from "react";
import {
  amountOf,
  cargoUsed,
  computeRefitEstimate,
  computeRefitRushQuote,
  computeShipyardEstimate,
  computeShipyardRushQuote,
  CONSTRUCTION_RESERVE,
  effectiveBase,
  ENROLLMENT_FEE,
  GOOD_IDS,
  GOODS,
  HEADQUARTERS_COST,
  isUnderRefit,
  nextHoldStep,
  price,
  quoteBuy,
  quoteSell,
  RANK_THRESHOLDS,
  rankOf,
  refitRecipe,
  REFIT_LABOR_FEE,
  SHIPYARD_LABOR_FEE,
  SHIPYARD_RECIPE,
  storehouseFilter,
  STOREHOUSE_CAPACITY,
  type ConstructionSite,
  type GoodId,
  type GuildId,
  type MarketGood,
  type Port,
  type PortArchetype,
  type PortId,
  type Region,
  type Ship,
  type ShipId,
  type World,
} from "../sim";
import { useGameStore } from "../store/gameStore";
import { resolveFleetShip } from "../store/fleetResolution";
import { activeHeadquartersSite, deriveSiteStallReason } from "../store/headquartersStall";
import { BuildProgress } from "./BuildProgress";
import { buyCapHint, buyCapReason } from "./buyCap";
import { FOUNDING_GOAL, foundingProgress, foundingSavings } from "./foundingProgress";
import { GUILD_NAME_PL, GuildBadge } from "./guildDisplay";
import {
  AetherSaltIcon,
  AgrarianIcon,
  ElectronicsIcon,
  FreeportIcon,
  GrainIcon,
  IndustrialIcon,
  MiningIcon,
  ShipIcon,
  TextilesIcon,
  TimberIcon,
  UrbanIcon,
  VerdantIcon,
} from "./icons";
import { priceTrend, TREND_GLYPH, TREND_LEGEND } from "./priceTrend";
import { quoteLabel } from "./quoteFormat";
import { sailability } from "./sailability";

/** Archetype → vendored SVG icon, shown before the archetype label under the
 *  port name (#74). Same icon set RegionMap/GuildBadge already use
 *  (docs/adr/0006-svg-icon-strategy.md) — no second icon set for the same
 *  five archetypes. */
const ARCHETYPE_ICONS: Record<PortArchetype, ComponentType<SVGProps<SVGSVGElement>>> = {
  agrarian: AgrarianIcon,
  industrial: IndustrialIcon,
  urban: UrbanIcon,
  mining: MiningIcon,
  verdant: VerdantIcon,
  freeport: FreeportIcon,
};

/** Good → vendored SVG icon (#74), shown before the good name in market rows
 *  and reused for the in-hold marker (#73) — one vocabulary, two uses. */
const GOOD_ICONS: Record<GoodId, ComponentType<SVGProps<SVGSVGElement>>> = {
  grain: GrainIcon,
  textiles: TextilesIcon,
  aetherSalt: AetherSaltIcon,
  electronics: ElectronicsIcon,
  timber: TimberIcon,
};

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
  const held = GOOD_IDS.filter((good) => amountOf(ship.cargo, good) > 0).map(
    (good) => `${GOODS[good].name} ${amountOf(ship.cargo, good)}`,
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
  const held = amountOf(ship.cargo, good);
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
  // concluded the game was broken). Shown near the trade line below.
  const holdSpace = ship.hold - cargoUsed(ship);
  const stockMax = Math.floor(entry.stock);
  const capHint = trading ? buyCapHint(buyCapReason(holdSpace, stockMax, buyMax), holdSpace, stockMax, buyMax) : null;
  // Qty is shared by both actions, so it's clamped to whichever side allows
  // more — each button still disables independently via canBuy/canSell.
  const maxQty = Math.max(buyMax, sellMax);
  const clampQty = (n: number) => (maxQty <= 0 ? 0 : Math.min(Math.max(n, 1), maxQty));
  // #73 (owner design call 2026-07-16): qty DEFAULTS to the current max — in
  // practice buy/sell is almost always "max", so the player dials it *down*
  // rather than up. Only the initial value changes (was 1); once mounted,
  // clampQty keeps a manually-lowered qty stable across re-renders (price
  // ticks, docking) the same way it always did.
  const [qty, setQty] = useState(() => (maxQty > 0 ? maxQty : 1));
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
  const canSell = clampedQty > 0 && sellTotal !== null && amountOf(ship.cargo, good) >= clampedQty;

  const GoodIcon = GOOD_ICONS[good];
  const held = amountOf(ship.cargo, good);

  return (
    <div className="market-row">
      <div className="market-row__head">
        <span className="market-row__name">
          <GoodIcon className="market-row__icon" />
          {GOODS[good].name}
          {held > 0 && (
            // In-hold marker (#73, owner request 2026-07-16): the good's own
            // icon vocabulary again, muted — no new color (ADR-0006) — so a
            // glance at the market row shows what's already aboard.
            <span className="market-row__held" title={`W ładowni: ${held}`}>
              <GoodIcon className="market-row__held-icon" aria-hidden="true" />
              {held}
            </span>
          )}
        </span>
        <span
          className={`market-row__trend market-row__trend--${trend}`}
          title={TREND_LEGEND}
        >
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
              disabled={!canBuy}
              aria-label={`Buy ${GOODS[good].name}`}
              onClick={() => dispatch({ kind: "buy", shipId: ship.id, good, qty: clampedQty })}
            >
              Kup {quoteLabel(buyTotal)}
              {unitHint(nextBuyUnit)}
            </button>
            <button
              type="button"
              disabled={!canSell}
              aria-label={`Sell ${GOODS[good].name}`}
              onClick={() => dispatch({ kind: "sell", shipId: ship.id, good, qty: clampedQty })}
            >
              Sprzedaj {quoteLabel(sellTotal)}
              {unitHint(nextSellUnit)}
            </button>
          </div>
          {capHint && (
            // Names the binding constraint on Buy max — hold space, port
            // stock, or thalers (#124) — instead of leaving a capped Buy
            // unexplained.
            <p className="market-row__cap-hint">{capHint}</p>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Sail-here control (#33): always rendered directly under the Harbor, so it
 * reads as the primary action for the Controlled Ship. Disabled — with a
 * title hint — when the ship can't sail here right now (underway, already
 * docked at this port, or unreachable); otherwise a live ETA.
 */
function SailControl({
  ship,
  portId,
  region,
  locked,
}: {
  ship: Ship;
  portId: PortId;
  region: Region;
  /** True while `ship` is the Shipyard's active Refit target (#276) — the
   *  sail button gains a Polish disabled reason instead of the sim silently
   *  rejecting `sailTo` underneath it. */
  locked: boolean;
}) {
  const dispatch = useGameStore((s) => s.dispatch);
  const { disabledHint, eta } = sailability(ship, portId, region, locked);
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

/** Shared stall-reason label (STALL_LABEL, HeadquartersPanel.tsx) — the
 *  Shipyard's own site and a Refit site reuse `deriveSiteStallReason`
 *  (store/headquartersStall.ts), the generic counterpart of
 *  `deriveStallReason`, so they get the identical Polish copy for
 *  "wstrzymane: rezerwa skarbca" / "wstrzymane: brak towaru" the Budowa tab
 *  already shows. */
const SITE_STALL_LABEL: Record<"reserve" | "goods", string> = {
  reserve: "wstrzymane: rezerwa skarbca",
  goods: "wstrzymane: brak towaru",
};

/**
 * The site's progress bar + stall reason + a live rush quote, shared by the
 * Shipyard's own construction and an active Refit — the two
 * `ConstructionSite`s `ShipyardSection` below renders (#292 — collapses the
 * progress+stall+rush JSX that used to be repeated per branch). The quote
 * comes from the same sim function the `rush*` command charges (never a
 * drifting UI-only quote).
 *
 * `precedingSites` names the sites the same tick draws from the shared purse
 * *before* `site` (Professor F3, #292 — see `deriveSiteStallReason`): the HQ
 * Build Order for whichever of these two sites is active, since the Shipyard
 * runs after the HQ in `tick.ts`'s fixed order and the Shipyard's own
 * construction is mutually exclusive with an active Refit.
 */
function SiteProgress({
  world,
  site,
  precedingSites,
  rushTotal,
  onRush,
}: {
  world: World;
  site: ConstructionSite;
  precedingSites: readonly ConstructionSite[];
  rushTotal: number;
  onRush: () => void;
}) {
  const stallReason = deriveSiteStallReason(world, site, precedingSites);
  return (
    <>
      <BuildProgress siteStore={site.siteStore} recipe={site.recipe} />
      {stallReason && <p className="headquarters-stall">{SITE_STALL_LABEL[stallReason]}</p>}
      <button
        type="button"
        className="menu-btn"
        disabled={rushTotal <= 0}
        onClick={onRush}
      >
        Dokup resztę — ₸{rushTotal}
      </button>
    </>
  );
}

/**
 * Refit picker (docs/specs/E14 — UI: "start a Refit (pick a docked ship, see
 * target Hold + estimate)"): every Company ship docked *at this port* that
 * isn't already at the Hold ladder's cap (`nextHoldStep` non-null) is an
 * eligible target. Renders only once the Shipyard has activated and has no
 * active RefitOrder — `ShipyardSection` below gates entry into this branch.
 */
function RefitPicker({ world, portId }: { world: World; portId: PortId }) {
  const dispatch = useGameStore((s) => s.dispatch);
  const port = world.region.ports.find((p) => p.id === portId)!;
  const eligible = world.company.ships.filter(
    (s) =>
      s.location.kind === "docked" && s.location.portId === portId && nextHoldStep(s) !== null,
  );
  const [shipId, setShipId] = useState<ShipId | "">("");
  const [confirming, setConfirming] = useState(false);
  const selected = eligible.find((s) => s.id === shipId) ?? null;
  const targetHold = selected ? nextHoldStep(selected) : null;
  const estimate = selected && targetHold !== null ? computeRefitEstimate(port, selected) : null;
  const thalers = world.company.thalers;
  const canAfford = thalers >= REFIT_LABOR_FEE + CONSTRUCTION_RESERVE;

  return (
    <>
      {eligible.length === 0 ? (
        <p className="side-panel__hint">
          Brak tu dokowanych statków kwalifikujących się do przebudowy.
        </p>
      ) : (
        <>
          <select
            className="shipyard-refit-picker__select"
            aria-label="Wybierz statek do przebudowy"
            value={shipId}
            onChange={(e) => {
              setShipId(e.target.value as ShipId | "");
              setConfirming(false);
            }}
          >
            <option value="">Wybierz statek…</option>
            {eligible.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          {selected && estimate && targetHold !== null && (
            <>
              {confirming ? (
                <div className="build-confirm">
                  <p>
                    Rozpocząć przebudowę {selected.name}: ładownia {selected.hold} → {targetHold}?
                    Szacunkowy koszt: ₸{estimate.total} (przy dzisiejszych cenach).
                  </p>
                  <div className="build-confirm__actions">
                    <button
                      type="button"
                      className="menu-btn"
                      onClick={() => {
                        dispatch({ kind: "commissionRefit", shipId: selected.id });
                        setConfirming(false);
                        setShipId("");
                      }}
                    >
                      Potwierdź — ₸{REFIT_LABOR_FEE}
                    </button>
                    <button type="button" className="menu-btn" onClick={() => setConfirming(false)}>
                      Anuluj
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="side-panel__hint">
                    Ładownia {selected.hold} → {targetHold}. Szacunkowy koszt: ₸{estimate.total} (przy
                    dzisiejszych cenach).
                  </p>
                  <button
                    type="button"
                    className="menu-btn"
                    disabled={!canAfford}
                    title={
                      canAfford
                        ? undefined
                        : `wymaga ₸${REFIT_LABOR_FEE + CONSTRUCTION_RESERVE} — robocizna ₸${REFIT_LABOR_FEE} + rezerwa ₸${CONSTRUCTION_RESERVE}`
                    }
                    onClick={() => setConfirming(true)}
                  >
                    Rozpocznij przebudowę — ₸{REFIT_LABOR_FEE}
                  </button>
                </>
              )}
            </>
          )}
        </>
      )}
    </>
  );
}

/**
 * Shipyard section (docs/specs/E14-shipyard-and-refit.md — UI surfaces:
 * "PortPanel section... following the Storehouse-section pattern"; the
 * Storehouse itself hasn't shipped yet, so this mirrors the real precedent,
 * `HeadquartersSection` above — same "render the commission button at every
 * port pre-commission, only the Shipyard's own port shows the rest"
 * structure). States, in order: no Shipyard yet (commission button, gated on
 * an existing Headquarters, no HQ build in progress, and the Reserve —
 * #124's "never a silent no-op" rule); the Shipyard's own construction site
 * still active (progress/stall/rush, the Budowa tab's widgets reused via
 * `BuildProgress`/`deriveSiteStallReason`); activated with an active Refit
 * (same progress/stall/rush, against `refitRecipe(targetShip)`); activated
 * with no Refit (the picker, `RefitPicker` above).
 */
function ShipyardSection({ world, portId }: { world: World; portId: PortId }) {
  const dispatch = useGameStore((s) => s.dispatch);
  const [confirming, setConfirming] = useState(false);
  const shipyard = world.company.shipyard;
  const thalers = world.company.thalers;

  if (!shipyard) {
    const headquarters = world.company.headquarters;
    const port = world.region.ports.find((p) => p.id === portId)!;
    const estimate = computeShipyardEstimate(port);
    const disabledReason = !headquarters
      ? "Wymaga założonej siedziby"
      : headquarters.buildOrder
        ? "Trwa budowa statku w siedzibie"
        : thalers < SHIPYARD_LABOR_FEE + CONSTRUCTION_RESERVE
          ? `wymaga ₸${SHIPYARD_LABOR_FEE + CONSTRUCTION_RESERVE} — robocizna ₸${SHIPYARD_LABOR_FEE} + rezerwa ₸${CONSTRUCTION_RESERVE}`
          : null;

    return (
      <div className="shipyard-section">
        <h3 className="side-panel__heading">Stocznia</h3>
        {confirming ? (
          <div className="build-confirm">
            <p>
              Zlecić budowę stoczni? Szacunkowy koszt: ₸{estimate.total} (przy dzisiejszych cenach).
            </p>
            <div className="build-confirm__actions">
              <button
                type="button"
                className="menu-btn"
                onClick={() => {
                  dispatch({ kind: "commissionShipyard", portId });
                  setConfirming(false);
                }}
              >
                Potwierdź — ₸{SHIPYARD_LABOR_FEE}
              </button>
              <button type="button" className="menu-btn" onClick={() => setConfirming(false)}>
                Anuluj
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="menu-btn"
            disabled={disabledReason !== null}
            title={disabledReason ?? undefined}
            onClick={() => setConfirming(true)}
          >
            Zbuduj stocznię — ₸{SHIPYARD_LABOR_FEE}
          </button>
        )}
      </div>
    );
  }

  if (shipyard.portId !== portId) return null;

  // Sites that already drew from the shared purse earlier in tick.ts's fixed
  // order (HQ, Shipyard construction, Refit) — folded into both branches
  // below via `precedingSites` (Professor F3, #292: a later site's readout
  // must not test the raw pre-tick purse alone). The HQ Build Order is the
  // only possible preceding site for either: the Shipyard's own construction
  // and an active Refit are themselves mutually exclusive (`shipyard.ts`).
  const hqSite = activeHeadquartersSite(world);
  const precedingSites = hqSite ? [hqSite] : [];

  if (shipyard.site) {
    const site: ConstructionSite = {
      recipe: SHIPYARD_RECIPE,
      siteStore: shipyard.site.siteStore,
      portId,
    };
    const quote = computeShipyardRushQuote(world);
    return (
      <div className="shipyard-section">
        <h3 className="side-panel__heading">Stocznia</h3>
        <SiteProgress
          world={world}
          site={site}
          precedingSites={precedingSites}
          rushTotal={quote.total}
          onRush={() => dispatch({ kind: "rushShipyard" })}
        />
      </div>
    );
  }

  if (shipyard.refitOrder) {
    const refitOrder = shipyard.refitOrder;
    const targetShip = world.company.ships.find((s) => s.id === refitOrder.shipId);
    // Defensive — shouldn't happen with a valid World (mirrors
    // `activeRefitSite`'s own defensive null in shipyard.ts).
    if (!targetShip) return null;
    const recipe = refitRecipe(targetShip);
    const site: ConstructionSite = { recipe, siteStore: refitOrder.siteStore, portId };
    const quote = computeRefitRushQuote(world);
    return (
      <div className="shipyard-section">
        <h3 className="side-panel__heading">Stocznia</h3>
        <p className="side-panel__hint">
          Przebudowa: {targetShip.name} — ładownia {targetShip.hold} → {refitOrder.targetHold}
        </p>
        <SiteProgress
          world={world}
          site={site}
          precedingSites={precedingSites}
          rushTotal={quote.total}
          onRush={() => dispatch({ kind: "rushRefit" })}
        />
      </div>
    );
  }

  return (
    <div className="shipyard-section">
      <h3 className="side-panel__heading">Stocznia</h3>
      <RefitPicker world={world} portId={portId} />
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
 * Storehouse section (E13, #101, docs/specs/E13-guild-buildings.md — UX
 * skeleton: "PortPanel at a storehouse port gains a Storehouse section:
 * stored quantity / capacity, plus manual store/withdraw buttons for a
 * docked ship"). Renders nothing at a port with no Company `CompanyBuilding`
 * — mirrors `HeadquartersSection`/`ShipyardSection`'s "nothing to show"
 * precedent. Only the Building's own goods filter (`storehouseFilter`) gets
 * a row (E13 ships one variant, the grain-only Granary, but this stays
 * generic over `GuildId`). Store/withdraw buttons only render docked here —
 * both Commands are docked-only no-ops otherwise (commands.ts) — and are
 * individually disabled-with-reason (#124) rather than left clickable
 * no-ops.
 */
function StorehouseSection({
  world,
  portId,
  ship,
  dockedHere,
}: {
  world: World;
  portId: PortId;
  ship: Ship;
  dockedHere: boolean;
}) {
  const dispatch = useGameStore((s) => s.dispatch);
  const building = world.company.buildings.find((b) => b.portId === portId);
  if (!building) return null;

  const goods = storehouseFilter(building.variant);

  return (
    <div className="storehouse-section">
      <h3 className="side-panel__heading">Skład</h3>
      {goods.map((good) => {
        const stored = amountOf(building.store, good);
        const held = amountOf(ship.cargo, good);
        const holdFull = cargoUsed(ship) >= ship.hold;
        const canStore = dockedHere && held > 0 && stored < STOREHOUSE_CAPACITY;
        const canWithdraw = dockedHere && stored > 0 && !holdFull;
        return (
          <div key={good} className="storehouse-row">
            <span className="storehouse-row__label">
              {GOODS[good].name}: {stored}/{STOREHOUSE_CAPACITY}
            </span>
            <div
              className="storehouse-row__bar"
              role="progressbar"
              aria-label={`${GOODS[good].name} storehouse fill`}
              aria-valuenow={stored}
              aria-valuemin={0}
              aria-valuemax={STOREHOUSE_CAPACITY}
            >
              <div
                className="storehouse-row__fill"
                style={{ width: `${(stored / STOREHOUSE_CAPACITY) * 100}%` }}
              />
            </div>
            {dockedHere && (
              <div className="storehouse-row__actions">
                <button
                  type="button"
                  className="menu-btn"
                  disabled={!canStore}
                  title={canStore ? undefined : held <= 0 ? "Brak towaru w ładowni" : "Skład pełny"}
                  aria-label={`Store ${GOODS[good].name}`}
                  onClick={() => dispatch({ kind: "storeGood", shipId: ship.id, good })}
                >
                  Złóż
                </button>
                <button
                  type="button"
                  className="menu-btn"
                  disabled={!canWithdraw}
                  title={canWithdraw ? undefined : holdFull ? "Ładownia pełna" : "Skład pusty"}
                  aria-label={`Withdraw ${GOODS[good].name}`}
                  onClick={() => dispatch({ kind: "withdrawGood", shipId: ship.id, good })}
                >
                  Pobierz
                </button>
              </div>
            )}
          </div>
        );
      })}
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
  const ship = resolveFleetShip(world, controlledShipId);
  if (!ship) return null;
  const dockedHere = ship.location.kind === "docked" && ship.location.portId === port.id;
  const snapshot = world.priceSnapshots[port.id];
  const ArchetypeIcon = ARCHETYPE_ICONS[port.archetype];

  return (
    <>
      <h2 className="side-panel__title">{port.name}</h2>
      <p className="side-panel__subtitle">
        <ArchetypeIcon className="side-panel__subtitle-icon" />
        {archetypeLabel(port.archetype)}
      </p>

      <Harbor port={port} ships={world.company.ships} controlledShipId={controlledShipId} />

      <SailControl
        ship={ship}
        portId={port.id}
        region={world.region}
        locked={isUnderRefit(world, ship.id)}
      />

      <HeadquartersSection world={world} portId={port.id} />

      <ShipyardSection world={world} portId={port.id} />

      <StorehouseSection world={world} portId={port.id} ship={ship} dockedHere={dockedHere} />

      <GuildhouseSection world={world} portId={port.id} />

      <div className="market" role="table" aria-label={`${port.name} market`}>
        <div className="market__header" role="row">
          <span>Good</span>
          <span title={TREND_LEGEND}>Trend</span>
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
