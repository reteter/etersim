// Vendored SVG icon set (docs/adr/0006-svg-icon-strategy.md). One TSX
// component per icon, single `<path>`, tinted via `fill: currentColor`.
import type { ComponentType, SVGProps } from "react";
import type { GoodId, PortArchetype } from "../../sim";
import { AetherSaltIcon } from "./AetherSaltIcon";
import { AgrarianIcon } from "./AgrarianIcon";
import { ElectronicsIcon } from "./ElectronicsIcon";
import { FreeportIcon } from "./FreeportIcon";
import { GrainIcon } from "./GrainIcon";
import { IndustrialIcon } from "./IndustrialIcon";
import { MiningIcon } from "./MiningIcon";
import { TextilesIcon } from "./TextilesIcon";
import { TimberIcon } from "./TimberIcon";
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

/** Good → vendored SVG icon (ADR-0006), the goods-side twin of
 *  `ARCHETYPE_ICONS`. The E16 visual prototype renders the price board's
 *  column headers as icons, "like ports" (#468 owner dictation), so both
 *  header families resolve through one lookup in this file rather than a
 *  second icon set. Same vendored components the PortPanel's cargo lines
 *  already import individually. */
export const GOOD_ICONS: Record<GoodId, ComponentType<SVGProps<SVGSVGElement>>> = {
  grain: GrainIcon,
  textiles: TextilesIcon,
  aetherSalt: AetherSaltIcon,
  electronics: ElectronicsIcon,
  timber: TimberIcon,
};
