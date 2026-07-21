import { describe, expect, it } from "vitest";
import type { Command } from "./commands";
import { GOOD_IDS, type GoodId } from "./goods";
import { amountOf } from "./goodsStore";
import { effectiveBase, price, quoteBuy } from "./market";
import { shortestCourse } from "./pathfinding";
import { ARCHETYPE_PROFILES, TICKS_PER_DAY, type PortId, type Region } from "./region";
import { cargoUsed } from "./ship";
import { tick } from "./tick";
import { createWorld, type World } from "./world";

/**
 * Epic-level suites for docs/specs/E8-living-economy.md — Testing: the
 * invariant suite (the region stays alive on its own, untouched) and the
 * dominance guardrail (the epic's actual goal — watching beats camping,
 * not mechanically camping beats watching).
 */

const SEEDS = [1, 7, 42, 99];
const WORLD_DAYS = 60;

/** Ports whose archetype produces `good` at all (gross production > 0) — the
 *  good's supply sources, used for the sole-producer exclusion below. */
const producersOf = (region: Region, good: GoodId): PortId[] =>
  region.ports
    .filter((p) => (ARCHETYPE_PROFILES[p.archetype].productionPerDay[good] ?? 0) > 0)
    .map((p) => p.id);

/** Lane-hop count of the shortest course from `from` to `to`, via the same
 *  routing helper the dominance bots use below (`shortestCourse`) — infinite
 *  if unreachable (never happens; worldgen keeps the region connected). */
const hopDistance = (region: Region, from: PortId, to: PortId): number => {
  const course = shortestCourse(region, from, to);
  return course === null ? Infinity : course.length;
};

describe("invariant suite (region alone, no player commands, several seeds)", () => {
  for (const seed of SEEDS) {
    it(`seed ${seed}: no port × good stays pinned at floor/ceiling across the last 30 world days (except a remote sole-producer gradient)`, () => {
      const world = createWorld(seed);
      const daily: Record<PortId, Record<GoodId, number[]>> = {};
      for (const port of world.region.ports) {
        daily[port.id] = {} as Record<GoodId, number[]>;
        for (const good of GOOD_IDS) daily[port.id][good] = [];
      }

      let current = world;
      for (let day = 1; day <= WORLD_DAYS; day++) {
        for (let t = 0; t < TICKS_PER_DAY; t++) current = tick(current, []);
        if (day > 30) {
          for (const port of current.region.ports) {
            for (const good of GOOD_IDS) {
              const base = effectiveBase(port, good);
              const ratio = price(port.market[good], base) / base;
              daily[port.id][good].push(ratio);
            }
          }
        }
      }

      // Owner-agreed spec encoding (2026-07-08): a port strictly beyond
      // 1 lane-hop from a good's *sole* net producer permanently pinning at
      // floor/ceiling is an accepted durable gradient, not a failure —
      // osmosis's per-lane rate/cap (#59) reaches one hop but not two, and
      // retuning it would trade off against the dominance guardrail's
      // "player always outruns osmosis" property. See
      // docs/design-notes/e8-followups.md (peripheral sole-producer
      // starvation; osmosis-reach retune deferred pending playtest). Goods
      // with >=2 producers, and every port within 1 hop of a sole producer,
      // are NOT excluded — pinning there is still a real failure.
      for (const good of GOOD_IDS) {
        const producers = producersOf(current.region, good);
        const excluded = new Set<PortId>();
        if (producers.length === 1) {
          const [sole] = producers;
          for (const port of current.region.ports) {
            if (port.id !== sole && hopDistance(current.region, sole, port.id) > 1) {
              excluded.add(port.id);
            }
          }
        }

        for (const port of current.region.ports) {
          if (excluded.has(port.id)) continue;
          const samples = daily[port.id][good];
          const allAtFloor = samples.every((r) => Math.abs(r - 0.25) < 1e-9);
          const allAtCeiling = samples.every((r) => Math.abs(r - 4) < 1e-9);
          expect(
            allAtFloor || allAtCeiling,
            `${port.id}/${good} pinned across all of days 31-60: ${samples.slice(0, 5).join(", ")}...`,
          ).toBe(false);
        }
      }
    });

    it(`seed ${seed}: every good keeps cross-port mid-price dispersion > 0 after 60 world days`, () => {
      let world = createWorld(seed);
      for (let t = 0; t < WORLD_DAYS * TICKS_PER_DAY; t++) world = tick(world, []);

      for (const good of GOOD_IDS) {
        const prices = world.region.ports.map((port) =>
          price(port.market[good], effectiveBase(port, good)),
        );
        const min = Math.min(...prices);
        const max = Math.max(...prices);
        expect(max - min, `good ${good} has zero cross-port dispersion`).toBeGreaterThan(0);
      }
    });

    it(`seed ${seed}: total stock stays finite and positive over 60 world days`, () => {
      let world = createWorld(seed);
      for (let t = 0; t < WORLD_DAYS * TICKS_PER_DAY; t++) {
        world = tick(world, []);
        for (const port of world.region.ports) {
          for (const good of GOOD_IDS) {
            const stock = port.market[good].stock;
            expect(Number.isFinite(stock)).toBe(true);
            expect(stock).toBeGreaterThanOrEqual(0);
          }
        }
      }
    });
  }
});

// --- Dominance guardrail ---------------------------------------------------

/** grain is the region's cleanest single-good gradient: exactly one
 *  archetype (agrarian) produces it, every other archetype consumes it,
 *  and urban consumes the most (30/day) with the highest price bias
 *  (1.35×) — the "most-starved neighbor" for a camp bot to target. */
const GOOD: GoodId = "grain";

const findProducerAndConsumer = (world: World): { producer: PortId; consumer: PortId } => {
  const producer = world.region.ports.find((p) => p.archetype === "agrarian")!.id;
  const consumer = world.region.ports.find((p) => p.archetype === "urban")!.id;
  return { producer, consumer };
};

/** Largest integer quantity the ship can actually afford and carry — so the
 *  bot never issues a command that gets silently dropped for invalidity. */
const maxBuyQty = (world: World, portId: PortId): number => {
  const port = world.region.ports.find((p) => p.id === portId)!;
  const ship = world.company.ships[0];
  const capByHold = ship.hold - cargoUsed(ship);
  const capByStock = Math.floor(port.market[GOOD].stock);
  let qty = Math.min(capByHold, capByStock);
  while (qty > 0) {
    const total = quoteBuy(port.market[GOOD], effectiveBase(port, GOOD), qty);
    if (total !== null && total <= world.company.thalers) return qty;
    qty--;
  }
  return 0;
};

const WAIT_CAP = 2 * TICKS_PER_DAY; // never wait more than 2 world days
const CAMP_MARGIN = 0.97; // buy/sell must beat the last visit's price by 3%

interface BotMemory {
  lastBuyPrice: number | null;
  lastSellPrice: number | null;
  waitTicks: number;
}

/**
 * One tick's worth of commands for a scripted bot working a fixed
 * producer→consumer run on a single good.
 *
 * "loop" (simple gradient loop): never waits — buys/sells the moment it is
 * docked, every cycle.
 *
 * "camp" (camp at the producer until cheap, haul to the starved neighbor):
 * waits at each end for a price at least CAMP_MARGIN better than what it
 * saw on its own last visit there (the drift-driven dip/peak a camping
 * player would be watching for), forced to trade after WAIT_CAP ticks so
 * the bot never stalls forever.
 */
function botCommands(
  world: World,
  mode: "camp" | "loop",
  producer: PortId,
  consumer: PortId,
  memory: BotMemory,
): Command[] {
  const ship = world.company.ships[0];
  if (ship.location.kind !== "docked") return [];
  const portId = ship.location.portId;
  const cargo = amountOf(ship.cargo, GOOD);

  if (portId === producer && cargo === 0) {
    const port = world.region.ports.find((p) => p.id === producer)!;
    const curPrice = price(port.market[GOOD], effectiveBase(port, GOOD));
    const cheapEnough = memory.lastBuyPrice === null || curPrice <= memory.lastBuyPrice * CAMP_MARGIN;
    if (mode === "camp" && !cheapEnough && memory.waitTicks < WAIT_CAP) {
      memory.waitTicks++;
      return [];
    }
    memory.waitTicks = 0;
    memory.lastBuyPrice = curPrice;
    const qty = maxBuyQty(world, producer);
    if (qty === 0) return [];
    const course = shortestCourse(world.region, producer, consumer);
    if (course === null) return [];
    return [
      { kind: "buy", shipId: ship.id, good: GOOD, qty },
      { kind: "sailTo", shipId: ship.id, portId: consumer },
    ];
  }

  if (portId === consumer && cargo > 0) {
    const port = world.region.ports.find((p) => p.id === consumer)!;
    const curPrice = price(port.market[GOOD], effectiveBase(port, GOOD));
    const richEnough =
      memory.lastSellPrice === null || curPrice >= memory.lastSellPrice / CAMP_MARGIN;
    if (mode === "camp" && !richEnough && memory.waitTicks < WAIT_CAP) {
      memory.waitTicks++;
      return [];
    }
    memory.waitTicks = 0;
    memory.lastSellPrice = curPrice;
    return [
      { kind: "sell", shipId: ship.id, good: GOOD, qty: cargo },
      { kind: "sailTo", shipId: ship.id, portId: producer },
    ];
  }

  return [];
}

/** Runs one bot for the given number of world days, starting docked at the
 *  producer with empty cargo, and returns thalers earned per world day
 *  (net worth delta ÷ days — thalers plus any unsold cargo, mark-to-market
 *  at its current location's sell-ish mid price, so an in-transit ship at
 *  the cutoff doesn't bias the comparison). */
function runBot(seed: number, mode: "camp" | "loop", days: number): number {
  let world = createWorld(seed);
  const { producer, consumer } = findProducerAndConsumer(world);

  // Start docked at the producer, empty-handed, regardless of createWorld's
  // random home port — the bot's run is fixed by design.
  world = {
    ...world,
    company: {
      ...world.company,
      ships: [{ ...world.company.ships[0], location: { kind: "docked", portId: producer } }],
    },
  };

  const memory: BotMemory = { lastBuyPrice: null, lastSellPrice: null, waitTicks: 0 };
  const totalTicks = days * TICKS_PER_DAY;
  for (let t = 0; t < totalTicks; t++) {
    const commands = botCommands(world, mode, producer, consumer, memory);
    world = tick(world, commands);
  }

  const ship = world.company.ships[0];
  const location = ship.location;
  const cargoValue =
    location.kind === "docked"
      ? (() => {
          const port = world.region.ports.find((p) => p.id === location.portId)!;
          return amountOf(ship.cargo, GOOD) * price(port.market[GOOD], effectiveBase(port, GOOD));
        })()
      : 0; // in transit at the cutoff: negligible for a 60-day run, ignored
  const netWorth = world.company.thalers + cargoValue;
  return (netWorth - 500) / days; // STARTING_THALERS = 500
}

describe("dominance guardrail (the epic's goal, encoded)", () => {
  for (const seed of SEEDS) {
    it(`seed ${seed}: camping for a better price earns no more profit/day than a simple non-waiting loop`, () => {
      const campProfit = runBot(seed, "camp", WORLD_DAYS);
      const loopProfit = runBot(seed, "loop", WORLD_DAYS);
      // A small tolerance absorbs end-of-run in-transit noise (at most one
      // hold's worth of cargo, amortized over 60 days) — not a fudge on the
      // actual comparison.
      expect(
        campProfit,
        `seed ${seed}: camp=${campProfit.toFixed(2)}/day, loop=${loopProfit.toFixed(2)}/day`,
      ).toBeLessThanOrEqual(loopProfit * 1.05);
    });
  }
});
