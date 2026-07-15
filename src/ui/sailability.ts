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
 */
export function sailability(
  ship: Ship,
  portId: PortId,
  region: Region,
): { disabledHint: string; eta: null } | { disabledHint: null; eta: number } {
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
