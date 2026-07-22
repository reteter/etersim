import type { Ship, ShipId, World } from "../sim";

/**
 * Resolves the Fleet ship relevant to a UI/store context: prefer the
 * Controlled Ship and fall back to the first Company Ship while the
 * designation is absent or stale.
 */
export function resolveFleetShip(world: World, controlledShipId: ShipId | null): Ship | null {
  return (
    world.company.ships.find((ship) => ship.id === controlledShipId) ??
    world.company.ships[0] ??
    null
  );
}
