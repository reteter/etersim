import { describe, expect, it } from "vitest";
import { GOOD_IDS, type GoodId } from "./goods";
import { ARCHETYPE_PROFILES, PORT_ARCHETYPES } from "./region";

describe("port archetype profiles", () => {
  it("covers all five archetypes", () => {
    expect(PORT_ARCHETYPES).toEqual(["agrarian", "industrial", "urban", "mining", "verdant"]);
  });

  it("gives every good exactly one producing archetype (arbitrage invariant)", () => {
    for (const good of GOOD_IDS) {
      const producers = PORT_ARCHETYPES.filter(
        (a) => (ARCHETYPE_PROFILES[a].productionPerDay[good] ?? 0) > 0,
      );
      expect(producers, good).toHaveLength(1);
    }
  });

  it("gives every good at least two consuming archetypes (arbitrage invariant)", () => {
    for (const good of GOOD_IDS) {
      const consumers = PORT_ARCHETYPES.filter(
        (a) => (ARCHETYPE_PROFILES[a].consumptionPerDay[good] ?? 0) > 0,
      );
      expect(consumers.length, good).toBeGreaterThanOrEqual(2);
    }
  });

  it("never lets an archetype consume what it produces", () => {
    for (const archetype of PORT_ARCHETYPES) {
      const { productionPerDay, consumptionPerDay } = ARCHETYPE_PROFILES[archetype];
      for (const good of Object.keys(productionPerDay) as GoodId[]) {
        expect(consumptionPerDay[good], `${archetype}/${good}`).toBeUndefined();
      }
    }
  });

  it("uses only positive flow rates", () => {
    for (const archetype of PORT_ARCHETYPES) {
      const { productionPerDay, consumptionPerDay } = ARCHETYPE_PROFILES[archetype];
      for (const rate of [
        ...Object.values(productionPerDay),
        ...Object.values(consumptionPerDay),
      ]) {
        expect(rate).toBeGreaterThan(0);
      }
    }
  });
});
