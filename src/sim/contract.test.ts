import { describe, expect, it } from "vitest";
import { CONSTRUCTION_RESERVE, HEADQUARTERS_COST } from "./building";
import { applyCommand } from "./commands";
import { GOOD_IDS, type GoodId } from "./goods";
import { OFFERS_PER_GUILD_MAX, SHORTAGE_THRESHOLD } from "./guild";
import { shortestCourse } from "./pathfinding";
import { refreshContractOffers, type ActiveContract, type ContractOffer } from "./contract";
import { ARCHETYPE_PROFILES, TICKS_PER_DAY, type MarketGood, type Port, type Region } from "./region";
import { tick } from "./tick";
import { createWorld, type World } from "./world";

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

/** Agrarian port short on FOUR non-grain goods (grain is its own domain,
 *  always in surplus here) — more shortages than `OFFERS_PER_GUILD_MAX` — all
 *  sourced feasibly from one producer port. Shared by the cap test and the
 *  #200 held-slot test below. */
function fourShortageRegion(): Region {
  const priceBias = { grain: 1, textiles: 1, aetherSalt: 1, electronics: 1, timber: 1 };
  const goodEntry = (stock: number, equilibrium: number): MarketGood => ({ stock, equilibrium });

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
  return {
    ports: [agrarian, source],
    lanes: [{ id: "lane", a: agrarian.id, b: source.id, voyageTicks: 30 }],
  };
}

describe("refreshContractOffers (#93 — generation)", () => {
  it("generates an offer for a real shortage, sourced from the nearest net-producer, with a feasible basis", () => {
    const region = twoPortRegion(40, 10); // stock 10 < 0.5*100 threshold
    const offers = refreshContractOffers(region, [], REFERENCE_HOLD, []);

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
    // #226: the guild's only open offer is, trivially, its lowest-tier one —
    // the desperation clause stamps requiredRank 1 on it regardless of tier.
    expect(offer.requiredRank).toBe(1);
  });

  it("generates no offer when no good is short (stock at or above threshold)", () => {
    const region = twoPortRegion(40, 50); // exactly at 0.5 * 100 — not short
    const offers = refreshContractOffers(region, [], REFERENCE_HOLD, []);
    expect(offers).toEqual([]);
  });

  it("generates no offer when the shortage is real but no source is reachable (no lanes)", () => {
    const region = twoPortRegion(40, 10);
    const isolated: Region = { ports: region.ports, lanes: [] };
    const offers = refreshContractOffers(isolated, [], REFERENCE_HOLD, []);
    expect(offers).toEqual([]);
  });

  it("is idempotent: refreshing again with the same world state yields the same single offer (no duplicate for the same good/port)", () => {
    const region = twoPortRegion(40, 10);
    const first = refreshContractOffers(region, [], REFERENCE_HOLD, []);
    const second = refreshContractOffers(region, first, REFERENCE_HOLD, []);
    expect(second).toEqual(first);
  });

  it("causal expiry: a healed shortage drops its offer at the next refresh", () => {
    const shortRegion = twoPortRegion(40, 10);
    const offers = refreshContractOffers(shortRegion, [], REFERENCE_HOLD, []);
    expect(offers).toHaveLength(1);

    const healedRegion = twoPortRegion(40, 80); // recovered above threshold
    const refreshed = refreshContractOffers(healedRegion, offers, REFERENCE_HOLD, []);
    expect(refreshed).toEqual([]);
  });

  it("caps at OFFERS_PER_GUILD_MAX open offers per guild, keeping the largest shortfalls first", () => {
    expect(OFFERS_PER_GUILD_MAX).toBe(3);

    const region = fourShortageRegion();
    const offers = refreshContractOffers(region, [], REFERENCE_HOLD, []);
    expect(offers).toHaveLength(OFFERS_PER_GUILD_MAX);
    const goods = offers.map((o) => o.good).sort();
    // aetherSalt (40), timber (30), electronics (20) win over textiles (10).
    expect(goods).toEqual(["aetherSalt", "electronics", "timber"].sort());
  });

  it("#200: excludes a (port, good) already under an active contract from generation, even though the shortage persists", () => {
    const region = twoPortRegion(40, 10); // stock 10 < 0.5*100 threshold — still short
    const activeContract: ActiveContract = {
      id: "agrarian:agrarian-port:textiles",
      guildId: "agrarian",
      portId: "agrarian-port",
      good: "textiles",
      quotaPerPeriod: 10,
      periodDays: 7,
      minPeriods: 3,
      feePerPeriod: 100,
      tier: 1,
      requiredRank: 1,
      basis: { sourcePortId: "urban-port", roundTripTicks: 80, expectedTrips: 2 },
      startTick: 0,
      periodIndex: 0,
      deliveredThisPeriod: 0,
      consecutiveMisses: 0,
    };
    // No existing offer on the board (accepting removes it, per commands.ts),
    // yet the generator must not regenerate a ghost for the held (port, good).
    const offers = refreshContractOffers(region, [], REFERENCE_HOLD, [activeContract]);
    expect(offers).toEqual([]);
  });

  it("#200: a held (port, good) does not consume a slot of OFFERS_PER_GUILD_MAX — the other real shortages still fill it", () => {
    expect(OFFERS_PER_GUILD_MAX).toBe(3);
    const region = fourShortageRegion();

    // aetherSalt is the largest shortfall (40) and already under an active
    // contract — held, not on the board, and must not eat a cap slot.
    const activeContract: ActiveContract = {
      id: "agrarian:agrarian-port:aetherSalt",
      guildId: "agrarian",
      portId: "agrarian-port",
      good: "aetherSalt",
      quotaPerPeriod: 10,
      periodDays: 7,
      minPeriods: 3,
      feePerPeriod: 100,
      tier: 1,
      requiredRank: 1,
      basis: { sourcePortId: "source-port", roundTripTicks: 60, expectedTrips: 2 },
      startTick: 0,
      periodIndex: 0,
      deliveredThisPeriod: 0,
      consecutiveMisses: 0,
    };

    const offers = refreshContractOffers(region, [], REFERENCE_HOLD, [activeContract]);
    // All three remaining real shortages (timber 30, electronics 20,
    // textiles 10) fill the cap — the held aetherSalt never appears and never
    // starves a slot from the others.
    expect(offers).toHaveLength(OFFERS_PER_GUILD_MAX);
    const goods = offers.map((o) => o.good).sort();
    expect(goods).toEqual(["electronics", "textiles", "timber"].sort());
  });

  it("never emits two open offers for the same (good, port)", () => {
    const region = twoPortRegion(40, 10);
    const offers = refreshContractOffers(region, [], REFERENCE_HOLD, []);
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

      const offers = refreshContractOffers(region, [], REFERENCE_HOLD, []);

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
    const offersA = refreshContractOffers(world.region, [], REFERENCE_HOLD, []);
    const offersB = refreshContractOffers(world.region, [], REFERENCE_HOLD, []);
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

describe("#200: an accepted offer's (port, good) never regenerates a ghost offer across a day boundary", () => {
  /** Craters every non-domain good at every port — same forcing device as
   *  e3-guardrails.test.ts's `withCrateredImports` — so real shortages exist
   *  to accept a contract against and to keep persisting (no player
   *  deliveries here) across the boundaries under test. */
  function withCrateredImports(world: World): World {
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
                  ? port.market[good].stock
                  : 0,
            },
          ]),
        ) as Region["ports"][number]["market"],
      })),
    };
    return { ...world, region };
  }

  it("seed 1: accept an offer, cross a day boundary with the shortage persisting — no duplicate id, and the held (port,good) never eats a cap slot from real shortages", () => {
    let world = createWorld(1);
    world = {
      ...world,
      company: { ...world.company, thalers: HEADQUARTERS_COST + CONSTRUCTION_RESERVE + 100_000 },
    };
    world = applyCommand(world, { kind: "foundHeadquarters", portId: world.region.ports[0].id });
    world = withCrateredImports(world);
    for (let i = 0; i < TICKS_PER_DAY; i++) world = tick(world, []);

    expect(world.contractOffers.length).toBeGreaterThan(0);
    const guildWithOffers = world.contractOffers[0].guildId;
    const preAcceptCount = world.contractOffers.filter((o) => o.guildId === guildWithOffers).length;

    // A freshly enrolled Company is rank 1 — pick a tier-1 offer of that guild
    // so acceptance isn't blocked by the accept-side rank gate.
    const offer = world.contractOffers.find((o) => o.guildId === guildWithOffers && o.tier === 1);
    expect(offer).toBeDefined();
    world = applyCommand(world, { kind: "enroll", guildId: offer!.guildId });
    world = applyCommand(world, { kind: "acceptContract", offerId: offer!.id });
    expect(world.company.contracts).toHaveLength(1);
    expect(world.contractOffers.some((o) => o.id === offer!.id)).toBe(false);

    // Cross several day boundaries with the shortage left untouched (no
    // fulfilment commands) — the accepted contract's (port, good) is still
    // genuinely short every time.
    for (let i = 0; i < 5 * TICKS_PER_DAY; i++) world = tick(world, []);

    // No ghost: the accepted contract's structural id never reappears as an
    // offer.
    expect(world.contractOffers.some((o) => o.id === offer!.id)).toBe(false);
    expect(
      world.contractOffers.some((o) => o.portId === offer!.portId && o.good === offer!.good),
    ).toBe(false);

    // The cap isn't starved by the held (port, good): the guild's board still
    // carries as many real offers as it did before accepting (the accepted
    // slot backfills with another real shortage, if any existed, rather than
    // permanently losing a slot to a ghost) — never fewer than
    // preAcceptCount - 1 real offers stuck behind a phantom.
    const postOffers = world.contractOffers.filter((o) => o.guildId === guildWithOffers);
    expect(postOffers.length).toBeLessThanOrEqual(OFFERS_PER_GUILD_MAX);
    expect(postOffers.length).toBeGreaterThanOrEqual(preAcceptCount - 1);
    for (const o of postOffers) expect(o.id).not.toBe(offer!.id);
  });
});

/** Two agrarian ports short of textiles, sourced from the same producer at
 *  different distances — tier 2 (near) and tier 3 (far) — so, by
 *  construction, no tier-1 candidate exists for this guild. Pins the
 *  desperation clause's tier decoupling (issue #226): even with nothing at
 *  tier 1, the guild's lowest-tier offer is still guaranteed requiredRank 1. */
function twoTierAgrarianRegion(): Region {
  const priceBias = { grain: 1, textiles: 1, aetherSalt: 1, electronics: 1, timber: 1 };
  const goodEntry = (stock: number, equilibrium: number): MarketGood => ({ stock, equilibrium });

  const near: Port = {
    id: "agrarian-near",
    name: "Agrarian Near",
    archetype: "agrarian",
    x: 0,
    y: 0,
    priceBias,
    market: {
      grain: goodEntry(400, 400),
      textiles: goodEntry(10, 100), // shortfall 40
      aetherSalt: goodEntry(100, 100),
      electronics: goodEntry(100, 100),
      timber: goodEntry(100, 100),
    },
  };
  const far: Port = {
    id: "agrarian-far",
    name: "Agrarian Far",
    archetype: "agrarian",
    x: 2,
    y: 0,
    priceBias,
    market: {
      grain: goodEntry(400, 400),
      textiles: goodEntry(10, 100), // same shortfall depth — tier is the only difference
      aetherSalt: goodEntry(100, 100),
      electronics: goodEntry(100, 100),
      timber: goodEntry(100, 100),
    },
  };
  const producer: Port = {
    id: "urban-port",
    name: "Urban Port",
    archetype: "urban",
    x: 1,
    y: 0,
    priceBias,
    market: {
      grain: goodEntry(100, 100),
      textiles: goodEntry(300, 100),
      aetherSalt: goodEntry(100, 100),
      electronics: goodEntry(100, 100),
      timber: goodEntry(100, 100),
    },
  };
  return {
    ports: [near, far, producer],
    lanes: [
      { id: "lane-near", a: near.id, b: producer.id, voyageTicks: 50 }, // round trip 100 -> tier 2
      { id: "lane-far", a: far.id, b: producer.id, voyageTicks: 70 }, // round trip 140 -> tier 3
    ],
  };
}

/** Two same-tier agrarian ports (identical distance to the shared producer)
 *  with different shortfall depth — isolates the clause's tie-break from
 *  the tier axis (issue #226: "tie-break deepest shortfall, matching the
 *  existing candidate sort"). */
function sameTierDifferentShortfallRegion(): Region {
  const priceBias = { grain: 1, textiles: 1, aetherSalt: 1, electronics: 1, timber: 1 };
  const goodEntry = (stock: number, equilibrium: number): MarketGood => ({ stock, equilibrium });

  const shallow: Port = {
    id: "agrarian-shallow",
    name: "Agrarian Shallow",
    archetype: "agrarian",
    x: 0,
    y: 0,
    priceBias,
    market: {
      grain: goodEntry(400, 400),
      textiles: goodEntry(40, 100), // shortfall 10
      aetherSalt: goodEntry(100, 100),
      electronics: goodEntry(100, 100),
      timber: goodEntry(100, 100),
    },
  };
  const deep: Port = {
    id: "agrarian-deep",
    name: "Agrarian Deep",
    archetype: "agrarian",
    x: 2,
    y: 0,
    priceBias,
    market: {
      grain: goodEntry(400, 400),
      textiles: goodEntry(5, 100), // shortfall 45 — deeper than shallow
      aetherSalt: goodEntry(100, 100),
      electronics: goodEntry(100, 100),
      timber: goodEntry(100, 100),
    },
  };
  const producer: Port = {
    id: "urban-port",
    name: "Urban Port",
    archetype: "urban",
    x: 1,
    y: 0,
    priceBias,
    market: {
      grain: goodEntry(100, 100),
      textiles: goodEntry(300, 100),
      aetherSalt: goodEntry(100, 100),
      electronics: goodEntry(100, 100),
      timber: goodEntry(100, 100),
    },
  };
  return {
    ports: [shallow, deep, producer],
    lanes: [
      { id: "lane-shallow", a: shallow.id, b: producer.id, voyageTicks: 50 }, // tier 2
      { id: "lane-deep", a: deep.id, b: producer.id, voyageTicks: 50 }, // same tier 2
    ],
  };
}

describe("#226 desperation clause — requiredRank stamping (refreshContractOffers)", () => {
  it("with no tier-1 candidate, the guild's lowest-tier offer (tier 2) still gets requiredRank 1 — decoupled from tier", () => {
    const region = twoTierAgrarianRegion();
    const offers = refreshContractOffers(region, [], REFERENCE_HOLD, []);
    expect(offers).toHaveLength(2);

    const near = offers.find((o) => o.portId === "agrarian-near")!;
    const far = offers.find((o) => o.portId === "agrarian-far")!;
    expect(near.tier).toBe(2);
    expect(far.tier).toBe(3);
    expect(near.requiredRank).toBe(1); // clause winner: lowest tier in the guild
    expect(far.requiredRank).toBe(3); // unchanged: requiredRank === tier
  });

  it("tie-break within the same tier goes to the deepest shortfall (matches the existing candidate sort)", () => {
    const region = sameTierDifferentShortfallRegion();
    const offers = refreshContractOffers(region, [], REFERENCE_HOLD, []);
    expect(offers).toHaveLength(2);

    const shallow = offers.find((o) => o.portId === "agrarian-shallow")!;
    const deep = offers.find((o) => o.portId === "agrarian-deep")!;
    expect(shallow.tier).toBe(deep.tier); // same tier — confirms it's the tie-break under test
    expect(deep.requiredRank).toBe(1);
    expect(shallow.requiredRank).toBe(shallow.tier);
  });

  it("the clause migrates with the board: a shifted shortfall between refreshes moves requiredRank 1 to the new deepest offer", () => {
    const region = sameTierDifferentShortfallRegion();
    const first = refreshContractOffers(region, [], REFERENCE_HOLD, []);
    expect(first.find((o) => o.requiredRank === 1)!.portId).toBe("agrarian-deep");

    // Both offers survive (still short), same tier — but "shallow" is now the
    // deeper shortage. The stamp pass recomputes idempotently over the full
    // (survivor) result, so the clause must follow it.
    const deepenedRegion: Region = {
      ...region,
      ports: region.ports.map((p) =>
        p.id === "agrarian-shallow"
          ? { ...p, market: { ...p.market, textiles: { ...p.market.textiles, stock: 0 } } }
          : p,
      ),
    };
    const second = refreshContractOffers(deepenedRegion, first, REFERENCE_HOLD, []);
    expect(second).toHaveLength(2);
    expect(second.find((o) => o.requiredRank === 1)!.portId).toBe("agrarian-shallow");
  });
});

describe("#226 desperation clause — invariant across real worldgen seeds", () => {
  // Acceptance criterion (issue #226): "for every guild with >=1 open offer,
  // at least one is acceptable at rank 1" — i.e. min(requiredRank) === 1 per
  // guild, never "exactly one requiredRank === 1" (a guild with two natural
  // tier-1 offers legitimately has two offers at requiredRank 1).
  const SEEDS = [1, 7, 42, 99, 123];

  for (const seed of SEEDS) {
    it(`seed ${seed}: every guild with an open offer has at least one acceptable at rank 1`, () => {
      let world = createWorld(seed);
      for (let i = 0; i < 90 * TICKS_PER_DAY; i++) world = tick(world, []);

      const requiredRanksByGuild = new Map<string, number[]>();
      for (const offer of world.contractOffers) {
        const arr = requiredRanksByGuild.get(offer.guildId) ?? [];
        arr.push(offer.requiredRank);
        requiredRanksByGuild.set(offer.guildId, arr);
      }
      expect(requiredRanksByGuild.size).toBeGreaterThan(0); // precondition: offers actually exist

      for (const [, requiredRanks] of requiredRanksByGuild) {
        expect(Math.min(...requiredRanks)).toBe(1);
      }
    });
  }
});

describe("#226: inverted deadlock — a rank-1 company accepts and settles a tier>1 desperation-clause offer", () => {
  it("accept -> settle -> +1 point, end-to-end (the deadlock this issue fixes, inverted)", () => {
    let world = createWorld("deadlock-inverted");
    world = {
      ...world,
      company: { ...world.company, thalers: HEADQUARTERS_COST + CONSTRUCTION_RESERVE + 100_000 },
    };
    world = applyCommand(world, { kind: "foundHeadquarters", portId: world.region.ports[0].id });
    world = applyCommand(world, { kind: "enroll", guildId: "agrarian" }); // rank 1, 0 points

    const homePortId = world.region.ports[0].id;
    // An honest tier-3 job description — under the OLD gate
    // (rankOf(0) === 1 < tier 3) this acceptance would have been rejected,
    // reproducing the playtest deadlock (docs/design-notes/
    // playtest-2026-07-15-contractor.md). The clause guarantees requiredRank
    // 1 on the guild's lowest-tier offer regardless of tier.
    const offer: ContractOffer = {
      id: "agrarian:desperation-offer",
      guildId: "agrarian",
      portId: homePortId,
      good: "textiles",
      quotaPerPeriod: 1,
      periodDays: 1,
      minPeriods: 3,
      feePerPeriod: 50,
      tier: 3,
      requiredRank: 1,
      basis: { sourcePortId: homePortId, roundTripTicks: 10, expectedTrips: 1 },
    };
    world = { ...world, contractOffers: [offer] };

    world = applyCommand(world, { kind: "acceptContract", offerId: offer.id });
    expect(world.company.contracts).toHaveLength(1);

    // Quota met, then cross the (1-day) period's day boundary.
    world = {
      ...world,
      company: {
        ...world.company,
        contracts: world.company.contracts.map((c) => ({
          ...c,
          deliveredThisPeriod: c.quotaPerPeriod,
        })),
      },
    };
    for (let i = 0; i < TICKS_PER_DAY; i++) world = tick(world, []);

    expect(world.company.guilds.agrarian?.points).toBe(1);
  });
});
