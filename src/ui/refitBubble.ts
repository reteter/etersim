import {
  GOOD_IDS,
  refitRecipe,
  type GoodId,
  type PortId,
  type Region,
  type Ship,
  type ShipId,
  type Shipyard,
} from "../sim";

/** One good's remaining need for the active Refit — the tooltip's "per-good
 *  remaining" (docs/specs/E14-shipyard-and-refit.md — UI surfaces: "details
 *  ... in its tooltip"). Only goods still short appear; a fully-delivered
 *  good is omitted (mirrors `BuildProgress`'s own remaining-need read, just
 *  pre-filtered for a compact tooltip). */
export interface RefitBubbleRemaining {
  readonly good: GoodId;
  readonly remaining: number;
}

/** Everything the map's refit bubble (RegionMap.tsx) needs to draw, derived
 *  from the World's Shipyard/Ships/Region — pure so it's testable without
 *  mounting the SVG. `null` whenever there's nothing to draw (no Shipyard, no
 *  active Refit, or a defensively-missing ship/port). Progress is aggregate
 *  `filled/required` over the whole Recipe (spec: "Progress = filled/required
 *  over the recipe"), not per-good — the per-good breakdown is tooltip-only.
 */
export interface RefitBubbleData {
  readonly shipId: ShipId;
  readonly shipName: string;
  readonly portId: PortId;
  readonly targetHold: number;
  readonly filled: number;
  readonly required: number;
  readonly progress: number; // 0..1, clamped
  readonly remaining: readonly RefitBubbleRemaining[];
}

export function refitBubbleData(
  shipyard: Shipyard | undefined,
  ships: readonly Ship[],
  region: Region,
): RefitBubbleData | null {
  const refitOrder = shipyard?.refitOrder;
  if (!shipyard || !refitOrder) return null;
  const ship = ships.find((s) => s.id === refitOrder.shipId);
  if (!ship) return null;
  if (!region.ports.some((p) => p.id === shipyard.portId)) return null;

  const recipe = refitRecipe(ship);
  let filled = 0;
  let required = 0;
  const remaining: RefitBubbleRemaining[] = [];
  for (const good of GOOD_IDS) {
    const have = refitOrder.siteStore[good] ?? 0;
    const need = recipe[good];
    filled += Math.min(have, need);
    required += need;
    if (need - have > 0) remaining.push({ good, remaining: need - have });
  }
  const progress = required > 0 ? Math.min(1, filled / required) : 1;

  return {
    shipId: ship.id,
    shipName: ship.name,
    portId: shipyard.portId,
    targetHold: refitOrder.targetHold,
    filled,
    required,
    progress,
    remaining,
  };
}
