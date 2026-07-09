import { applyCommand, type Command } from "./commands";
import { GOOD_IDS, type GoodId } from "./goods";
import { marketTick, NEUTRAL_MODIFIERS } from "./market";
import { osmosisTick } from "./osmosis";
import { runBuildSiteAutoDraw } from "./building";
import { ARCHETYPE_PROFILES, TICKS_PER_DAY, type PortId, type Region } from "./region";
import { nextFloat, type RngState } from "./rng";
import { advanceShip } from "./ship";
import { snapshotPrices, type World } from "./world";

export type { Command };

/** Mean-reversion pull per day: how far a drift multiplier moves back
 *  toward 1.0 before the random step is added (docs/specs/E8-living-economy.md
 *  — Stochastic flow drift). */
export const DRIFT_REVERT = 0.2;
/** Half-width of the daily random step, before mean reversion and clamping. */
export const DRIFT_STEP = 0.15;
/** Drift multiplier bounds — "a lean harvest" to "a good week at the mines". */
export const DRIFT_MIN = 0.7;
export const DRIFT_MAX = 1.3;

/**
 * One mean-reverting random step of every port × good's flow drift
 * multiplier, in canonical port × good order (region.ports order ×
 * GOOD_IDS order) so the same seed always draws in the same sequence
 * (ADR-0003). `m' = clamp(m + DRIFT_REVERT*(1-m) + DRIFT_STEP*(2u-1),
 * DRIFT_MIN, DRIFT_MAX)`. Pure: returns the next drift table and the
 * advanced RNG state, never mutates its inputs.
 */
export function driftStep(
  region: Region,
  flowDrift: Record<PortId, Record<GoodId, number>>,
  rng: RngState,
): [Record<PortId, Record<GoodId, number>>, RngState] {
  let state = rng;
  const next: Record<PortId, Record<GoodId, number>> = {};
  for (const port of region.ports) {
    const goods = {} as Record<GoodId, number>;
    for (const good of GOOD_IDS) {
      const m = flowDrift[port.id][good];
      let u: number;
      [u, state] = nextFloat(state);
      const stepped = m + DRIFT_REVERT * (1 - m) + DRIFT_STEP * (2 * u - 1);
      goods[good] = Math.min(DRIFT_MAX, Math.max(DRIFT_MIN, stepped));
    }
    next[port.id] = goods;
  }
  return [next, state];
}

/**
 * Advances the World by exactly one tick (ADR-0003). Pure: never mutates
 * its input. Phase order per docs/specs/E8-living-economy.md — World &
 * tick: apply commands → advance ships → market tick (elasticity × drift)
 * → osmosis → tick+1 → on day boundary: drift step + price snapshots.
 */
export function tick(world: World, commands: readonly Command[]): World {
  let w = world;
  for (const command of commands) w = applyCommand(w, command);

  const shipsAfterAdvance = w.company.ships.map((ship) => advanceShip(ship, w.region));

  // DOCKING PHASE (owned by parallel #80 coder)
  let postDock: World = { ...w, company: { ...w.company, ships: shipsAfterAdvance } };
  // BUILD-SITE AUTO-DRAW phase — after docking, before the market tick
  postDock = runBuildSiteAutoDraw(postDock);

  // Market tick runs on (possibly draw-mutated) stocks from postDock
  const ports = postDock.region.ports.map((port) => ({
    ...port,
    market: marketTick(
      port.market,
      ARCHETYPE_PROFILES[port.archetype],
      NEUTRAL_MODIFIERS,
      w.flowDrift[port.id],
    ),
  }));

  const { region, pulse } = osmosisTick({ ...postDock.region, ports });

  const nextTick = w.tick + 1;
  const isDayBoundary = nextTick % TICKS_PER_DAY === 0;
  let flowDrift = w.flowDrift;
  let rng = w.rng;
  if (isDayBoundary) [flowDrift, rng] = driftStep(region, w.flowDrift, w.rng);

  return {
    ...w,
    tick: nextTick,
    rng,
    region,
    company: postDock.company, // may include launched ship + cleared/updated buildOrder
    priceSnapshots: isDayBoundary ? snapshotPrices(region) : w.priceSnapshots,
    flowDrift,
    osmosisPulse: pulse,
  };
}
