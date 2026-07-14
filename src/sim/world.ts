import { generateShipName, type Headquarters } from "./building";
import type { GoodId } from "./goods";
import { GOOD_IDS } from "./goods";
import type { GuildId } from "./guild";
import type { LedgerEvent } from "./ledger";
import { effectiveBase, price } from "./market";
import type { LaneId, PortId, Region } from "./region";
import { nextInt, seedRng, type RngState } from "./rng";
import type { Route } from "./route";
import { emptyCargo, type Ship } from "./ship";
import { HEARTLAND, type RegionTemplate } from "./template";
import { generateRegion } from "./worldgen";

export const STARTING_THALERS = 500;
export const STARTING_HOLD = 50;

/** The player's trading enterprise (CONTEXT.md: Company). */
export interface Company {
  readonly thalers: number;
  readonly ships: readonly Ship[];
  /** Route templates owned by the Company (E9). */
  readonly routes: readonly Route[];
  /** Headquarters (E9): one per Company, unlocks routes and construction.
   *  `buildOrder` present iff an active build is in progress. */
  readonly headquarters?: Headquarters;
  /** Guild enrollment + progress (E3, guild.ts): enrolled iff the guild's key
   *  is present. Rank is always derived via `rankOf`, never stored here. */
  readonly guilds: Partial<Record<GuildId, { points: number }>>;
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
  /** Per-port, per-good drift multiplier on production/consumption rates
   *  (docs/specs/E8-living-economy.md — Stochastic flow drift). Starts at
   *  1.0 everywhere; stepped once per world day (tick.ts). */
  readonly flowDrift: Record<PortId, Record<GoodId, number>>;
  /** Signed, value-weighted net osmosis flow per lane from the last tick
   *  (docs/specs/E8-living-economy.md — Trade osmosis); transient display
   *  state for the UI's ambient layer, harmless to serialize. */
  readonly osmosisPulse: Record<LaneId, number>;
  /** Canonical event stream of every thaler/goods movement, plus daily
   *  net-worth snapshots (CONTEXT.md: Ledger; docs/specs/E9-fleet-and-routes.md
   *  — Ledger and the performance board). Full retention, appended at the
   *  point of mutation by `applyCommand`/tick phases (ledger.ts). */
  readonly ledger: readonly LedgerEvent[];
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

  // Generated, not "s0" (#54): the starting ship is named like any other —
  // shipCountBeforeLaunch 0, same cosmetic pool `launchIfComplete` draws
  // from. No RNG draw here — determinism (the region/home-port RNG stream
  // must stay untouched).
  const ship: Ship = {
    id: "s0",
    name: generateShipName(0),
    hold: STARTING_HOLD,
    cargo: emptyCargo(),
    location: { kind: "docked", portId: region.ports[homeIndex].id },
  };

  return {
    tick: 0,
    rng: rng2,
    region,
    company: { thalers: STARTING_THALERS, ships: [ship], routes: [], guilds: {} },
    priceSnapshots: snapshotPrices(region),
    flowDrift: initialFlowDrift(region),
    osmosisPulse: initialOsmosisPulse(region),
    ledger: [],
  };
}

/** Replace a ship in the Company fleet by id, preserving array order. The one
 *  home for this fold — commands and the tick route pass both build on it. */
export function replaceShip(world: World, ship: Ship): World {
  return {
    ...world,
    company: {
      ...world.company,
      ships: world.company.ships.map((s) => (s.id === ship.id ? ship : s)),
    },
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

/** Every port × good starts undrifted (1.0) — flow drift (E8) only kicks in
 *  once the first world day steps it. */
function initialFlowDrift(region: Region): Record<PortId, Record<GoodId, number>> {
  const drift: Record<PortId, Record<GoodId, number>> = {};
  for (const port of region.ports) {
    const goods = {} as Record<GoodId, number>;
    for (const good of GOOD_IDS) goods[good] = 1;
    drift[port.id] = goods;
  }
  return drift;
}

/** Every lane starts quiet — osmosis (E8) only pulses once a real
 *  disequilibrium crosses the deadband. */
function initialOsmosisPulse(region: Region): Record<LaneId, number> {
  const pulse: Record<LaneId, number> = {};
  for (const lane of region.lanes) pulse[lane.id] = 0;
  return pulse;
}
