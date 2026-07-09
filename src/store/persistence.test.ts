import { describe, expect, it } from "vitest";
import { createWorld, tick, type World } from "../sim";
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
});
