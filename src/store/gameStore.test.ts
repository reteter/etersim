import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  effectiveBase,
  etaTicks,
  MAX_TICKS_PER_CALL,
  MS_PER_TICK_AT_1X,
  quoteBuy,
  shortestRoute,
  type PortId,
} from "../sim";
import { useGameStore } from "./gameStore";
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
    expect(after.company.ships[0].cargo.grain).toBe(5);

    store().advance(MS_PER_TICK_AT_1X); // must not re-apply
    expect(store().world!.company.ships[0].cargo.grain).toBe(5);
  });

  it("dispatch applies immediately even while paused", () => {
    store().newGame("trade");
    const shipId = store().world!.company.ships[0].id;
    store().setSpeed("paused");
    store().dispatch({ kind: "buy", shipId, good: "grain", qty: 1 });
    expect(store().world!.company.ships[0].cargo.grain).toBe(1);
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
    // Seed 0's home port has a known 2-lane shortest route to some port —
    // exercises voyageIndex advancing (still underway) before the final dock.
    store().newGame(0);
    const home = homePortId();
    const region = store().world!.region;
    const target = store().world!.region.ports.find(
      (p) => p.id !== home && (shortestRoute(region, home, p.id)?.length ?? 0) > 1,
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
