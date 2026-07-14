/* eslint-disable react-refresh/only-export-components -- guildDisplay.tsx is
   deliberately one shared home for GuildBadge + its two small data tables
   (GUILD_NAME_PL, GUILD_ICON); splitting a leaf display helper into two
   files just to satisfy Fast Refresh isn't worth the indirection here. */
import type { CSSProperties } from "react";
import type { GuildId } from "../sim";
import { AgrarianIcon, IndustrialIcon, MiningIcon, UrbanIcon, VerdantIcon } from "./icons";

/**
 * Shared guild display: Polish working names, the archetype-icon badge
 * (#96's KontraktyTab and #97's PortPanel guildhouse section both need it —
 * this is its one home, review finding: it shipped byte-identical duplicated
 * in both files across the two branches). Polish working names from the
 * spec's guild table (Design: Guilds) — display-only. `GUILDS[id].name`
 * (guild.ts) stays the English flavor name owned by #92/#170's scope wall;
 * untouched here.
 */
export const GUILD_NAME_PL: Record<GuildId, string> = {
  agrarian: "Gildia Spichlerzy",
  urban: "Zgromadzenie Tkaczy",
  mining: "Bractwo Solowarów",
  industrial: "Liga Odlewników",
  verdant: "Konsorcjum Żywodrzewu",
};

/** Guild badge = the EXISTING archetype icon (ADR-0006 — no new icon set,
 *  guilds are 1:1 with economic archetypes, no second color axis). */
export const GUILD_ICON: Record<GuildId, typeof AgrarianIcon> = {
  agrarian: AgrarianIcon,
  urban: UrbanIcon,
  mining: MiningIcon,
  industrial: IndustrialIcon,
  verdant: VerdantIcon,
};

/** The badge itself: the archetype icon tinted with the archetype hue
 *  (`--guild-color`, set inline from `--archetype-*`) — never gold
 *  (ADR-0006). */
export function GuildBadge({ guildId }: { guildId: GuildId }) {
  const Icon = GUILD_ICON[guildId];
  return (
    <span
      className="guild-badge"
      style={{ "--guild-color": `var(--archetype-${guildId})` } as CSSProperties}
      title={GUILD_NAME_PL[guildId]}
    >
      <Icon className="guild-badge__icon" />
    </span>
  );
}
