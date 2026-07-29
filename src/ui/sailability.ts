import { DOCKING_FEE, type PortId, type Region, type Ship } from "../sim";
import { previewCourseTicks } from "./coursePreview";

/**
 * Why the Controlled Ship can't sail to a given port right now, or null when
 * it can — in which case `eta`/`dockingFee` carry the previewed voyage ticks
 * and the ₸ charged on arrival (#125 — the fee was previously invisible
 * before the player committed to a manual sail). The "no course" case is
 * belt-and-suspenders: worldgen guarantees a connected region, but a
 * disabled button with a hint beats a vanishing one.
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
):
  | { disabledHint: string; eta: null; dockingFee: null }
  | { disabledHint: null; eta: number; dockingFee: number } {
  if (locked) {
    return {
      disabledHint: "W przebudowie w stoczni — postój zablokowany.",
      eta: null,
      dockingFee: null,
    };
  }
  if (ship.location.kind !== "docked") {
    return {
      disabledHint: "W drodze — musi zadokować, by popłynąć gdzie indziej.",
      eta: null,
      dockingFee: null,
    };
  }
  if (ship.location.portId === portId) {
    return { disabledHint: "Już tu zadokowany.", eta: null, dockingFee: null };
  }
  const eta = previewCourseTicks(region, ship.location.portId, portId);
  if (eta === null) return { disabledHint: "Brak kursu do tego portu.", eta: null, dockingFee: null };
  const targetPort = region.ports.find((p) => p.id === portId);
  // Belt-and-suspenders (mirrors the "no course" case above): a resolvable
  // course implies a resolvable port, but a disabled hint beats a crash.
  if (!targetPort) return { disabledHint: "Brak kursu do tego portu.", eta: null, dockingFee: null };
  const dockingFee = DOCKING_FEE[targetPort.archetype];
  return { disabledHint: null, eta, dockingFee };
}
