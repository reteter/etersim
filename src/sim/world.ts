import type { GoodId } from "./goods";
import { GOOD_IDS } from "./goods";
import { effectiveBase, price } from "./market";
import type { PortId, Region } from "./region";
import { nextInt, seedRng, type RngState } from "./rng";
import { emptyCargo, type Ship } from "./ship";
import { HEARTLAND, type RegionTemplate } from "./template";
import { generateRegion } from "./worldgen";

export const STARTING_THALERS = 500;
export const STARTING_HOLD = 50;

/** The player's trading enterprise (CONTEXT.md: Company). */
export interface Company {
  readonly thalers: number;
  readonly ships: readonly Ship[];
}

/**
 * World: the complete simulation state (CONTEXT.md) — serializable and
 * deterministic given seed and player commands.
 */
export interface World {
  /** Current world time in ticks (1 tick = 1 world hour, ADR-0003). */
  readonly tick: number;
  /** RNG state; every random draw in the sim threads through this. */
  readonly rng: RngState;
  readonly region: Region;
  readonly company: Company;
  /** Prices at the last day boundary; the UI's trend arrows compare
   *  against these. Keyed by port, filled in ports/GOOD_IDS order. */
  readonly priceSnapshots: Record<PortId, Record<GoodId, number>>;
}

/** FNV-1a — maps a seed string onto the RNG's uint32 seed space. */
function hashSeed(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function createWorld(seed: number | string, template: RegionTemplate = HEARTLAND): World {
  const rng0 = seedRng(typeof seed === "number" ? seed : hashSeed(seed));
  const [region, rng1] = generateRegion(rng0, template);
  const [homeIndex, rng2] = nextInt(rng1, 0, region.ports.length - 1);

  const ship: Ship = {
    id: "s0",
    hold: STARTING_HOLD,
    cargo: emptyCargo(),
    location: { kind: "docked", portId: region.ports[homeIndex].id },
  };

  return {
    tick: 0,
    rng: rng2,
    region,
    company: { thalers: STARTING_THALERS, ships: [ship] },
    priceSnapshots: snapshotPrices(region),
  };
}

/** Current price of every good at every port, in deterministic order. */
export function snapshotPrices(region: Region): Record<PortId, Record<GoodId, number>> {
  const snapshot: Record<PortId, Record<GoodId, number>> = {};
  for (const port of region.ports) {
    const prices = {} as Record<GoodId, number>;
    for (const good of GOOD_IDS) prices[good] = price(port.market[good], effectiveBase(port, good));
    snapshot[port.id] = prices;
  }
  return snapshot;
}
