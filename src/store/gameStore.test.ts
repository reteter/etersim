import { beforeEach, describe, expect, it } from "vitest";
import { MAX_TICKS_PER_CALL, MS_PER_TICK_AT_1X, quoteBuy } from "../sim";
import { useGameStore } from "./gameStore";

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

  it("ignores negative frame deltas without consuming queued commands", () => {
    store().newGame("trade");
    const shipId = store().world!.company.ships[0].id;
    store().dispatch({ kind: "buy", shipId, good: "grain", qty: 1 });
    store().advance(-16); // rAF first-frame quirk
    expect(store().world!.tick).toBe(0);
    expect(store().pendingCommands).toHaveLength(1);
  });

  it("scales with speed and clamps runaway backlogs", () => {
    store().newGame(7);
    store().setSpeed(100);
    store().advance(MS_PER_TICK_AT_1X);
    expect(store().world!.tick).toBe(100);
    store().advance(60 * 60 * 1000); // an hour away at 100x
    expect(store().world!.tick).toBe(100 + MAX_TICKS_PER_CALL);
  });

  it("dispatches queued commands into the first folded tick, then clears them", () => {
    store().newGame("trade");
    const world = store().world!;
    const ship = world.company.ships[0];
    const port = world.region.ports.find(
      (p) => ship.location.kind === "docked" && p.id === ship.location.portId,
    )!;
    const cost = quoteBuy("grain", port.market.grain, 5)!;

    store().dispatch({ kind: "buy", shipId: ship.id, good: "grain", qty: 5 });
    expect(store().world).toEqual(world); // queued, not applied yet
    store().advance(2 * MS_PER_TICK_AT_1X);

    const after = store().world!;
    expect(after.company.thalers).toBe(world.company.thalers - cost);
    expect(after.company.ships[0].cargo.grain).toBe(5);
    expect(store().pendingCommands).toEqual([]);

    store().advance(MS_PER_TICK_AT_1X); // must not re-apply
    expect(store().world!.company.ships[0].cargo.grain).toBe(5);
  });

  it("keeps commands queued across a pause", () => {
    store().newGame("trade");
    const shipId = store().world!.company.ships[0].id;
    store().setSpeed("paused");
    store().dispatch({ kind: "buy", shipId, good: "grain", qty: 1 });
    store().advance(5000);
    expect(store().pendingCommands).toHaveLength(1);
    store().setSpeed(1);
    store().advance(MS_PER_TICK_AT_1X);
    expect(store().world!.company.ships[0].cargo.grain).toBe(1);
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
