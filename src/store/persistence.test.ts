import { describe, expect, it } from "vitest";
import {
  createWorld,
  tick,
  type ContractOffer,
  type World,
} from "../sim";
import {
  AUTOSAVE_KEY,
  clearAutosave,
  exportWorldJson,
  hasAutosave,
  loadAutosave,
  parseWorldJson,
  saveAutosave,
  SAVE_VERSION,
  type StorageLike,
} from "./persistence";

/** In-memory StorageLike so round-trips need no browser (Vitest runs in node). */
function fakeStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    },
    removeItem: (k) => {
      map.delete(k);
    },
  };
}

/** A world driven a few hundred ticks so time, prices, cargo and RNG have moved. */
function midSessionWorld(): World {
  let world = createWorld("save-round-trip");
  world = tick(world, [{ kind: "buy", shipId: "s0", good: "grain", qty: 3 }]);
  for (let i = 0; i < 250; i++) world = tick(world, []);
  return world;
}

/** A world carrying every E9 addition — a Route, an assigned ship, a
 *  Headquarters with a partially-filled Build Order — driven a while. */
function e9World(): World {
  const base = createWorld("e9-save");
  const a = base.region.lanes[0].a;
  const b = base.region.lanes[0].b;
  const route = {
    id: "r",
    name: "loop",
    stops: [
      { portId: a, orders: [{ kind: "buy" as const, good: "grain" as const }] },
      { portId: b, orders: [{ kind: "sell" as const, good: "grain" as const }] },
    ],
  };
  const homeShip = base.company.ships[0];
  let world: World = {
    ...base,
    company: {
      ...base.company,
      thalers: 20000,
      routes: [route],
      ships: [{ ...homeShip, location: { kind: "docked", portId: a } }],
    },
  };
  world = tick(world, [
    { kind: "foundHeadquarters", portId: a },
    { kind: "assignRoute", shipId: "s0", routeId: "r" },
  ]);
  world = tick(world, [{ kind: "placeBuildOrder" }]);
  for (let i = 0; i < 60; i++) world = tick(world, []); // auto-draw fills the site, ship loops
  return world;
}

/** A world carrying one open offer and one active contract, then de-shaped
 *  back to the pre-#226 v9 wire format (no `requiredRank` on either) — the
 *  exact shape a v9 save on disk actually had, not a hand-invented literal. */
function v9SaveWithContractOffer(): { version: 9; world: World } {
  const base = createWorld("v9-migration");
  const homePortId = base.region.ports[0].id;
  const sourcePortId = base.region.ports[1].id;

  const offer: ContractOffer = {
    id: "agrarian:offer-tier2",
    guildId: "agrarian",
    portId: homePortId,
    good: "aetherSalt",
    quotaPerPeriod: 40,
    periodDays: 10,
    minPeriods: 4,
    feePerPeriod: 200,
    tier: 2,
    requiredRank: 2,
    basis: { sourcePortId, roundTripTicks: 120, expectedTrips: 2 },
  };
  const withOffer: World = {
    ...base,
    company: { ...base.company, guilds: { agrarian: { points: 0 } } },
    contractOffers: [offer],
  };

  const v9Offer: Record<string, unknown> = { ...offer };
  delete v9Offer.requiredRank;
  return {
    version: 9,
    world: { ...withOffer, contractOffers: [v9Offer] } as unknown as World,
  };
}

describe("persistence", () => {
  it("round-trips a mid-session world through JSON deep-equal (spec §Testing)", () => {
    const world = midSessionWorld();
    expect(parseWorldJson(exportWorldJson(world))).toEqual(world);
  });

  it("round-trips E9 state — routes, assignment, headquarters, build order (#80/#81)", () => {
    const world = e9World();
    // Preconditions: the save actually carries the new state we care about.
    expect(world.company.routes).toHaveLength(1);
    expect(world.company.headquarters?.buildOrder).toBeDefined();
    expect(world.company.ships[0].assignment).toBeDefined();
    const restored = parseWorldJson(exportWorldJson(world));
    expect(restored).toEqual(world);
    expect(restored.company.headquarters!.buildOrder!.siteStore).toEqual(
      world.company.headquarters!.buildOrder!.siteStore,
    );
    expect(restored.company.ships[0].assignment).toEqual(world.company.ships[0].assignment);
  });

  it("round-trips a mid-session world through the autosave slot", () => {
    const storage = fakeStorage();
    const world = midSessionWorld();
    saveAutosave(world, storage);
    expect(loadAutosave(storage)).toEqual(world);
  });

  it("round-trips the Ledger byte-for-byte through the autosave store bridge (docs/specs/E9 — Ledger: 'serialized with the save')", () => {
    const storage = fakeStorage();
    const world = midSessionWorld(); // a buy + 250 ticks: trade + several day-boundary netWorth events
    expect(world.ledger.length).toBeGreaterThan(0); // precondition: the fixture actually produced events
    saveAutosave(world, storage);
    const restored = loadAutosave(storage);
    expect(restored).not.toBeNull();
    expect(JSON.stringify(restored?.ledger)).toBe(JSON.stringify(world.ledger));
  });

  it("hasAutosave reflects whether a readable slot exists", () => {
    const storage = fakeStorage();
    expect(hasAutosave(storage)).toBe(false);
    saveAutosave(midSessionWorld(), storage);
    expect(hasAutosave(storage)).toBe(true);
  });

  it("loadAutosave returns null when the slot is absent", () => {
    expect(loadAutosave(fakeStorage())).toBeNull();
  });

  it("loadAutosave returns null on a version mismatch", () => {
    const storage = fakeStorage();
    const world = midSessionWorld();
    storage.setItem(AUTOSAVE_KEY, JSON.stringify({ version: SAVE_VERSION + 1, world }));
    expect(loadAutosave(storage)).toBeNull();
    expect(hasAutosave(storage)).toBe(false);
  });

  it("loadAutosave returns null on unparseable content", () => {
    const storage = fakeStorage();
    storage.setItem(AUTOSAVE_KEY, "{ not json");
    expect(loadAutosave(storage)).toBeNull();
  });

  it("clearAutosave empties the slot", () => {
    const storage = fakeStorage();
    saveAutosave(midSessionWorld(), storage);
    clearAutosave(storage);
    expect(loadAutosave(storage)).toBeNull();
  });

  it("parseWorldJson throws on garbage input", () => {
    expect(() => parseWorldJson("not json at all")).toThrow();
  });

  it("parseWorldJson throws on an unsupported version", () => {
    const world = midSessionWorld();
    const text = JSON.stringify({ version: SAVE_VERSION + 1, world });
    expect(() => parseWorldJson(text)).toThrow();
  });

  it("exportWorldJson stamps the current save version", () => {
    const parsed = JSON.parse(exportWorldJson(midSessionWorld()));
    expect(parsed.version).toBe(SAVE_VERSION);
  });

  describe("v9 -> v10 migration (issue #226 — desperation clause adds requiredRank)", () => {
    it("parseWorldJson backfills requiredRank: tier onto a v9 contract offer, otherwise unchanged", () => {
      const v9Save = v9SaveWithContractOffer();
      const text = JSON.stringify(v9Save);

      const migrated = parseWorldJson(text);

      expect(migrated.contractOffers).toHaveLength(1);
      expect(migrated.contractOffers[0]).toEqual({
        ...(v9Save.world.contractOffers[0] as ContractOffer),
        requiredRank: (v9Save.world.contractOffers[0] as ContractOffer).tier,
      });
      // Nothing else in the world was touched by the migration.
      expect(migrated).toEqual({ ...v9Save.world, contractOffers: migrated.contractOffers });
    });

    it("loadAutosave transparently migrates a v9 slot, so an old save keeps loading (incident 0009 concern)", () => {
      const storage = fakeStorage();
      const v9Save = v9SaveWithContractOffer();
      storage.setItem(AUTOSAVE_KEY, JSON.stringify(v9Save));

      const restored = loadAutosave(storage);
      expect(restored).not.toBeNull();
      expect(hasAutosave(storage)).toBe(true);
      expect(restored!.contractOffers[0]).toMatchObject({ requiredRank: 2 });
    });

    it("a save older than v9 is still rejected — migration is one step, not open-ended", () => {
      const storage = fakeStorage();
      const world = midSessionWorld();
      storage.setItem(AUTOSAVE_KEY, JSON.stringify({ version: 8, world }));
      expect(loadAutosave(storage)).toBeNull();
    });
  });
});
