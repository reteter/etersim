import { useState } from "react";
import {
  AUTO_DRAW_PER_DAY,
  computeBuildEstimate,
  computeGuildBuildRushQuote,
  computeRushQuote,
  CONSTRUCTION_RESERVE,
  ECONOMIC_ARCHETYPES,
  GOODS,
  hasStorehousePermit,
  isLegalStorehousePlacement,
  LABOR_FEE,
  STOREHOUSE_LABOR_FEE,
  STOREHOUSE_PERMIT_RANK,
  STOREHOUSE_RECIPE,
  type GuildId,
  type PortId,
  type World,
} from "../sim";
import { useGameStore } from "../store/gameStore";
import { deriveSiteStallReason, deriveStallReason } from "../store/headquartersStall";
import { BuildProgress } from "./BuildProgress";
import { GUILD_NAME_PL } from "./guildDisplay";
import { OverlayShell } from "./OverlayShell";
import { RoutesTab } from "./RoutesTab";
import { Tabs } from "./Tabs";

type Tab = "construction" | "routes";

const STALL_LABEL: Record<"reserve" | "goods", string> = {
  reserve: "wstrzymane: rezerwa skarbca",
  goods: "wstrzymane: brak towaru",
};

/** Ship commission — the E9 flow: an upfront estimate and a confirmation
 *  step (#122, spec §The Reserve), per-good progress, auto-draw rate, stall
 *  reason, and a rush at a live quote. Pre-#101 behavior preserved byte-for-
 *  byte: the "Zleć budowę" button stays mounted (disabled, with a reason)
 *  for the whole time a build runs, with its progress rendered alongside —
 *  never replaced by the progress view (#293's own tests pin this). The
 *  one-active-order law's OTHER two holders (a guild Building, the
 *  Shipyard's own site) block this button the same way the button's own
 *  `buildOrder` does. */
function ShipCommission({ world }: { world: World }) {
  const dispatch = useGameStore((s) => s.dispatch);
  const [confirming, setConfirming] = useState(false);
  const headquarters = world.company.headquarters!;
  const buildOrder = headquarters.buildOrder;
  const thalers = world.company.thalers;
  const shipyardUnderConstruction = Boolean(world.company.shipyard?.site);
  const guildBuildActive = Boolean(world.company.guildBuild);
  const blockedReason = buildOrder
    ? "budowa już trwa"
    : guildBuildActive
      ? "budowa budynku już trwa"
      : shipyardUnderConstruction
        ? "Trwa budowa stoczni"
        : null;
  const canPlace = !blockedReason && thalers >= LABOR_FEE + CONSTRUCTION_RESERVE;
  const stallReason = buildOrder ? deriveStallReason(world, headquarters) : null;
  const quote = buildOrder ? computeRushQuote(world) : null;
  const estimate = buildOrder ? null : computeBuildEstimate(world);

  return (
    <div className="headquarters-construction">
      {estimate && (
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
      )}

      {confirming && estimate && !buildOrder ? (
        <div className="build-confirm">
          <p>Zlecić budowę? Szacunkowy koszt: ₸{estimate.total} (przy dzisiejszych cenach).</p>
          {estimate.total > thalers - CONSTRUCTION_RESERVE && (
            <p className="headquarters-stall">
              Masz ₸{thalers} — budowa stanie na rezerwie ₸{CONSTRUCTION_RESERVE}, dopóki nie
              dowieziesz materiałów albo nie zarobisz więcej.
            </p>
          )}
          <div className="build-confirm__actions">
            <button
              type="button"
              className="menu-btn"
              onClick={() => {
                dispatch({ kind: "placeBuildOrder" });
                setConfirming(false);
              }}
            >
              Potwierdź — ₸{LABOR_FEE}
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
          disabled={!canPlace}
          title={
            blockedReason ??
            (canPlace
              ? undefined
              : `wymaga ₸${LABOR_FEE + CONSTRUCTION_RESERVE} — robocizna ₸${LABOR_FEE} + rezerwa ₸${CONSTRUCTION_RESERVE}`)
          }
          onClick={() => setConfirming(true)}
        >
          Zleć budowę — ₸{LABOR_FEE}
        </button>
      )}

      {buildOrder && (
        <>
          <BuildProgress siteStore={buildOrder.siteStore} />
          <p className="side-panel__hint">
            Auto-draw: up to {AUTO_DRAW_PER_DAY} units/good/day from the Headquarters market.
          </p>
          {stallReason && <p className="headquarters-stall">{STALL_LABEL[stallReason]}</p>}
          <button
            type="button"
            className="menu-btn"
            disabled={!quote || quote.total <= 0}
            onClick={() => dispatch({ kind: "rushBuild" })}
          >
            Dokup resztę — ₸{quote?.total ?? 0}
          </button>
        </>
      )}
    </div>
  );
}

/** Building commission (E13, #101): the Budynek half of the Budowa tab's
 *  commission choice (spec §UX skeleton — "ship (as in E9) or a permitted
 *  building + target port"; "the same progress/stall/rush UI serves both").
 *  Mirrors `ShipCommission`'s own shape exactly: the commission form (variant
 *  + port pickers, confirm step) stays mounted — disabled with a reason —
 *  for the whole time a guild Building is under construction, with its
 *  progress rendered alongside. Variant choice is gated on
 *  `hasStorehousePermit` per variant (E13 ships only the Granary/agrarian,
 *  but the permit is generic over `GuildId` — no dead branches for the other
 *  four); the port dropdown is limited to `isLegalStorehousePlacement` for
 *  the chosen variant. The stall reason reads the plain site (no
 *  `precedingSites` fold-in): a guildBuild is mutually exclusive with the
 *  HQ/Shipyard builds by the one-active-order law, so its only possible
 *  preceding draw is a concurrently active Refit — an edge case out of this
 *  task's scope (flagged in the completion report). */
function BuildingCommission({ world }: { world: World }) {
  const dispatch = useGameStore((s) => s.dispatch);
  const [confirming, setConfirming] = useState(false);
  const thalers = world.company.thalers;
  const guildBuild = world.company.guildBuild;
  const headquarters = world.company.headquarters!;
  const shipyardUnderConstruction = Boolean(world.company.shipyard?.site);

  const permittedVariants = ECONOMIC_ARCHETYPES.filter((v) => hasStorehousePermit(world, v));
  const [variant, setVariant] = useState<GuildId | "">(permittedVariants[0] ?? "");
  const activeVariant = permittedVariants.includes(variant as GuildId) ? (variant as GuildId) : "";

  const legalPorts = activeVariant
    ? world.region.ports.filter((p) => isLegalStorehousePlacement(world, activeVariant, p.id))
    : [];
  const [portId, setPortId] = useState<PortId | "">("");
  const activePortId = legalPorts.some((p) => p.id === portId) ? portId : "";

  const noPermitReason =
    permittedVariants.length === 0
      ? `wymaga rangi ${STOREHOUSE_PERMIT_RANK} w co najmniej jednej gildii`
      : null;
  const blockedReason = guildBuild
    ? "budowa już trwa"
    : headquarters.buildOrder
      ? "budowa statku już trwa"
      : shipyardUnderConstruction
        ? "Trwa budowa stoczni"
        : null;
  const canAfford = thalers >= STOREHOUSE_LABOR_FEE + CONSTRUCTION_RESERVE;
  const reason =
    blockedReason ??
    noPermitReason ??
    (!activeVariant
      ? "wybierz gildię"
      : !activePortId
        ? "wybierz port"
        : !canAfford
          ? `wymaga ₸${STOREHOUSE_LABOR_FEE + CONSTRUCTION_RESERVE} — robocizna ₸${STOREHOUSE_LABOR_FEE} + rezerwa ₸${CONSTRUCTION_RESERVE}`
          : null);
  const canPlace = reason === null;

  const site = guildBuild
    ? { recipe: STOREHOUSE_RECIPE, siteStore: guildBuild.siteStore, portId: guildBuild.portId }
    : null;
  const stallReason = site ? deriveSiteStallReason(world, site) : null;
  const quote = guildBuild ? computeGuildBuildRushQuote(world) : null;
  const guildBuildPort = guildBuild ? world.region.ports.find((p) => p.id === guildBuild.portId) : null;

  if (permittedVariants.length === 0 && !guildBuild) {
    return (
      <div className="headquarters-construction">
        <p className="side-panel__hint">
          Brak uprawnień do budowy — osiągnij rangę 2 w gildii, by odblokować Skład.
        </p>
      </div>
    );
  }

  return (
    <div className="headquarters-construction">
      {!guildBuild && (
        <>
          <label className="building-commission__field">
            Gildia
            <select
              aria-label="Gildia budynku"
              value={activeVariant}
              onChange={(e) => {
                setVariant(e.target.value as GuildId);
                setPortId("");
              }}
            >
              {permittedVariants.map((v) => (
                <option key={v} value={v}>
                  {GUILD_NAME_PL[v]}
                </option>
              ))}
            </select>
          </label>
          <label className="building-commission__field">
            Port
            <select
              aria-label="Port budynku"
              value={activePortId}
              onChange={(e) => setPortId(e.target.value as PortId)}
              disabled={!activeVariant}
            >
              <option value="">Wybierz port…</option>
              {legalPorts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        </>
      )}

      {confirming && activeVariant && activePortId && !guildBuild ? (
        <div className="build-confirm">
          <p>
            Zlecić budowę Składu ({GUILD_NAME_PL[activeVariant]})? Koszt robocizny: ₸
            {STOREHOUSE_LABOR_FEE}.
          </p>
          <div className="build-confirm__actions">
            <button
              type="button"
              className="menu-btn"
              onClick={() => {
                dispatch({
                  kind: "commissionGuildBuilding",
                  type: "storehouse",
                  variant: activeVariant,
                  portId: activePortId,
                });
                setConfirming(false);
              }}
            >
              Potwierdź — ₸{STOREHOUSE_LABOR_FEE}
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
          disabled={!canPlace}
          title={reason ?? undefined}
          onClick={() => setConfirming(true)}
        >
          Zleć budowę — ₸{STOREHOUSE_LABOR_FEE}
        </button>
      )}

      {guildBuild && (
        <>
          <p className="side-panel__hint">
            Budowa: Skład ({GUILD_NAME_PL[guildBuild.variant]}) w {guildBuildPort?.name ?? guildBuild.portId}
          </p>
          <BuildProgress siteStore={guildBuild.siteStore} recipe={STOREHOUSE_RECIPE} />
          <p className="side-panel__hint">
            Auto-pobór: do {AUTO_DRAW_PER_DAY} jedn./towar dziennie z własnego portu budynku.
          </p>
          {stallReason && <p className="headquarters-stall">{STALL_LABEL[stallReason]}</p>}
          <button
            type="button"
            className="menu-btn"
            disabled={!quote || quote.total <= 0}
            onClick={() => dispatch({ kind: "rushGuildBuild" })}
          >
            Dokup resztę — ₸{quote?.total ?? 0}
          </button>
        </>
      )}
    </div>
  );
}

type CommissionTarget = "ship" | "building";

/** The "Budowa" tab (docs/specs/E13 — UX skeleton): a commission choice —
 *  ship (E9's own HQ hull construction) or a permitted guild Building —
 *  where each side owns its full lifecycle (commission form -> progress),
 *  the one-active-order law blocking whichever side ISN'T running (spec:
 *  "one Build Order model, one UI"). The toggle stays visible throughout —
 *  switching tabs never loses either side's own in-progress state, since
 *  each holds its own World-derived data, not local-only state. */
function ConstructionTab({ world }: { world: World }) {
  const [target, setTarget] = useState<CommissionTarget>("ship");

  return (
    <div className="headquarters-construction-tab">
      <div className="commission-choice" aria-label="Wybór celu budowy">
        <button
          type="button"
          className={target === "ship" ? "menu-btn menu-btn--active" : "menu-btn"}
          aria-pressed={target === "ship"}
          onClick={() => setTarget("ship")}
        >
          Statek
        </button>
        <button
          type="button"
          className={target === "building" ? "menu-btn menu-btn--active" : "menu-btn"}
          aria-pressed={target === "building"}
          onClick={() => setTarget("building")}
        >
          Budynek
        </button>
      </div>
      {target === "ship" ? <ShipCommission world={world} /> : <BuildingCommission world={world} />}
    </div>
  );
}

/**
 * Headquarters view (docs/specs/E9 — UX skeleton): one panel, two tabs
 * (Budowa/Trasy). Reached from the TopBar shortcut (once founded) or the
 * HQ port's PortPanel section.
 */
export function HeadquartersPanel({ onClose }: { onClose: () => void }) {
  const world = useGameStore((s) => s.world);
  const [tab, setTab] = useState<Tab>("construction");

  if (!world || !world.company.headquarters) return null;

  return (
    <OverlayShell
      ariaLabel="Headquarters"
      title="Headquarters"
      onClose={onClose}
      wide
      tabs={
        <Tabs
          active={tab}
          onChange={setTab}
          tabs={[
            { id: "construction", label: "Budowa" },
            { id: "routes", label: "Trasy" },
          ]}
        />
      }
    >
      {tab === "construction" ? <ConstructionTab world={world} /> : <RoutesTab world={world} />}
    </OverlayShell>
  );
}
