import { describe, expect, it } from "vitest";
import { createWorld, type Ship, type World } from "../sim";
import { resolveFleetShip } from "./fleetResolution";

function twoShipWorld(): { world: World; first: Ship; controlled: Ship } {
  const base = createWorld("fleet-resolution");
  const first = { ...base.company.ships[0], id: "s0" };
  const controlled = { ...first, id: "s1", cargo: { ...first.cargo } };
  return {
    world: { ...base, company: { ...base.company, ships: [first, controlled] } },
    first,
    controlled,
  };
}

describe("resolveFleetShip", () => {
  it("returns the Controlled Ship when it is present", () => {
    const { world, controlled } = twoShipWorld();

    expect(resolveFleetShip(world, controlled.id)).toBe(controlled);
  });

  it("falls back to the first Fleet ship when the Controlled Ship is absent", () => {
    const { world, first } = twoShipWorld();

    expect(resolveFleetShip(world, null)).toBe(first);
  });

  it("returns null for an empty Fleet", () => {
    const base = createWorld("empty-fleet-resolution");
    const world: World = { ...base, company: { ...base.company, ships: [] } };

    expect(resolveFleetShip(world, null)).toBeNull();
  });
});
