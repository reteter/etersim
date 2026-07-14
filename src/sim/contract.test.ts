import { describe, expect, it } from "vitest";
import { GOOD_IDS, type GoodId } from "./goods";
import { OFFERS_PER_GUILD_MAX, SHORTAGE_THRESHOLD } from "./guild";
import { shortestCourse } from "./pathfinding";
import { refreshContractOffers, type ContractOffer } from "./contract";
import { ARCHETYPE_PROFILES, TICKS_PER_DAY, type MarketGood, type Port, type Region } from "./region";
import { tick } from "./tick";
import { createWorld } from "./world";

const REFERENCE_HOLD = 50;

/** A minimal two-port region: `agrarian` (the shortage side) linked to
 *  `urban` (the healthy net-producer of textiles) by one lane of
 *  `voyageTicks` length — small enough to hand-compute every derived field. */
function twoPortRegion(voyageTicks: number, agrarianTextilesStock: number): Region {
  const goodEntry = (stock: number, equilibrium: number): MarketGood => ({ stock, equilibrium });
  const priceBias = { grain: 1, textiles: 1, aetherSalt: 1, electronics: 1, timber: 1 };

  const agrarian: Port = {
    id: "agrarian-port",
    name: "Agrarian Port",
    archetype: "agrarian",
    x: 0,
    y: 0,
    priceBias,
    market: {
      grain: goodEntry(400, 400), // healthy — not short
      textiles: goodEntry(agrarianTextilesStock, 100), // the shortage under test
      aetherSalt: goodEntry(100, 100),
      electronics: goodEntry(100, 100),
      timber: goodEntry(100, 100),
    },
  };

  const urban: Port = {
    id: "urban-port",
    name: "Urban Port",
    archetype: "urban",
    x: 1,
    y: 0,
    priceBias,
    market: {
      grain: goodEntry(100, 100),
      textiles: goodEntry(300, 100), // net-producer, healthy stock
      aetherSalt: goodEntry(100, 100),
      electronics: goodEntry(100, 100),
      timber: goodEntry(100, 100),
    },
  };

  return {
    ports: [agrarian, urban],
    lanes: [{ id: "lane-au", a: agrarian.id, b: urban.id, voyageTicks }],
  };
}

describe("refreshContractOffers (#93 — generation)", () => {
  it("generates an offer for a real shortage, sourced from the nearest net-producer, with a feasible basis", () => {
    const region = twoPortRegion(40, 10); // stock 10 < 0.5*100 threshold
    const offers = refreshContractOffers(region, [], REFERENCE_HOLD);

    expect(offers).toHaveLength(1);
    const offer = offers[0];
    expect(offer.guildId).toBe("agrarian");
    expect(offer.portId).toBe("agrarian-port");
    expect(offer.good).toBe("textiles");
    expect(offer.basis.sourcePortId).toBe("urban-port");
    expect(offer.basis.roundTripTicks).toBe(80); // 40 ticks each way
    // periodDays >= 2 * roundTripDays (80/24 = 3.33..) => ceil(6.67) = 7
    expect(offer.periodDays).toBe(7);
    // expectedTrips = floor(periodDays * TICKS_PER_DAY / roundTripTicks) = floor(168/80) = 2
    expect(offer.basis.expectedTrips).toBe(2);
    // quota <= 0.7 * expectedTrips * hold = floor(0.7*2*50) = 70
    expect(offer.quotaPerPeriod).toBe(70);
    expect(offer.tier).toBeGreaterThanOrEqual(1);
    expect(offer.tier).toBeLessThanOrEqual(4);
    expect(offer.feePerPeriod).toBeGreaterThan(0);
    expect(offer.minPeriods).toBeGreaterThanOrEqual(1);
    expect(offer.id).toBe("agrarian:agrarian-port:textiles");
  });

  it("generates no offer when no good is short (stock at or above threshold)", () => {
    const region = twoPortRegion(40, 50); // exactly at 0.5 * 100 — not short
    const offers = refreshContractOffers(region, [], REFERENCE_HOLD);
    expect(offers).toEqual([]);
  });

  it("generates no offer when the shortage is real but no source is reachable (no lanes)", () => {
    const region = twoPortRegion(40, 10);
    const isolated: Region = { ports: region.ports, lanes: [] };
    const offers = refreshContractOffers(isolated, [], REFERENCE_HOLD);
    expect(offers).toEqual([]);
  });

  it("is idempotent: refreshing again with the same world state yields the same single offer (no duplicate for the same good/port)", () => {
    const region = twoPortRegion(40, 10);
    const first = refreshContractOffers(region, [], REFERENCE_HOLD);
    const second = refreshContractOffers(region, first, REFERENCE_HOLD);
    expect(second).toEqual(first);
  });

  it("causal expiry: a healed shortage drops its offer at the next refresh", () => {
    const shortRegion = twoPortRegion(40, 10);
    const offers = refreshContractOffers(shortRegion, [], REFERENCE_HOLD);
    expect(offers).toHaveLength(1);

    const healedRegion = twoPortRegion(40, 80); // recovered above threshold
    const refreshed = refreshContractOffers(healedRegion, offers, REFERENCE_HOLD);
    expect(refreshed).toEqual([]);
  });

  it("caps at OFFERS_PER_GUILD_MAX open offers per guild, keeping the largest shortfalls first", () => {
    expect(OFFERS_PER_GUILD_MAX).toBe(3);

    const priceBias = { grain: 1, textiles: 1, aetherSalt: 1, electronics: 1, timber: 1 };
    const goodEntry = (stock: number, equilibrium: number): MarketGood => ({ stock, equilibrium });

    // agrarian port short on FOUR non-grain goods (grain is its own domain,
    // always in surplus here) — more shortages than OFFERS_PER_GUILD_MAX.
    const agrarian: Port = {
      id: "agrarian-port",
      name: "Agrarian Port",
      archetype: "agrarian",
      x: 0,
      y: 0,
      priceBias,
      market: {
        grain: goodEntry(400, 400),
        textiles: goodEntry(40, 100), // shortfall 10
        aetherSalt: goodEntry(10, 100), // shortfall 40 (largest)
        electronics: goodEntry(30, 100), // shortfall 20
        timber: goodEntry(20, 100), // shortfall 30
      },
    };
    // A source port producing every good, so every candidate is feasible.
    const source: Port = {
      id: "source-port",
      name: "Source Port",
      archetype: "urban",
      x: 1,
      y: 0,
      priceBias,
      market: {
        grain: goodEntry(100, 100),
        textiles: goodEntry(300, 100),
        aetherSalt: goodEntry(300, 100),
        electronics: goodEntry(300, 100),
        timber: goodEntry(300, 100),
      },
    };
    const region: Region = {
      ports: [agrarian, source],
      lanes: [{ id: "lane", a: agrarian.id, b: source.id, voyageTicks: 30 }],
    };

    const offers = refreshContractOffers(region, [], REFERENCE_HOLD);
    expect(offers).toHaveLength(OFFERS_PER_GUILD_MAX);
    const goods = offers.map((o) => o.good).sort();
    // aetherSalt (40), timber (30), electronics (20) win over textiles (10).
    expect(goods).toEqual(["aetherSalt", "electronics", "timber"].sort());
  });

  it("never emits two open offers for the same (good, port)", () => {
    const region = twoPortRegion(40, 10);
    const offers = refreshContractOffers(region, [], REFERENCE_HOLD);
    const keys = offers.map((o) => `${o.portId}:${o.good}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("SHORTAGE_THRESHOLD is 0.5 (spec constant, sits in guild.ts)", () => {
    expect(SHORTAGE_THRESHOLD).toBe(0.5);
  });
});

describe("refreshContractOffers — feasibility property (sample of real worldgen seeds)", () => {
  const SEEDS = [1, 7, 42, 99, 123];

  for (const seed of SEEDS) {
    it(`seed ${seed}: every generated offer is satisfiable at its own stated basis by one reference-hold ship`, () => {
      const world = createWorld(seed);
      // Force every port's non-domain goods toward shortage by zeroing stock,
      // so the generator actually has candidates to work with on this seed's
      // real geography (a fresh world's stocks start at equilibrium — no
      // shortages exist yet).
      const region: Region = {
        ...world.region,
        ports: world.region.ports.map((port) => ({
          ...port,
          market: Object.fromEntries(
            GOOD_IDS.map((good: GoodId) => [
              good,
              {
                ...port.market[good],
                stock:
                  (ARCHETYPE_PROFILES[port.archetype].productionPerDay[good] ?? 0) > 0
                    ? port.market[good].stock // domain good stays healthy (producer)
                    : 0, // every import good craters to 0 — a real shortage
              },
            ]),
          ) as Region["ports"][number]["market"],
        })),
      };

      const offers = refreshContractOffers(region, [], REFERENCE_HOLD);

      for (const offer of offers) {
        const course = shortestCourse(region, offer.basis.sourcePortId, offer.portId);
        expect(course).not.toBeNull();
        let oneWay = 0;
        for (const v of course!) oneWay += region.lanes.find((l) => l.id === v.laneId)!.voyageTicks;
        expect(offer.basis.roundTripTicks).toBe(oneWay * 2);

        const recomputedExpectedTrips = Math.floor(
          (offer.periodDays * TICKS_PER_DAY) / offer.basis.roundTripTicks,
        );
        expect(offer.basis.expectedTrips).toBe(recomputedExpectedTrips);
        expect(recomputedExpectedTrips).toBeGreaterThanOrEqual(2);

        const maxQuota = Math.floor(0.7 * offer.basis.expectedTrips * REFERENCE_HOLD);
        expect(offer.quotaPerPeriod).toBeLessThanOrEqual(maxQuota);
        expect(offer.periodDays).toBeGreaterThanOrEqual(
          Math.ceil((2 * offer.basis.roundTripTicks) / TICKS_PER_DAY),
        );
      }

      // No duplicate (good, port) and per-guild cap respected.
      const keys = offers.map((o: ContractOffer) => `${o.portId}:${o.good}`);
      expect(new Set(keys).size).toBe(keys.length);
      const perGuildCounts = new Map<string, number>();
      for (const o of offers) perGuildCounts.set(o.guildId, (perGuildCounts.get(o.guildId) ?? 0) + 1);
      for (const count of perGuildCounts.values()) expect(count).toBeLessThanOrEqual(OFFERS_PER_GUILD_MAX);
    });
  }

  it("determinism: same region state ⇒ identical offer sets, regardless of call count", () => {
    const world = createWorld(7);
    const offersA = refreshContractOffers(world.region, [], REFERENCE_HOLD);
    const offersB = refreshContractOffers(world.region, [], REFERENCE_HOLD);
    expect(offersA).toEqual(offersB);
  });
});

describe("World.contractOffers wiring through tick()/dayBoundary (#93)", () => {
  it("starts empty on a fresh World", () => {
    expect(createWorld(1).contractOffers).toEqual([]);
  });

  it("populates over natural ticks as unattended import goods run down toward shortage (no player commands)", () => {
    let world = createWorld(3);
    for (let i = 0; i < 90 * TICKS_PER_DAY; i++) world = tick(world, []);
    expect(world.contractOffers.length).toBeGreaterThan(0);
    for (const offer of world.contractOffers) {
      expect(offer.quotaPerPeriod).toBeGreaterThan(0);
      expect(offer.periodDays).toBeGreaterThan(0);
    }
  });

  it("determinism: same seed + no commands ⇒ identical offer sets after N days", () => {
    const run = () => {
      let world = createWorld(5);
      for (let i = 0; i < 60 * TICKS_PER_DAY; i++) world = tick(world, []);
      return world.contractOffers;
    };
    expect(run()).toEqual(run());
  });

  it("save/load round-trips World.contractOffers via a JSON round-trip", () => {
    let world = createWorld(3);
    for (let i = 0; i < 90 * TICKS_PER_DAY; i++) world = tick(world, []);
    expect(world.contractOffers.length).toBeGreaterThan(0);
    expect(JSON.parse(JSON.stringify(world)).contractOffers).toEqual(world.contractOffers);
  });
});
