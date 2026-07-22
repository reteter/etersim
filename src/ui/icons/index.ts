// Vendored SVG icon set (docs/adr/0006-svg-icon-strategy.md). One TSX
// component per icon, single `<path>`, tinted via `fill: currentColor`.
import type { ComponentType, SVGProps } from "react";
import type { PortArchetype } from "../../sim";
import { AgrarianIcon } from "./AgrarianIcon";
import { FreeportIcon } from "./FreeportIcon";
import { IndustrialIcon } from "./IndustrialIcon";
import { MiningIcon } from "./MiningIcon";
import { UrbanIcon } from "./UrbanIcon";
import { VerdantIcon } from "./VerdantIcon";

export { ShipIcon } from "./ShipIcon";
export { AgrarianIcon } from "./AgrarianIcon";
export { IndustrialIcon } from "./IndustrialIcon";
export { UrbanIcon } from "./UrbanIcon";
export { MiningIcon } from "./MiningIcon";
export { VerdantIcon } from "./VerdantIcon";
export { FreeportIcon } from "./FreeportIcon";
export { GrainIcon } from "./GrainIcon";
export { TextilesIcon } from "./TextilesIcon";
export { AetherSaltIcon } from "./AetherSaltIcon";
export { ElectronicsIcon } from "./ElectronicsIcon";
export { TimberIcon } from "./TimberIcon";

/** Archetype → vendored SVG icon (#34, docs/adr/0006-svg-icon-strategy.md).
 *  Extracted here (E16 #392) so both `RegionMap` (the map's port glyphs) and
 *  `RouteRibbon` (the ribbon's Stop nodes) share one lookup instead of each
 *  surface re-declaring its own archetype→icon map. */
export const ARCHETYPE_ICONS: Record<PortArchetype, ComponentType<SVGProps<SVGSVGElement>>> = {
  agrarian: AgrarianIcon,
  industrial: IndustrialIcon,
  urban: UrbanIcon,
  mining: MiningIcon,
  verdant: VerdantIcon,
  freeport: FreeportIcon,
};
