import { describe, expect, it } from "vitest";
import { createWorld, type Ship, type World } from "../sim";
import { resolveFleetShip } from "./fleetResolution";

function twoShipWorld(): World {
  const world = createWorld("fleet-resolution");
  const first = world.company.ships[0];
  const second: Ship = { ...first, id: "s1", name: "Second Ship", cargo: { ...first.cargo } };
  return { ...world, company: { ...world.company, ships: [first, second] } };
}

describe("resolveFleetShip", () => {
  it("returns the Controlled Ship when it is present", () => {
    const world = twoShipWorld();
    expect(resolveFleetShip(world, "s1")?.id).toBe("s1");
  });

  it("falls back to the first Ship when the Controlled Ship is absent", () => {
    const world = twoShipWorld();
    expect(resolveFleetShip(world, "missing")?.id).toBe(world.company.ships[0].id);
  });

  it("returns null for an empty Fleet", () => {
    const world = twoShipWorld();
    const emptyWorld: World = { ...world, company: { ...world.company, ships: [] } };
    expect(resolveFleetShip(emptyWorld, null)).toBeNull();
  });
});
