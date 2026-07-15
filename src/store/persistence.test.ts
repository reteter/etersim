import { describe, expect, it } from "vitest";
import {
  applyCommand,
  CONSTRUCTION_RESERVE,
  createWorld,
  ENROLLMENT_FEE,
  HEADQUARTERS_COST,
  tick,
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

/** A world carrying one real `enrollmentFee` event, then de-shaped back to
 *  the pre-#203 v8 wire format (no `thalers` field) — the exact shape a v8
 *  save on disk actually had, not a hand-invented literal. */
function v8SaveWithEnrollmentFee(): { version: 8; world: World } {
  const base = createWorld("v8-migration");
  const funded: World = {
    ...base,
    company: { ...base.company, thalers: HEADQUARTERS_COST + CONSTRUCTION_RESERVE + 10_000 },
  };
  const founded = applyCommand(funded, {
    kind: "foundHeadquarters",
    portId: base.region.ports[0].id,
  });
  const enrolled = applyCommand(founded, { kind: "enroll", guildId: "agrarian" });
  expect(enrolled.ledger.at(-1)).toMatchObject({ kind: "enrollmentFee", thalers: ENROLLMENT_FEE });

  const v8Ledger = enrolled.ledger.map((event) => {
    if (event.kind !== "enrollmentFee") return event;
    const withoutThalers: Record<string, unknown> = { ...event };
    delete withoutThalers.thalers;
    return withoutThalers;
  });
  return { version: 8, world: { ...enrolled, ledger: v8Ledger } as unknown as World };
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

  describe("v8 -> v9 migration (issue #203 — enrollmentFee gains thalers)", () => {
    it("parseWorldJson backfills thalers: ENROLLMENT_FEE onto a v8 enrollmentFee event, otherwise unchanged", () => {
      const v8Save = v8SaveWithEnrollmentFee();
      const text = JSON.stringify(v8Save);

      const migrated = parseWorldJson(text);

      const enrollmentEvents = migrated.ledger.filter((e) => e.kind === "enrollmentFee");
      expect(enrollmentEvents).toHaveLength(1);
      expect(enrollmentEvents[0]).toEqual({
        kind: "enrollmentFee",
        tick: v8Save.world.ledger.find((e) => e.kind === "enrollmentFee")!.tick,
        guildId: "agrarian",
        thalers: ENROLLMENT_FEE,
      });
      // Nothing else in the world was touched by the migration.
      expect(migrated).toEqual({ ...v8Save.world, ledger: migrated.ledger });
    });

    it("loadAutosave transparently migrates a v8 slot, so an old save keeps loading (incident 0009 concern)", () => {
      const storage = fakeStorage();
      const v8Save = v8SaveWithEnrollmentFee();
      storage.setItem(AUTOSAVE_KEY, JSON.stringify(v8Save));

      const restored = loadAutosave(storage);
      expect(restored).not.toBeNull();
      expect(hasAutosave(storage)).toBe(true);
      const enrollmentEvent = restored!.ledger.find((e) => e.kind === "enrollmentFee");
      expect(enrollmentEvent).toMatchObject({ thalers: ENROLLMENT_FEE });
    });

    it("a save older than v8 is still rejected — migration is one step, not open-ended", () => {
      const storage = fakeStorage();
      const world = midSessionWorld();
      storage.setItem(AUTOSAVE_KEY, JSON.stringify({ version: 7, world }));
      expect(loadAutosave(storage)).toBeNull();
    });
  });
});
