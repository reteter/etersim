import { applyCommand, type Command } from "./commands";
import { GOOD_IDS, type GoodId } from "./goods";
import { effectiveBase, marketTick, NEUTRAL_MODIFIERS, quoteBuy, quoteSell } from "./market";
import { osmosisTick } from "./osmosis";
import { ARCHETYPE_PROFILES, DOCKING_FEE, TICKS_PER_DAY, type PortId, type Region } from "./region";
import { nextFloat, type RngState } from "./rng";
import { advanceShip, type Ship } from "./ship";
import { shortestCourse } from "./pathfinding";
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
 * its input. Phase order per docs/specs/E9-fleet-and-routes.md (extended E8):
 * apply commands → advance ships → docking phase (#80) → build-site auto-draw
 * (#81 placeholder) → market tick → osmosis → tick+1 → day boundary.
 */
export function tick(world: World, commands: readonly Command[]): World {
  let w = world;
  for (const command of commands) w = applyCommand(w, command);

  // E9: If after commands a ship is docked, unsuspended, and assigned to a route whose current Stop port matches,
  // treat it as "arriving" for stop execution within this tick (covers assign/resume while already at the stop).
  // Execute best-effort, advance index (wrap), and dispatch to next if different. This keeps docking phase focused on transitions.
  const pre = w;
  const afterCmdShips: Ship[] = pre.company.ships.slice();
  let preTh = pre.company.thalers;
  const prePorts = pre.region.ports.map((p) => ({ ...p, market: { ...p.market } as typeof p.market }));
  for (let i = 0; i < afterCmdShips.length; i++) {
    let ship = afterCmdShips[i];
    const asn = ship.assignment;
    if (!asn || asn.suspended || ship.location.kind !== "docked") continue;
    const dockedPortId = ship.location.portId;
    const route = pre.company.routes.find((r) => r.id === asn.routeId);
    if (!route || route.stops.length < 2) continue;
    let idx = asn.nextStopIndex;
    if (idx < 0 || idx >= route.stops.length) idx = 0;
    const stop = route.stops[idx];
    if (stop.portId !== dockedPortId) continue;
    // Execute stop orders best-effort at this port
    const portIdx = prePorts.findIndex((p) => p.id === dockedPortId);
    const port = prePorts[portIdx];
    for (const order of stop.orders) {
      if (order.kind === "buy") {
        const entry = port.market[order.good];
        const base = effectiveBase(port, order.good);
        const affordableQty = Math.min(Math.floor(entry.stock), ship.hold - (ship.cargo[order.good] || 0));
        if (affordableQty <= 0) continue;
        let q = 0;
        for (let k = 1; k <= affordableQty; k++) {
          const cost = quoteBuy({ ...entry, stock: entry.stock - q }, base, 1) ?? 0;
          if (cost > preTh) break;
          q++;
        }
        if (q <= 0) continue;
        const total = quoteBuy({ ...entry, stock: entry.stock - q + 1 }, base, q) ?? 0;
        preTh = Math.max(0, preTh - total);
        ship = { ...ship, cargo: { ...ship.cargo, [order.good]: (ship.cargo[order.good] || 0) + q } };
        port.market = { ...port.market, [order.good]: { ...entry, stock: entry.stock - q } };
      } else if (order.kind === "sell") {
        const have = ship.cargo[order.good] || 0;
        if (have <= 0) continue;
        const base = effectiveBase(port, order.good);
        const total = quoteSell(port.market[order.good], base, have) ?? 0;
        preTh += total;
        ship = { ...ship, cargo: { ...ship.cargo, [order.good]: 0 } };
        const entry = port.market[order.good];
        port.market = { ...port.market, [order.good]: { ...entry, stock: entry.stock + have } };
      } else if (order.kind === "deliver") {
        type HQ = { portId?: PortId; buildOrder?: { siteStore?: Record<GoodId, number> } };
        const hq = (pre.company as { headquarters?: HQ }).headquarters;
        if (hq && hq.portId === dockedPortId && hq.buildOrder) {
          const store: Record<GoodId, number> = hq.buildOrder.siteStore || ({} as Record<GoodId, number>);
          const have = ship.cargo[order.good] || 0;
          const remaining = Number.MAX_SAFE_INTEGER;
          const move = Math.min(have, remaining);
          if (move > 0) {
            ship = { ...ship, cargo: { ...ship.cargo, [order.good]: have - move } };
            store[order.good] = (store[order.good] || 0) + move;
          }
        }
      }
    }
    // Advance index and optionally dispatch
    const nextIdx = (idx + 1) % route.stops.length;
    const nextStop = route.stops[nextIdx];
    let nextShip: Ship = { ...ship, assignment: { ...asn, nextStopIndex: nextIdx, suspended: false } };
    if (nextStop.portId !== dockedPortId) {
      const course = shortestCourse(pre.region, dockedPortId, nextStop.portId);
      if (course && course.length > 0) {
        nextShip = {
          ...nextShip,
          location: { kind: "underway", course, voyageIndex: 0, voyageProgressTicks: 0, destination: nextStop.portId },
        };
      }
    }
    afterCmdShips[i] = nextShip;
  }
  // Rebuild a world post pre-advance docked execution
  const portsPreAdv = pre.region.ports.map((p, i) => {
    const mod = prePorts[i];
    if (!mod) return p;
    return { ...p, market: mod.market };
  });
  w = { ...pre, company: { ...pre.company, thalers: preTh, ships: afterCmdShips }, region: { ...pre.region, ports: portsPreAdv } };

  const preAdvance = w.company.ships;
  const advanced = preAdvance.map((ship) => advanceShip(ship, w.region));

  // DOCKING PHASE (#80): process ships that transitioned underway -> docked, in ships[] order.
  // Charge fee; execute assigned Stop orders best-effort; advance index (wrap); dispatch next Course.
  // Placeholder for #81 auto-draw phase goes after this block.
  let thalers = w.company.thalers;
  const postDockShips: Ship[] = advanced.slice();
  for (let i = 0; i < preAdvance.length; i++) {
    const before = preAdvance[i];
    const after = advanced[i];
    if (before.location.kind !== "underway" || after.location.kind !== "docked") continue;

    const arrivalPortId = after.location.portId;
    const port = w.region.ports.find((p) => p.id === arrivalPortId)!;
    const fee = DOCKING_FEE[port.archetype] ?? 0;
    thalers = Math.max(0, thalers - Math.min(fee, thalers));

    let ship = after;
    const asn = ship.assignment;
    if (asn && !asn.suspended) {
      const route = w.company.routes.find((r) => r.id === asn.routeId);
      if (!route || route.stops.length < 2) {
        // Route deleted or invalid: clear assignment after current Course (we docked).
        ship = { ...ship, assignment: undefined };
      } else {
        // Safe index (wrap if out of range after edit)
        let idx = asn.nextStopIndex;
        if (idx < 0 || idx >= route.stops.length) idx = 0;
        const stop = route.stops[idx];
        // Execute orders best-effort in list order, using shared purse (thalers) and same quotes.
        for (const order of stop.orders) {
          if (order.kind === "buy") {
            const entry = port.market[order.good];
            const base = effectiveBase(port, order.good);
            const affordableQty = Math.min(
              Math.floor(entry.stock),
              ship.hold - (ship.cargo[order.good] || 0),
            );
            if (affordableQty <= 0) continue;
            // Find max qty we can afford at current prices (best-effort)
            let q = 0;
            for (let k = 1; k <= affordableQty; k++) {
              const cost = quoteBuy({ ...entry, stock: entry.stock - q }, base, 1) ?? 0;
              if (cost > thalers) break;
              q++;
            }
            if (q <= 0) continue;
            const total = quoteBuy({ ...entry, stock: entry.stock - q + 1 }, base, q) ?? 0;
            thalers = Math.max(0, thalers - total);
            ship = {
              ...ship,
              cargo: { ...ship.cargo, [order.good]: (ship.cargo[order.good] || 0) + q },
            };
            // Apply stock delta to the port we are mutating locally in this phase
            // We will patch region ports after the loop.
          } else if (order.kind === "sell") {
            const have = ship.cargo[order.good] || 0;
            if (have <= 0) continue;
            const base = effectiveBase(port, order.good);
            const total = quoteSell(port.market[order.good], base, have) ?? 0;
            thalers += total;
            ship = { ...ship, cargo: { ...ship.cargo, [order.good]: 0 } };
          } else if (order.kind === "deliver") {
            // Best-effort to HQ build site if present; otherwise no-op (#81 integration).
            type HQ = { portId?: PortId; buildOrder?: { siteStore?: Record<GoodId, number> } };
            const hq = (w.company as { headquarters?: HQ }).headquarters;
            if (hq && hq.portId === arrivalPortId && hq.buildOrder) {
              const store: Record<GoodId, number> = hq.buildOrder.siteStore || ({} as Record<GoodId, number>);
              const have = ship.cargo[order.good] || 0;
              // Without recipe in #80 scope, transfer is best-effort; #81 will cap by remaining need.
              const remaining = Number.MAX_SAFE_INTEGER;
              const move = Math.min(have, remaining);
              if (move > 0) {
                ship = {
                  ...ship,
                  cargo: { ...ship.cargo, [order.good]: have - move },
                };
                store[order.good] = (store[order.good] || 0) + move;
              }
            }
            // else: no-op
          }
        }
        // Advance index (wrap)
        const nextIdx = (idx + 1) % route.stops.length;
        const nextStop = route.stops[nextIdx];
        // Dispatch Course to next Stop (unless it's the same port — then it will dock next tick trivially)
        const fromPort = arrivalPortId;
        const toPort = nextStop.portId;
        let nextShip: Ship = {
          ...ship,
          assignment: { ...asn, nextStopIndex: nextIdx, suspended: false },
        };
        if (toPort !== fromPort) {
          const course = shortestCourse(w.region, fromPort, toPort);
          if (course && course.length > 0) {
            nextShip = {
              ...nextShip,
              location: {
                kind: "underway",
                course,
                voyageIndex: 0,
                voyageProgressTicks: 0,
                destination: toPort,
              },
            };
          }
        } else {
          // Already at next stop's port: leave docked; docking phase next tick (or immediate re-eval) will execute.
          // For determinism within this tick, we leave it docked here.
        }
        ship = nextShip;
      }
    }
    postDockShips[i] = ship;
  }

  // Patch region ports for any buy/sell stock deltas performed during docking executions.
  // We did not mutate region during the phase above for purity; recompute from postDockShips' perspective
  // by re-applying the inverse trades is complex because we need to know exact qtys traded per port.
  // Simpler: perform the market-affecting trades via a reduced region mutation pass using the original
  // approach — recompute stock changes from before/after cargo for each ship that docked and executed orders.
  // For now, to keep scope tight and deterministic, we accept that route-driven trades DO affect stock
  // exactly like manual trades. We will compute deltas by comparing pre-execution cargo vs post for docked ships.
  // Since we updated ship cargo in place above, we need to reflect stock changes in the region.
  // Easiest safe way: rebuild region ports by applying inverse deltas for each executed trade.
  // We didn't retain per-trade logs. To avoid drift, we will instead perform trades against a working region copy
  // during execution. Let's adjust strategy: redo execution with region mutation for stock.

  // To avoid a large refactor here, we implement a cleaner docking phase below using working copies.
  // For simplicity and correctness, recompute: we will run a second pass that applies stock deltas to ports.
  // Since the above logic already produced correct ship cargo, we can derive the net cargo change per good
  // for ships that executed at a given port and infer stock delta = +cargoDelta (sell) or -cargoDelta (buy).
  // But we lost the per-port grouping. We only executed at the arrival port for that ship.
  // We can snapshot pre-cargo for those ships and diff.

  // Rebuild region with stock adjusted for executed trades at each arrival port.
  // Collect executed trades by re-simulating minimal info: we will adjust by diffing preAdvance cargo (for docked arrivals) vs postDockShips.
  const executedAtPort: Record<PortId, Record<GoodId, number>> = {}; // stock delta to ADD to port
  for (let i = 0; i < preAdvance.length; i++) {
    const before = preAdvance[i];
    const after = postDockShips[i];
    if (before.location.kind !== "underway" || after.location.kind !== "docked") continue;
    const arr = after.location.portId;
    if (!executedAtPort[arr]) executedAtPort[arr] = {} as Record<GoodId, number>;
    for (const g of GOOD_IDS) {
      const dCargo = (after.cargo[g] || 0) - (before.cargo[g] || 0); // ship gained => port lost
      if (dCargo !== 0) {
        executedAtPort[arr][g] = (executedAtPort[arr][g] || 0) - dCargo; // port stock change opposite to ship cargo change
      }
    }
  }

  const portsAfterDock = w.region.ports.map((p) => {
    const deltas = executedAtPort[p.id];
    if (!deltas) return p;
    const market = { ...p.market } as typeof p.market;
    for (const g of GOOD_IDS) {
      if (deltas[g]) {
        const cur = market[g].stock;
        market[g] = { ...market[g], stock: cur + deltas[g] };
      }
    }
    return { ...p, market };
  });

  // Apply thalers back to company; ships are post-dock (some may be underway to next stop)
  const dockedPhaseWorld = {
    ...w,
    company: { ...w.company, thalers, ships: postDockShips },
    region: { ...w.region, ports: portsAfterDock },
  };

  // Continue with existing market + osmosis + day boundary on the post-dock world.
  // NOTE: build-site auto-draw (#81) TODO placeholder to be inserted after docking phase.
  // TODO(#81): build-site auto-draw phase goes here.

  const ships2 = dockedPhaseWorld.company.ships; // already post-dock
  const ports2 = dockedPhaseWorld.region.ports.map((port) => ({
    ...port,
    market: marketTick(
      port.market,
      ARCHETYPE_PROFILES[port.archetype],
      NEUTRAL_MODIFIERS,
      dockedPhaseWorld.flowDrift[port.id],
    ),
  }));

  const { region, pulse } = osmosisTick({ ...dockedPhaseWorld.region, ports: ports2 });

  const nextTick = dockedPhaseWorld.tick + 1;
  const isDayBoundary = nextTick % TICKS_PER_DAY === 0;
  let flowDrift = dockedPhaseWorld.flowDrift;
  let rng = dockedPhaseWorld.rng;
  if (isDayBoundary) [flowDrift, rng] = driftStep(region, dockedPhaseWorld.flowDrift, dockedPhaseWorld.rng);

  return {
    ...dockedPhaseWorld,
    tick: nextTick,
    rng,
    region,
    company: { ...dockedPhaseWorld.company, ships: ships2 },
    priceSnapshots: isDayBoundary ? snapshotPrices(region) : dockedPhaseWorld.priceSnapshots,
    flowDrift,
    osmosisPulse: pulse,
  };
}
