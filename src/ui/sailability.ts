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
 * `locked` (#276): true while the ship is the target of an active Refit
 * (`isUnderRefit`, src/sim/shipyard.ts) — the sim already rejects `sailTo`
 * for a locked ship (commands.ts), so this just surfaces the same gate as a
 * disabled reason instead of a silent no-op, checked first since a locked
 * ship's location doesn't matter (it's always docked at the Shipyard port).
 */
export function sailability(
  ship: Ship,
  portId: PortId,
  region: Region,
  locked = false,
): { disabledHint: string; eta: null } | { disabledHint: null; eta: number } {
  if (locked) {
    return { disabledHint: "W przebudowie w stoczni — postój zablokowany.", eta: null };
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
