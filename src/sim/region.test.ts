import { describe, expect, it } from "vitest";
import { GOOD_IDS, type GoodId } from "./goods";
import {
  ARCHETYPE_BIAS,
  ARCHETYPE_PROFILES,
  DOCKING_FEE,
  ECONOMIC_ARCHETYPES,
  PORT_ARCHETYPES,
} from "./region";

describe("port archetype profiles", () => {
  it("ECONOMIC_ARCHETYPES covers the five producing archetypes (the worldgen draw pool)", () => {
    expect(ECONOMIC_ARCHETYPES).toEqual(["agrarian", "industrial", "urban", "mining", "verdant"]);
  });

  it("PORT_ARCHETYPES is the five economic archetypes plus the neutral Free port (E12)", () => {
    expect(PORT_ARCHETYPES).toEqual([
      "agrarian",
      "industrial",
      "urban",
      "mining",
      "verdant",
      "freeport",
    ]);
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

describe("archetype price bias (E8)", () => {
  it("matches the spec's authored table (docs/specs/E8-living-economy.md)", () => {
    // Pinned literally so a typo in the constant can't hide behind tests
    // that derive their expectations from the constant itself. Retuning
    // the table is fine (tuning ≠ spec drift) — update spec and pin together.
    expect(ARCHETYPE_BIAS).toEqual({
      agrarian: { grain: 0.8, textiles: 1.2, aetherSalt: 1.15, electronics: 1.15, timber: 1.0 },
      industrial: { grain: 1.3, textiles: 1.0, aetherSalt: 1.25, electronics: 0.8, timber: 1.15 },
      urban: { grain: 1.35, textiles: 0.8, aetherSalt: 1.15, electronics: 1.2, timber: 1.2 },
      mining: { grain: 1.3, textiles: 1.15, aetherSalt: 0.8, electronics: 1.2, timber: 1.0 },
      verdant: { grain: 1.2, textiles: 1.2, aetherSalt: 1.0, electronics: 1.0, timber: 0.8 },
      freeport: { grain: 1.0, textiles: 1.0, aetherSalt: 1.0, electronics: 1.0, timber: 1.0 },
    });
  });

  it("biases produced goods below base and consumed goods above (gradient invariant)", () => {
    // The structural engine of trade: an archetype values what it consumes
    // above the global base and what it produces below it — so a resting
    // producer→consumer gradient exists for every good. Scoped to the five
    // economic archetypes: the Free port (E12) deliberately breaks this —
    // neutral bias (1.0) despite light consumption, by design (see the
    // freeport-specific test below).
    for (const archetype of ECONOMIC_ARCHETYPES) {
      const { productionPerDay, consumptionPerDay } = ARCHETYPE_PROFILES[archetype];
      for (const good of GOOD_IDS) {
        if ((productionPerDay[good] ?? 0) > 0) {
          expect(ARCHETYPE_BIAS[archetype][good], `${archetype}/${good}`).toBeLessThan(1);
        }
        if ((consumptionPerDay[good] ?? 0) > 0) {
          expect(ARCHETYPE_BIAS[archetype][good], `${archetype}/${good}`).toBeGreaterThan(1);
        }
      }
    }
  });

  it("the Free port is neutral: no production, light consumption, bias exactly 1.0 for every good (E12)", () => {
    expect(ARCHETYPE_PROFILES.freeport.productionPerDay).toEqual({});
    expect(ARCHETYPE_PROFILES.freeport.consumptionPerDay).toEqual({ grain: 6, textiles: 2 });
    for (const good of GOOD_IDS) {
      expect(ARCHETYPE_BIAS.freeport[good], good).toBe(1);
    }
  });
});

describe("docking fee (E9)", () => {
  it("charges the Free port the spec's mid-table fee of 10 (E12)", () => {
    expect(DOCKING_FEE.freeport).toBe(10);
  });
});
