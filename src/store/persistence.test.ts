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

/** A world with a routed ship mid-wait on an unmet Margin Gate (E9.1) — the
 *  one save shape invisible to any function of World before E9.1 (Tech —
 *  "Structural finding that shapes everything", docs/specs/E9.1). Must
 *  round-trip through the real persistence layer, not just a bare
 *  JSON.parse/stringify, so an envelope-layer bug (e.g. stripping `waiting`)
 *  is actually catchable. */
function gateWaitingWorld(): World {
  const base = createWorld("gate-wait-save");
  const a = base.region.lanes[0].a;
  const b = base.region.lanes[0].b;
  const route = {
    id: "gated",
    name: "gated",
    stops: [
      {
        portId: a,
        orders: [
          { kind: "buy" as const, good: "timber" as const }, // ungated sibling
          { kind: "buy" as const, good: "grain" as const, minMargin: 1_000_000 }, // never met
        ],
      },
      { portId: b, orders: [{ kind: "sell" as const, good: "grain" as const }] },
    ],
  };
  const homeShip = base.company.ships[0];
  let world: World = {
    ...base,
    company: {
      ...base.company,
      thalers: 5000,
      routes: [route],
      ships: [{ ...homeShip, location: { kind: "docked", portId: a } }],
    },
  };
  world = tick(world, [{ kind: "assignRoute", shipId: homeShip.id, routeId: "gated" }]);
  return world;
}

/** A world carrying one open offer and one active contract, then de-shaped
 *  back to the pre-#226 v9 wire format (no `requiredRank` on either) — the
 *  exact shape a v9 save on disk actually had, not a hand-invented literal.
 *  Used only to prove v9 is now rejected outright (E9.1 dropped the v9->v10
 *  hop, same precedent as v8's drop at the previous bump). */
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

/** A v11 save (post-E9.1, pre-E14): a world whose ships carry no `baseHold`
 *  at all — the exact shape a v11 save on disk actually had. Kept only to
 *  prove v11 is now rejected outright (#286 fix dropped the v11->v12 hop,
 *  same precedent as v9/v10's drop at the previous bumps). */
function v11Save(): { version: 11; world: World } {
  const world = e9World();
  const deshaped = {
    ...world,
    company: {
      ...world.company,
      ships: world.company.ships.map((ship) => {
        const rest: Record<string, unknown> = { ...ship };
        delete rest.baseHold;
        return rest;
      }),
    },
  } as unknown as World;
  return { version: 11, world: deshaped };
}

/** Drives a commissioned Shipyard's own construction site to activation via
 *  rush + tick, then starts and partially fills a Refit — a Headquarters, a
 *  fully-built Shipyard, and a partially-filled RefitOrder (E14 #275/#286). */
function refitInProgressWorld(): World {
  const base = createWorld("refit-save");
  const hqPortId = base.region.ports[0].id;
  const shipyardPortId = base.region.ports[1].id;
  const homeShip = base.company.ships[0];
  let world: World = {
    ...base,
    company: {
      ...base.company,
      thalers: 1_000_000,
      ships: [{ ...homeShip, location: { kind: "docked", portId: shipyardPortId } }],
    },
  };
  world = tick(world, [
    { kind: "foundHeadquarters", portId: hqPortId },
    { kind: "commissionShipyard", portId: shipyardPortId },
  ]);
  let guard = 0;
  while (world.company.shipyard?.site && guard++ < 500) {
    world = tick(world, [{ kind: "rushShipyard" }]);
  }
  world = tick(world, [{ kind: "commissionRefit", shipId: homeShip.id }]);
  for (let i = 0; i < 10; i++) world = tick(world, []); // let auto-draw gather some materials
  return world;
}

/** A Headquarters plus a commissioned Shipyard whose own construction site
 *  is still filling — mid-construction, not yet activated (E14 #286 fix). */
function shipyardConstructionInProgressWorld(): World {
  const base = createWorld("yard-construction-save");
  const hqPortId = base.region.ports[0].id;
  const shipyardPortId = base.region.ports[1].id;
  let world: World = { ...base, company: { ...base.company, thalers: 1_000_000 } };
  world = tick(world, [
    { kind: "foundHeadquarters", portId: hqPortId },
    { kind: "commissionShipyard", portId: shipyardPortId },
  ]);
  for (let i = 0; i < 10; i++) world = tick(world, []); // let auto-draw gather some materials
  return world;
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

  it("round-trips a mid-Refit world through the real persistence layer — Shipyard + RefitOrder identity (E14 #275)", () => {
    const world = refitInProgressWorld();
    // Preconditions: the fixture actually landed with a built Shipyard and
    // an active Refit whose site has gathered something (not a
    // freshly-opened empty one).
    expect(world.company.shipyard?.site).toBeUndefined(); // activated
    expect(world.company.shipyard?.refitOrder).toBeDefined();
    const anyDrawn = Object.values(world.company.shipyard!.refitOrder!.siteStore).some((qty) => qty > 0);
    expect(anyDrawn).toBe(true);
    const restored = parseWorldJson(exportWorldJson(world));
    expect(restored).toEqual(world);
    expect(restored.company.shipyard).toEqual(world.company.shipyard);
  });

  it("round-trips a mid-Shipyard-construction world through the real persistence layer (E14 #286 fix — the site field, not yet activated)", () => {
    const world = shipyardConstructionInProgressWorld();
    // Preconditions: the fixture actually landed with the Shipyard's own
    // site still active (not yet built) and having gathered something.
    expect(world.company.shipyard?.site).toBeDefined();
    const anyDrawn = Object.values(world.company.shipyard!.site!.siteStore).some((qty) => qty > 0);
    expect(anyDrawn).toBe(true);
    const restored = parseWorldJson(exportWorldJson(world));
    expect(restored).toEqual(world);
    expect(restored.company.shipyard).toEqual(world.company.shipyard);
  });

  it("round-trips a mid-wait Margin Gate ship through the real persistence layer (E9.1 — waiting is load-bearing state, ADR-0007)", () => {
    const world = gateWaitingWorld();
    // Precondition: the fixture actually landed in the waiting state.
    expect(world.company.ships[0].assignment?.waiting).toBe(true);
    const restored = parseWorldJson(exportWorldJson(world));
    expect(restored).toEqual(world);
    expect(restored.company.ships[0].assignment?.waiting).toBe(true);
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

  describe("v12 -> v13 migration (E14 #286 fix — Shipyard.site)", () => {
    it("parseWorldJson accepts a v12 world unchanged (identity — Shipyard.site is additive/absent-safe)", () => {
      const world = e9World(); // no shipyard field at all — the common v12 shape
      const text = JSON.stringify({ version: 12, world });

      const migrated = parseWorldJson(text);

      expect(migrated).toEqual(world);
    });

    it("parseWorldJson accepts a v12 world with a built (site-absent) Shipyard unchanged — that's exactly what 'no site' still means", () => {
      const base = createWorld("v12-built-shipyard");
      const hqPortId = base.region.ports[0].id;
      const shipyardPortId = base.region.ports[1].id;
      let world: World = { ...base, company: { ...base.company, thalers: 10_000 } };
      world = tick(world, [{ kind: "foundHeadquarters", portId: hqPortId }]);
      // A v12 save's Shipyard, if present, was always fully built (the old
      // instant-purchase model) — same shape as `{ portId }` at v13.
      world = { ...world, company: { ...world.company, shipyard: { portId: shipyardPortId } } };
      const text = JSON.stringify({ version: 12, world });

      const migrated = parseWorldJson(text);

      expect(migrated).toEqual(world);
      expect(migrated.company.shipyard).toEqual({ portId: shipyardPortId });
    });

    it("loadAutosave transparently migrates a v12 slot, so an old save keeps loading (incident 0009 concern)", () => {
      const storage = fakeStorage();
      const world = e9World();
      storage.setItem(AUTOSAVE_KEY, JSON.stringify({ version: 12, world }));

      const restored = loadAutosave(storage);
      expect(restored).not.toBeNull();
      expect(hasAutosave(storage)).toBe(true);
      expect(restored).toEqual(world);
    });

    it("a save older than v12 (v11) is now rejected — migration is one step, not open-ended", () => {
      const storage = fakeStorage();
      const save = v11Save();
      storage.setItem(AUTOSAVE_KEY, JSON.stringify(save));
      expect(loadAutosave(storage)).toBeNull();
    });

    it("an even older save (v9) is still rejected", () => {
      const storage = fakeStorage();
      const v9Save = v9SaveWithContractOffer();
      storage.setItem(AUTOSAVE_KEY, JSON.stringify(v9Save));
      expect(loadAutosave(storage)).toBeNull();
    });
  });
});
