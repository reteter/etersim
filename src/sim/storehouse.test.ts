import { describe, expect, it } from "vitest";
import { STOREHOUSE_CAPACITY } from "./building";
import { applyCommand } from "./commands";
import { amountOf, storeOf } from "./goodsStore";
import { tick } from "./tick";
import { createWorld, type World } from "./world";

function activeGranary(world: World): World {
  const port = world.region.ports.find((candidate) => candidate.archetype === "agrarian")!;
  const ship = world.company.ships[0];
  return {
    ...world,
    company: {
      ...world.company,
      ships: [{ ...ship, location: { kind: "docked", portId: port.id }, cargo: storeOf({ grain: 20, textiles: 5 }) }],
      buildings: [{ type: "storehouse", variant: "agrarian", portId: port.id, store: storeOf({ grain: 195 }) }],
    },
  };
}

function granaryStore(world: World) {
  const building = world.company.buildings![0];
  if (!("store" in building)) throw new Error("expected active Storehouse");
  return building.store;
}

describe("Storehouse (#100)", () => {
  it("stores only the filtered good up to remaining capacity, records the actual movement, and withdraws only into hold space", () => {
    const world = activeGranary(createWorld("storehouse-clamps"));
    const shipId = world.company.ships[0].id;
    const ref = { kind: "storehouse" as const, portId: world.company.buildings![0].portId };
    const stored = applyCommand(world, { kind: "storeGood", shipId, good: "grain", target: ref });
    expect(amountOf(stored.company.ships[0].cargo, "grain")).toBe(15);
    expect(amountOf(granaryStore(stored), "grain")).toBe(STOREHOUSE_CAPACITY);
    expect(stored.ledger.at(-1)).toMatchObject({ kind: "store", good: "grain", qty: 5, shipId });
    expect(applyCommand(stored, { kind: "storeGood", shipId, good: "textiles", target: ref })).toEqual(stored);

    const withdrawn = applyCommand(stored, { kind: "withdrawGood", shipId, good: "grain", source: ref });
    expect(amountOf(withdrawn.company.ships[0].cargo, "grain")).toBe(45);
    expect(amountOf(granaryStore(withdrawn), "grain")).toBe(170);
    expect(withdrawn.ledger.at(-1)).toMatchObject({ kind: "withdraw", good: "grain", qty: 30, shipId });
  });

  it("executes a store stop through the same command seam as a manual transfer", () => {
    const world = activeGranary(createWorld("storehouse-route"));
    const ship = world.company.ships[0];
    const portId = (ship.location as { kind: "docked"; portId: string }).portId;
    const otherPort = world.region.ports.find((port) => port.id !== portId)!;
    const ref = { kind: "storehouse" as const, portId };
    const routeWorld: World = { ...world, company: { ...world.company, routes: [{ id: "r", name: "r", stops: [{ portId, orders: [{ kind: "store", good: "grain", target: ref }] }, { portId: otherPort.id, orders: [] }] }], ships: [{ ...ship, assignment: { routeId: "r", nextStopIndex: 0, suspended: false } }] } };
    const routed = tick(routeWorld, []);
    const manual = applyCommand(routeWorld, { kind: "storeGood", shipId: ship.id, good: "grain", target: ref });
    expect(amountOf(routed.company.ships[0].cargo, "grain")).toBe(amountOf(manual.company.ships[0].cargo, "grain"));
    expect(amountOf(granaryStore(routed), "grain")).toBe(amountOf(granaryStore(manual), "grain"));
  });

});
