import type { PortId, Region, Ship } from "../sim";
import { previewCourseTicks } from "./coursePreview";

/**
 * Why the Controlled Ship can't sail to a given port right now, or null when
 * it can — in which case `eta` carries the previewed voyage ticks. The
 * "no course" case is belt-and-suspenders: worldgen guarantees a connected
 * region, but a disabled button with a hint beats a vanishing one.
 *
 * Lives in its own module (not PortPanel.tsx) so both the Sail button
 * (PortPanel.tsx's `SailControl`) and the `<g>` keybind (#217, TopBar.tsx)
 * share one gate instead of two hand-kept copies — and so react-refresh
 * doesn't flag a non-component export sharing a file with the `PortPanel`
 * component.
 *
 * `underRefit` (E14, #276): a ship targeted by an active Refit is locked in
 * the Shipyard — `sailTo` is rejected at the sim level (`isUnderRefit` gate,
 * commands.ts). Threading it here (callers pass `isUnderRefit(world, ship.id)`)
 * keeps that one gate honest for both the button and the keybind instead of a
 * silent no-op, and checked first so it wins over the generic docked/eta
 * outcome.
 */
export function sailability(
  ship: Ship,
  portId: PortId,
  region: Region,
  underRefit = false,
): { disabledHint: string; eta: null } | { disabledHint: null; eta: number } {
  if (underRefit) {
    return { disabledHint: "W przebudowie — statek zablokowany w stoczni.", eta: null };
  }
  if (ship.location.kind !== "docked") {
    return { disabledHint: "Underway — dock to sail elsewhere.", eta: null };
  }
  if (ship.location.portId === portId) {
    return { disabledHint: "Already docked here.", eta: null };
  }
  const eta = previewCourseTicks(region, ship.location.portId, portId);
  if (eta === null) return { disabledHint: "No course to this port.", eta: null };
  return { disabledHint: null, eta };
}
