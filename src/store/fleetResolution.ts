import type { Ship, ShipId, World } from "../sim";

/**
 * Resolves the Ship relevant to a UI/store context. A valid Controlled Ship
 * wins; otherwise the first Ship preserves the single-fleet fallback. The
 * empty-fleet case deliberately returns null.
 */
export function resolveFleetShip(world: World, controlledShipId: ShipId | null): Ship | null {
  return world.company.ships.find((ship) => ship.id === controlledShipId) ?? world.company.ships[0] ?? null;
}
