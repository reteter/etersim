import { useState } from "react";
import {
  computeRefitRushQuote,
  computeShipyardRushQuote,
  CONSTRUCTION_RESERVE,
  GOODS,
  nextHoldStep,
  refitRecipe,
  REFIT_LABOR_FEE,
  SHIPYARD_LABOR_FEE,
  SHIPYARD_RECIPE,
  type ConstructionSite,
  type GoodId,
  type Port,
  type PortId,
  type Ship,
  type ShipId,
  type World,
} from "../sim";
import { useGameStore } from "../store/gameStore";
import { deriveSiteStallReason, type StallReason } from "../store/headquartersStall";
import { BuildProgress } from "./BuildProgress";
import { computeSiteEstimate } from "./siteEstimate";

const STALL_LABEL: Record<Exclude<StallReason, null>, string> = {
  reserve: "wstrzymane: rezerwa skarbca",
  goods: "wstrzymane: brak towaru",
};

/** Estimate breakdown, shared by the commission and refit confirmation steps —
 *  the `computeBuildEstimate` presentation from the Budowa tab, per good plus
 *  the labor fee (Robocizna) and a total "at today's prices". */
function EstimateLines({
  recipe,
  laborFee,
  port,
}: {
  recipe: Record<GoodId, number>;
  laborFee: number;
  port: Port;
}) {
  const estimate = computeSiteEstimate(port, recipe, laborFee);
  return (
    <div className="build-estimate">
      <ul className="build-estimate__lines">
        {estimate.lines.map((line) => (
          <li key={line.good}>
            {GOODS[line.good].name} × {line.qty} — ₸{line.thalers}
          </li>
        ))}
        <li>Robocizna — ₸{estimate.laborFee}</li>
      </ul>
      <p className="side-panel__hint">
        Szacunkowy koszt: ₸{estimate.total} (przy dzisiejszych cenach)
      </p>
    </div>
  );
}

/** The site's progress bar + stall reason + a live rush quote, shared by the
 *  Shipyard's own construction and an active Refit — the two ConstructionSites
 *  the Shipyard section renders. The quote comes from the same sim function
 *  the `rush*` command charges (docs/specs/E14 — "call the same sim functions
 *  the sim uses — no drifting quotes"). */
function SiteProgress({
  world,
  site,
  rushTotal,
  onRush,
}: {
  world: World;
  site: ConstructionSite;
  rushTotal: number;
  onRush: () => void;
}) {
  const stall = deriveSiteStallReason(world, site);
  return (
    <>
      <BuildProgress siteStore={site.siteStore} recipe={site.recipe} />
      {stall && <p className="headquarters-stall">{STALL_LABEL[stall]}</p>}
      <button type="button" className="menu-btn" disabled={rushTotal <= 0} onClick={onRush}>
        Dokup resztę — ₸{rushTotal}
      </button>
    </>
  );
}

/** Commission button (when the Company has a Headquarters and no Shipyard):
 *  an estimate + a confirmation step, the `computeBuildEstimate` pattern from
 *  the Budowa tab. Shown at every port pre-commission — the player picks the
 *  Shipyard's home port, exactly like founding the Headquarters. */
function CommissionControl({ world, portId }: { world: World; portId: PortId }) {
  const dispatch = useGameStore((s) => s.dispatch);
  const [confirming, setConfirming] = useState(false);
  const port = world.region.ports.find((p) => p.id === portId)!;
  const thalers = world.company.thalers;
  const hqBuildActive = Boolean(world.company.headquarters!.buildOrder);
  const canAfford = thalers >= SHIPYARD_LABOR_FEE + CONSTRUCTION_RESERVE;
  // Scarcity law (#286): one active Build Order per Company — the sim rejects
  // commissionShipyard while an HQ ship build runs, so the button says why.
  const disabledReason = hqBuildActive
    ? "trwa budowa statku — jedna budowa naraz"
    : !canAfford
      ? `wymaga ₸${SHIPYARD_LABOR_FEE + CONSTRUCTION_RESERVE} — robocizna ₸${SHIPYARD_LABOR_FEE} + rezerwa ₸${CONSTRUCTION_RESERVE}`
      : null;

  return (
    <div className="shipyard-section">
      <h3 className="side-panel__heading">Stocznia</h3>
      <EstimateLines recipe={SHIPYARD_RECIPE} laborFee={SHIPYARD_LABOR_FEE} port={port} />
      {confirming && disabledReason === null ? (
        <div className="build-confirm">
          <p>Zbudować stocznię w tym porcie?</p>
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
      {disabledReason !== null && <p className="side-panel__hint">{disabledReason}</p>}
    </div>
  );
}

/** Refit picker over the docked, not-yet-capped ships (the Shipyard is built,
 *  no Refit active): pick a ship, see its target Hold + an estimate, start.
 *  A capped ship (`nextHoldStep` null) is deliberately excluded — the sim
 *  rejects it, so it never appears as a choice. */
function RefitPicker({ world, portId }: { world: World; portId: PortId }) {
  const dispatch = useGameStore((s) => s.dispatch);
  const port = world.region.ports.find((p) => p.id === portId)!;
  const eligible = world.company.ships.filter(
    (s) => s.location.kind === "docked" && s.location.portId === portId && nextHoldStep(s) !== null,
  );
  const [selectedId, setSelectedId] = useState<ShipId | "">("");
  const selected = eligible.find((s) => s.id === selectedId) ?? null;

  const thalers = world.company.thalers;
  const canAfford = thalers >= REFIT_LABOR_FEE + CONSTRUCTION_RESERVE;

  if (eligible.length === 0) {
    return (
      <div className="shipyard-section">
        <h3 className="side-panel__heading">Stocznia</h3>
        <p className="side-panel__hint">
          Zadokuj tu statek (poniżej pułapu ładowni), aby rozpocząć przebudowę.
        </p>
      </div>
    );
  }

  const targetHold = selected ? nextHoldStep(selected) : null;

  return (
    <div className="shipyard-section">
      <h3 className="side-panel__heading">Stocznia</h3>
      <select
        className="shipyard-refit__ship"
        aria-label="Wybierz statek do przebudowy"
        value={selectedId}
        onChange={(e) => setSelectedId(e.target.value as ShipId | "")}
      >
        <option value="">Wybierz statek…</option>
        {eligible.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      {selected && targetHold !== null && (
        <>
          <p className="side-panel__hint">
            Ładownia: {selected.hold} → {targetHold}
          </p>
          <EstimateLines recipe={refitRecipe(selected)} laborFee={REFIT_LABOR_FEE} port={port} />
          <button
            type="button"
            className="menu-btn"
            disabled={!canAfford}
            title={
              canAfford
                ? undefined
                : `wymaga ₸${REFIT_LABOR_FEE + CONSTRUCTION_RESERVE} — robocizna ₸${REFIT_LABOR_FEE} + rezerwa ₸${CONSTRUCTION_RESERVE}`
            }
            onClick={() => dispatch({ kind: "commissionRefit", shipId: selected.id })}
          >
            Rozpocznij przebudowę — ₸{REFIT_LABOR_FEE}
          </button>
        </>
      )}
    </div>
  );
}

/**
 * Shipyard section (docs/specs/E14 — "UI surfaces": PortPanel section,
 * Storehouse-section pattern). Four states, all keyed on
 * `world.company.shipyard`:
 *  - absent + a Headquarters exists → commission button (every port);
 *  - present but not this port → nothing (the section is home-port-local,
 *    like the Headquarters section);
 *  - present, still building (`site`) → the Shipyard's own construction
 *    progress + stall + rush;
 *  - built, a Refit active (`refitOrder`) → the Refit's progress + stall +
 *    rush; otherwise the refit picker.
 */
export function ShipyardSection({ world, portId }: { world: World; portId: PortId }) {
  const dispatch = useGameStore((s) => s.dispatch);
  const shipyard = world.company.shipyard;

  if (!shipyard) {
    // The Shipyard is the Company's second Building — no commission before a
    // Headquarters (CONTEXT.md — Shipyard: "once the Headquarters exists").
    if (!world.company.headquarters) return null;
    return <CommissionControl world={world} portId={portId} />;
  }

  if (shipyard.portId !== portId) return null;

  if (shipyard.site) {
    const site: ConstructionSite = {
      recipe: SHIPYARD_RECIPE,
      siteStore: shipyard.site.siteStore,
      portId: shipyard.portId,
    };
    return (
      <div className="shipyard-section">
        <h3 className="side-panel__heading">Stocznia</h3>
        <p className="side-panel__hint">Stocznia w budowie</p>
        <SiteProgress
          world={world}
          site={site}
          rushTotal={computeShipyardRushQuote(world).total}
          onRush={() => dispatch({ kind: "rushShipyard" })}
        />
      </div>
    );
  }

  if (shipyard.refitOrder) {
    const refit = shipyard.refitOrder;
    const ship = world.company.ships.find((s: Ship) => s.id === refit.shipId);
    if (!ship) return null;
    const site: ConstructionSite = {
      recipe: refitRecipe(ship),
      siteStore: refit.siteStore,
      portId: shipyard.portId,
    };
    return (
      <div className="shipyard-section">
        <h3 className="side-panel__heading">Stocznia</h3>
        <p className="side-panel__hint">
          {ship.name} w przebudowie — ładownia → {refit.targetHold}
        </p>
        <SiteProgress
          world={world}
          site={site}
          rushTotal={computeRefitRushQuote(world).total}
          onRush={() => dispatch({ kind: "rushRefit" })}
        />
      </div>
    );
  }

  return <RefitPicker world={world} portId={portId} />;
}
