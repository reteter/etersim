import { GOOD_IDS, type GoodId } from "./goods";
import { effectiveBase, price, STOCK_CAP_MULTIPLIER } from "./market";
import type { LaneId, PortId, Region } from "./region";

/**
 * Trade osmosis (docs/specs/E8-living-economy.md — Trade osmosis, Tech
 * §Osmosis): the region's slow self-balancing flow, a "lazy competitor" the
 * player always outruns. Deterministic, no RNG — every tick, small amounts
 * of stock move from the cheap to the expensive endpoint of each lane,
 * proportional to the relative price gap beyond a deadband, attenuated by
 * voyage length, and capped so a player ship is always faster at exploiting
 * a gap than osmosis is at closing it.
 */

/** No flow below this relative price gap; structural gradients from
 *  per-port bias survive at rest. */
export const OSMOSIS_DEADBAND = 0.15;
/** Flow scales with the gap beyond the deadband, divided by voyageTicks. */
export const OSMOSIS_RATE = 0.02;
/** Per-tick cap, as a fraction of the lane's average equilibrium — osmosis
 *  never teleports bulk cargo. */
export const OSMOSIS_CAP = 0.01;

export interface OsmosisResult {
  readonly region: Region;
  /** Signed, value-weighted net flow per lane this tick: positive = the
   *  lane's `a` endpoint sent goods to `b`, negative = `b` sent to `a`.
   *  Every lane gets an entry, 0 when nothing moved. */
  readonly pulse: Record<LaneId, number>;
}

/**
 * One tick of osmosis. All flows are computed from the pre-tick price
 * snapshot (the region exactly as passed in) and only applied afterwards,
 * in canonical lane × good order, so lane processing order never changes
 * the result. Pure: never mutates its input.
 */
export function osmosisTick(region: Region): OsmosisResult {
  const portsById = new Map(region.ports.map((port) => [port.id, port]));

  const priceSnapshot = new Map<PortId, Record<GoodId, number>>();
  for (const port of region.ports) {
    const prices = {} as Record<GoodId, number>;
    for (const good of GOOD_IDS) {
      prices[good] = price(port.market[good], effectiveBase(port, good));
    }
    priceSnapshot.set(port.id, prices);
  }

  // Running per-tick stock deltas, applied to a fresh region at the end.
  // Tracked while iterating so the hard limits (floor at 0, cap at the
  // top) hold correctly even when several lanes touch the same port in
  // the same tick — only the *prices* are frozen to the pre-tick snapshot.
  const deltas = new Map<PortId, Partial<Record<GoodId, number>>>();
  const stockAfterDeltas = (portId: PortId, good: GoodId): number =>
    portsById.get(portId)!.market[good].stock + (deltas.get(portId)?.[good] ?? 0);
  const addDelta = (portId: PortId, good: GoodId, amount: number): void => {
    const portDeltas = deltas.get(portId) ?? {};
    portDeltas[good] = (portDeltas[good] ?? 0) + amount;
    deltas.set(portId, portDeltas);
  };

  const pulse: Record<LaneId, number> = {};

  for (const lane of region.lanes) {
    pulse[lane.id] = 0;
    const portA = portsById.get(lane.a)!;
    const portB = portsById.get(lane.b)!;
    const pricesA = priceSnapshot.get(lane.a)!;
    const pricesB = priceSnapshot.get(lane.b)!;

    for (const good of GOOD_IDS) {
      const pA = pricesA[good];
      const pB = pricesB[good];
      const pLow = Math.min(pA, pB);
      const pHigh = Math.max(pA, pB);
      const gap = (pHigh - pLow) / pLow;
      if (gap <= OSMOSIS_DEADBAND) continue;

      const aIsCheap = pA <= pB;
      const cheapId = aIsCheap ? lane.a : lane.b;
      const expensiveId = aIsCheap ? lane.b : lane.a;
      const eqCheap = (aIsCheap ? portA : portB).market[good].equilibrium;
      const eqExpensive = (aIsCheap ? portB : portA).market[good].equilibrium;
      const eqAvg = (eqCheap + eqExpensive) / 2;

      let units = Math.min(
        (OSMOSIS_RATE * (gap - OSMOSIS_DEADBAND) * eqAvg) / lane.voyageTicks,
        OSMOSIS_CAP * eqAvg,
      );

      const availableStock = Math.max(0, stockAfterDeltas(cheapId, good));
      units = Math.min(units, availableStock);

      const cap = STOCK_CAP_MULTIPLIER * eqExpensive;
      const headroom = Math.max(0, cap - stockAfterDeltas(expensiveId, good));
      units = Math.min(units, headroom);

      if (units <= 0) continue;

      addDelta(cheapId, good, -units);
      addDelta(expensiveId, good, units);

      const midPrice = (pA + pB) / 2;
      const value = units * midPrice;
      pulse[lane.id] += expensiveId === lane.b ? value : -value;
    }
  }

  const ports = region.ports.map((port) => {
    const portDeltas = deltas.get(port.id);
    if (!portDeltas) return port;
    const market = { ...port.market };
    for (const good of GOOD_IDS) {
      const delta = portDeltas[good];
      if (delta) market[good] = { ...market[good], stock: market[good].stock + delta };
    }
    return { ...port, market };
  });

  return { region: { ...region, ports }, pulse };
}
