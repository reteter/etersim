import { applyCommand, type Command } from "./commands";
import { marketTick } from "./market";
import { ARCHETYPE_PROFILES, TICKS_PER_DAY } from "./region";
import { advanceShip } from "./ship";
import { snapshotPrices, type World } from "./world";

export type { Command };

/**
 * Advances the World by exactly one tick (ADR-0003). Pure: never mutates
 * its input. Phase order per docs/specs/E2-trade-loop.md — Tech:
 * apply commands → advance ships → market tick → tick+1.
 */
export function tick(world: World, commands: readonly Command[]): World {
  let w = world;
  for (const command of commands) w = applyCommand(w, command);

  const ships = w.company.ships.map((ship) => advanceShip(ship, w.region));
  const ports = w.region.ports.map((port) => ({
    ...port,
    market: marketTick(port.market, ARCHETYPE_PROFILES[port.archetype]),
  }));

  const region = { ...w.region, ports };
  const nextTick = w.tick + 1;
  return {
    ...w,
    tick: nextTick,
    region,
    company: { ...w.company, ships },
    priceSnapshots:
      nextTick % TICKS_PER_DAY === 0 ? snapshotPrices(region) : w.priceSnapshots,
  };
}
