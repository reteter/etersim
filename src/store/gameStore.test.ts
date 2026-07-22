import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  amountOf,
  createWorld,
  effectiveBase,
  etaTicks,
  MAX_TICKS_PER_CALL,
  MS_PER_TICK_AT_1X,
  quoteBuy,
  shortestCourse,
  type PortId,
  type Route,
  type World,
} from "../sim";
import { resolveRelevantShip, useGameStore } from "./gameStore";
import { loadAutosave, type StorageLike } from "./persistence";

const store = () => useGameStore.getState();

beforeEach(() => {
  useGameStore.getState().reset();
});

describe("gameStore", () => {
  it("starts with no world and paused speed", () => {
    expect(store().world).toBeNull();
    expect(store().speed).toBe("paused");
  });

  it("newGame builds a deterministic world and starts at 1x", () => {
    store().newGame("etersim");
    const a = store().world;
    store().reset();
    store().newGame("etersim");
    expect(store().world).toEqual(a);
    expect(store().speed).toBe(1);
  });

  it("advance folds elapsed ms into ticks and keeps the carry", () => {
    store().newGame(7);
    store().advance(2.5 * MS_PER_TICK_AT_1X);
    expect(store().world!.tick).toBe(2);
    store().advance(0.5 * MS_PER_TICK_AT_1X);
    expect(store().world!.tick).toBe(3);
  });

  it("advance does nothing while paused and drops the carry", () => {
    store().newGame(7);
    store().advance(0.9 * MS_PER_TICK_AT_1X);
    store().setSpeed("paused");
    store().advance(60_000);
    expect(store().world!.tick).toBe(0);
    store().setSpeed(1);
    store().advance(0.5 * MS_PER_TICK_AT_1X);
    expect(store().world!.tick).toBe(0); // pre-pause 0.9 carry was dropped
  });

  it("ignores negative frame deltas", () => {
    store().newGame("trade");
    store().advance(-16); // rAF first-frame quirk
    expect(store().world!.tick).toBe(0);
  });

  it("scales with speed and clamps runaway backlogs", () => {
    store().newGame(7);
    store().setSpeed(100);
    store().advance(MS_PER_TICK_AT_1X);
    expect(store().world!.tick).toBe(100);
    store().advance(60 * 60 * 1000); // an hour away at 100x
    expect(store().world!.tick).toBe(100 + MAX_TICKS_PER_CALL);
  });

  it("dispatch applies a command immediately, without waiting for advance", () => {
    store().newGame("trade");
    const world = store().world!;
    const ship = world.company.ships[0];
    const port = world.region.ports.find(
      (p) => ship.location.kind === "docked" && p.id === ship.location.portId,
    )!;
    const cost = quoteBuy(port.market.grain, effectiveBase(port, "grain"), 5)!;

    store().dispatch({ kind: "buy", shipId: ship.id, good: "grain", qty: 5 });

    const after = store().world!;
    expect(after.company.thalers).toBe(world.company.thalers - cost);
    expect(amountOf(after.company.ships[0].cargo, "grain")).toBe(5);

    store().advance(MS_PER_TICK_AT_1X); // must not re-apply
    expect(amountOf(store().world!.company.ships[0].cargo, "grain")).toBe(5);
  });

  it("dispatch applies immediately even while paused", () => {
    store().newGame("trade");
    const shipId = store().world!.company.ships[0].id;
    store().setSpeed("paused");
    store().dispatch({ kind: "buy", shipId, good: "grain", qty: 1 });
    expect(amountOf(store().world!.company.ships[0].cargo, "grain")).toBe(1);
  });

  it("rejects an invalid command, leaving world unchanged", () => {
    store().newGame("trade");
    const world = store().world!;
    const shipId = world.company.ships[0].id;
    store().dispatch({ kind: "buy", shipId, good: "grain", qty: 1_000_000 });
    expect(store().world).toEqual(world);
  });

  it("selection tracks ports and ships and clears on newGame", () => {
    store().newGame(1);
    const portId = store().world!.region.ports[0].id;
    store().select({ kind: "port", id: portId });
    expect(store().selection).toEqual({ kind: "port", id: portId });
    store().newGame(2);
    expect(store().selection).toBeNull();
  });

  it("loadWorld swaps the world in and pauses", () => {
    store().newGame("origin");
    store().advance(3 * MS_PER_TICK_AT_1X);
    const snapshot = store().world!;
    store().reset();
    store().loadWorld(snapshot);
    expect(store().world).toEqual(snapshot);
    expect(store().speed).toBe("paused");
  });

  it("togglePause pauses at the current speed and resumes to exactly that speed (#123)", () => {
    store().newGame(7);
    store().setSpeed(10);

    store().togglePause();
    expect(store().speed).toBe("paused");

    store().togglePause();
    expect(store().speed).toBe(10); // not 1x — the speed selected before the pause
  });

  it("setSpeed('paused') does not overwrite lastActiveSpeed, so a later resume is exact (#123)", () => {
    store().newGame(7);
    store().setSpeed(100);
    store().setSpeed("paused");
    expect(store().lastActiveSpeed).toBe(100);
  });
});

describe("gameStore pauseCause (#130)", () => {
  it("starts with no pause cause", () => {
    expect(store().pauseCause).toBeNull();
  });

  it("setSpeed('paused') without a cause defaults to manual", () => {
    store().newGame(7);
    store().setSpeed("paused");
    expect(store().pauseCause).toBe("manual");
  });

  it("togglePause (button/hotkey) marks the pause manual", () => {
    store().newGame(7);
    store().togglePause();
    expect(store().speed).toBe("paused");
    expect(store().pauseCause).toBe("manual");
  });

  it("setSpeed('paused', 'autoArrival') marks the pause automatic", () => {
    store().newGame(7);
    store().setSpeed("paused", "autoArrival");
    expect(store().pauseCause).toBe("autoArrival");
  });

  it("resuming (any non-paused setSpeed) clears the pause cause", () => {
    store().newGame(7);
    store().setSpeed("paused", "autoArrival");
    expect(store().pauseCause).toBe("autoArrival");
    store().setSpeed(1);
    expect(store().pauseCause).toBeNull();
  });

  it("togglePause resuming from an auto-pause clears the cause", () => {
    store().newGame(7);
    store().setSpeed(10);
    store().setSpeed("paused", "autoArrival");
    store().togglePause();
    expect(store().speed).toBe(10);
    expect(store().pauseCause).toBeNull();
  });

  it("reset/newGame/loadWorld clear the pause cause", () => {
    store().newGame(7);
    store().setSpeed("paused", "autoArrival");
    store().reset();
    expect(store().pauseCause).toBeNull();
  });
});

describe("gameStore lastSeenTick (#195 rider 2)", () => {
  it("starts at 0 with no world", () => {
    expect(store().lastSeenTick).toBe(0);
  });

  it("newGame seeds lastSeenTick to the fresh world's tick", () => {
    store().newGame(7);
    expect(store().lastSeenTick).toBe(store().world!.tick);
  });

  it("loadWorld (e.g. continue-from-autosave) seeds lastSeenTick to the loaded world's tick", () => {
    store().newGame("origin");
    store().advance(5 * MS_PER_TICK_AT_1X);
    const snapshot = store().world!;
    store().reset();
    store().loadWorld(snapshot);
    expect(store().lastSeenTick).toBe(snapshot.tick);
  });

  it("a mid-session JSON import (loadWorld) re-seeds lastSeenTick to the imported world's tick, not the previous session's watermark", () => {
    store().newGame("origin");
    store().advance(3 * MS_PER_TICK_AT_1X);
    store().markNoticesSeen();
    expect(store().lastSeenTick).toBe(3);

    // GameMenu.tsx's onImportFile calls loadWorld directly with the parsed
    // save — simulate importing a save further along in time.
    store().newGame("imported");
    store().advance(20 * MS_PER_TICK_AT_1X);
    const imported = store().world!;
    store().loadWorld(imported);

    expect(store().lastSeenTick).toBe(20);
  });

  it("markNoticesSeen watermarks to the current tick and is a no-op with no world", () => {
    store().reset();
    store().markNoticesSeen();
    expect(store().lastSeenTick).toBe(0);

    store().newGame(7);
    store().advance(4 * MS_PER_TICK_AT_1X);
    store().markNoticesSeen();
    expect(store().lastSeenTick).toBe(4);
  });
});

describe("gameStore seed (#221)", () => {
  it("starts with no seed", () => {
    expect(store().seed).toBeNull();
  });

  it("newGame records the seed as a string, even when given a number", () => {
    store().newGame("etersim");
    expect(store().seed).toBe("etersim");
    store().newGame(7);
    expect(store().seed).toBe("7");
  });

  it("loadWorld (JSON import) clears the seed — an imported save carries no seed name", () => {
    store().newGame("origin");
    expect(store().seed).toBe("origin");
    const snapshot = store().world!;
    store().loadWorld(snapshot);
    expect(store().seed).toBeNull();
  });

  it("reset clears the seed", () => {
    store().newGame("origin");
    store().reset();
    expect(store().seed).toBeNull();
  });
});

describe("gameStore Controlled Ship", () => {
  it("newGame designates the first ship as Controlled and clears on reset", () => {
    store().newGame("etersim");
    expect(store().controlledShipId).toBe(store().world!.company.ships[0].id);
    store().reset();
    expect(store().controlledShipId).toBeNull();
  });

  it("loadWorld designates the loaded world's first ship", () => {
    store().newGame("origin");
    const snapshot = store().world!;
    store().reset();
    store().loadWorld(snapshot);
    expect(store().controlledShipId).toBe(snapshot.company.ships[0].id);
  });

  it("openShip designates the ship and focuses its panel", () => {
    store().newGame("trade");
    store().openShip("s0");
    expect(store().controlledShipId).toBe("s0");
    expect(store().selection).toEqual({ kind: "ship", id: "s0" });
  });
});

describe("resolveRelevantShip (#319 — fleet-resolution selector)", () => {
  it("resolves the Controlled Ship when it is present in the fleet — even when it is not the first ship", () => {
    store().newGame("etersim");
    const world = store().world!;
    type ShipIdOf = (typeof world.company.ships)[number]["id"];
    const s0 = world.company.ships[0];
    // A second ship, distinct from ships[0], designated Controlled: this is
    // the case a naive `ships[0]` fallback would get wrong, so it's the case
    // that actually exercises the exact-match branch instead of coinciding
    // with the fallback (advisor review, #319).
    const s1 = { ...s0, id: "s1-test" as ShipIdOf };
    const twoShipWorld = { ...world, company: { ...world.company, ships: [s0, s1] } };
    expect(resolveRelevantShip(twoShipWorld, s1.id)).toBe(s1);
  });

  it("falls back to the first ship when the Controlled Ship id is absent", () => {
    store().newGame("etersim");
    const world = store().world!;
    type ShipIdOf = (typeof world.company.ships)[number]["id"];
    const missingId = "no-such-ship-id" as ShipIdOf;
    expect(resolveRelevantShip(world, missingId)).toBe(world.company.ships[0]);
    expect(resolveRelevantShip(world, null)).toBe(world.company.ships[0]);
  });

  it("returns null for an empty fleet", () => {
    store().newGame("etersim");
    const world = store().world!;
    const emptyFleetWorld = { ...world, company: { ...world.company, ships: [] } };
    expect(resolveRelevantShip(emptyFleetWorld, null)).toBeNull();
    expect(resolveRelevantShip(emptyFleetWorld, world.company.ships[0].id)).toBeNull();
  });
});

describe("gameStore auto-pause on arrival", () => {
  // autoPauseOnArrival is a persisted preference, deliberately untouched by
  // the top-level beforeEach's reset() — pin it explicitly per test.
  beforeEach(() => {
    store().setAutoPauseOnArrival(true);
  });

  function homePortId(): PortId {
    const ship = store().world!.company.ships[0];
    if (ship.location.kind !== "docked") throw new Error("ship not docked");
    return ship.location.portId;
  }

  /** Sails the Controlled Ship to `portId` and returns the ticks left to arrive. */
  function sailAndGetEta(portId: PortId): number {
    const shipId = store().world!.company.ships[0].id;
    store().dispatch({ kind: "sailTo", shipId, portId });
    return etaTicks(store().world!.company.ships[0], store().world!.region);
  }

  it("defaults to on for a fresh store", () => {
    expect(store().autoPauseOnArrival).toBe(true);
  });

  it("auto-pauses when the Controlled Ship docks at its final destination", () => {
    store().newGame(7);
    const home = homePortId();
    const target = store().world!.region.ports.find((p) => p.id !== home)!;
    const eta = sailAndGetEta(target.id);
    expect(eta).toBeGreaterThan(0);

    store().advance(eta * MS_PER_TICK_AT_1X);

    expect(store().world!.company.ships[0].location).toEqual({
      kind: "docked",
      portId: target.id,
    });
    expect(store().speed).toBe("paused");
    expect(store().pauseCause).toBe("autoArrival"); // #130: distinct from a manual pause
  });

  it("stays running on arrival when the setting is off", () => {
    store().newGame(7);
    store().setAutoPauseOnArrival(false);
    const home = homePortId();
    const target = store().world!.region.ports.find((p) => p.id !== home)!;
    const eta = sailAndGetEta(target.id);

    store().advance(eta * MS_PER_TICK_AT_1X);

    expect(store().world!.company.ships[0].location).toEqual({
      kind: "docked",
      portId: target.id,
    });
    expect(store().speed).toBe(1);
  });

  it("does not pause on intermediate lane hops, only the final destination", () => {
    // Seed 0's home port has a known 2-lane shortest course to some port —
    // exercises voyageIndex advancing (still underway) before the final dock.
    store().newGame(0);
    const home = homePortId();
    const region = store().world!.region;
    const target = store().world!.region.ports.find(
      (p) => p.id !== home && (shortestCourse(region, home, p.id)?.length ?? 0) > 1,
    )!;
    expect(target).toBeDefined();
    const eta = sailAndGetEta(target.id);

    for (let i = 0; i < eta - 1; i++) {
      store().advance(MS_PER_TICK_AT_1X);
      expect(store().world!.company.ships[0].location.kind).toBe("underway");
      expect(store().speed).toBe(1);
    }
    store().advance(MS_PER_TICK_AT_1X);

    expect(store().world!.company.ships[0].location).toEqual({
      kind: "docked",
      portId: target.id,
    });
    expect(store().speed).toBe("paused");
  });

  it("is a no-op if already paused", () => {
    store().newGame(7);
    const home = homePortId();
    const target = store().world!.region.ports.find((p) => p.id !== home)!;
    const eta = sailAndGetEta(target.id);
    store().setSpeed("paused");

    store().advance(eta * MS_PER_TICK_AT_1X); // paused: elapsedToTicks folds 0 ticks

    expect(store().world!.company.ships[0].location.kind).toBe("underway");
    expect(store().speed).toBe("paused");
  });

  it("resumes to the pre-arrival speed (not 1x) after auto-pause on arrival (#123)", () => {
    store().newGame(7);
    const home = homePortId();
    const target = store().world!.region.ports.find((p) => p.id !== home)!;
    const eta = sailAndGetEta(target.id);
    store().setSpeed(10);

    store().advance(eta * MS_PER_TICK_AT_1X);

    expect(store().speed).toBe("paused"); // auto-pause behavior itself: unchanged
    store().togglePause();
    expect(store().speed).toBe(10); // restores 10x, not 1x
  });

  it("does not auto-pause before the destination is reached", () => {
    store().newGame(7);
    const home = homePortId();
    const target = store().world!.region.ports.find((p) => p.id !== home)!;
    const eta = sailAndGetEta(target.id);

    store().advance((eta - 1) * MS_PER_TICK_AT_1X);

    expect(store().world!.company.ships[0].location.kind).toBe("underway");
    expect(store().speed).toBe(1);
  });
});

describe("gameStore auto-pause under an active route (#151)", () => {
  beforeEach(() => {
    store().setAutoPauseOnArrival(true);
  });

  /** A funded World with s0 docked at one end of its shortest lane and a
   *  two-Stop grain loop (buy at A, sell at B) already in the Company — the
   *  same shape the Trasy-tab E2E builds, minimal enough for a store unit. */
  function routedControlledWorld(seed: string): { world: World; a: PortId; b: PortId; laneTicks: number } {
    const w0 = createWorld(seed);
    const lane = [...w0.region.lanes].sort((x, y) => x.voyageTicks - y.voyageTicks)[0];
    const route: Route = {
      id: "r",
      name: "loop",
      stops: [
        { portId: lane.a, orders: [{ kind: "buy", good: "grain" }] },
        { portId: lane.b, orders: [{ kind: "sell", good: "grain" }] },
      ],
    };
    const ship = { ...w0.company.ships[0], location: { kind: "docked", portId: lane.a } as const };
    const world: World = { ...w0, company: { ...w0.company, thalers: 100_000, ships: [ship], routes: [route] } };
    return { world, a: lane.a, b: lane.b, laneTicks: lane.voyageTicks };
  }

  it("does not auto-pause when the Controlled Ship docks at a route Stop (never a final destination)", () => {
    const { world, b, laneTicks } = routedControlledWorld("hq-trasy");
    store().loadWorld(world);
    store().dispatch({ kind: "assignRoute", shipId: "s0", routeId: "r" });
    store().setSpeed(1);

    // Tick one at a time so the exact underway→docked transition at Stop B —
    // which looks identical to a manual sailTo's terminal arrival at the
    // ShipLocation level — is caught in its own single-tick advance (a
    // multi-tick fold could straddle the arrival and hide the bug).
    let dockedAtB = false;
    for (let i = 0; i < laneTicks + 4; i++) {
      store().advance(MS_PER_TICK_AT_1X);
      expect(store().speed).toBe(1); // active route: arrival never pauses
      const loc = store().world!.company.ships[0].location;
      if (loc.kind === "docked" && loc.portId === b) dockedAtB = true;
    }
    // The assertion above is only meaningful if the ship really reached the Stop.
    expect(dockedAtB).toBe(true);
  });

  it("still auto-pauses a manual sailTo that suspended the route (manual control resumes the feature)", () => {
    const { world, a } = routedControlledWorld("hq-trasy");
    store().loadWorld(world);
    store().dispatch({ kind: "assignRoute", shipId: "s0", routeId: "r" });
    // A manual sailTo auto-suspends the assignment (commands.ts) — the ship is
    // now under manual control, so its arrival should pause as it did pre-route.
    const region = store().world!.region;
    const target = region.ports.find(
      (p) => p.id !== a && (shortestCourse(region, a, p.id)?.length ?? 0) >= 1,
    )!;
    store().dispatch({ kind: "sailTo", shipId: "s0", portId: target.id });
    const eta = etaTicks(store().world!.company.ships[0], region);
    store().setSpeed(1);

    for (let i = 0; i < eta; i++) store().advance(MS_PER_TICK_AT_1X);

    expect(store().world!.company.ships[0].location).toEqual({ kind: "docked", portId: target.id });
    expect(store().speed).toBe("paused");
  });
});

describe("gameStore autosave", () => {
  // saveAutosave/loadAutosave default to globalThis.localStorage, resolved per
  // call — so a global fake exercises the real default path without a browser.
  let store_: Map<string, string>;

  beforeEach(() => {
    store_ = new Map<string, string>();
    const fake: StorageLike = {
      getItem: (k) => store_.get(k) ?? null,
      setItem: (k, v) => {
        store_.set(k, v);
      },
      removeItem: (k) => {
        store_.delete(k);
      },
    };
    (globalThis as { localStorage?: StorageLike }).localStorage = fake;
  });

  afterEach(() => {
    delete (globalThis as { localStorage?: StorageLike }).localStorage;
  });

  it("autosaves when an advance crosses a 24-tick boundary", () => {
    store().newGame(7);
    store().setSpeed(1);
    store().advance(23 * MS_PER_TICK_AT_1X); // reaches tick 23 — no boundary yet
    expect(loadAutosave()).toBeNull();
    store().advance(1 * MS_PER_TICK_AT_1X); // reaches tick 24 — boundary crossed
    expect(loadAutosave()?.tick).toBe(24);
  });

  it("autosaves once even when an advance folds past many boundaries", () => {
    store().newGame(7);
    store().setSpeed(100);
    store().advance(MS_PER_TICK_AT_1X); // 100 ticks in one advance
    expect(loadAutosave()?.tick).toBe(100);
  });

  it("autosaves the current world on pause", () => {
    store().newGame(7);
    store().setSpeed(1);
    store().advance(5 * MS_PER_TICK_AT_1X); // tick 5, below the first boundary
    expect(loadAutosave()).toBeNull();
    store().setSpeed("paused");
    expect(loadAutosave()?.tick).toBe(5);
  });
});
