import type { GoodId } from "../sim";

/**
 * Polish display names for the five E2 goods (#184 UI language sweep).
 * `GOODS[good].name` (src/sim/goods.ts) stays the English identifier-facing
 * name owned by the sim's own scope wall (untouched here, same precedent as
 * `guildDisplay.tsx`'s `GUILD_NAME_PL` vs. `GUILDS[id].name`) — this is the
 * one home for the player-facing translation.
 *
 * Lives in `src/store`, not `src/ui`, even though most of its callers are UI
 * components: `store/waitingStatus.ts` needs it too, and `ui` already
 * depends on `store` (never the reverse) — putting it here keeps that
 * direction intact instead of introducing a `store` → `ui` import.
 *
 * Coined by the coder, not ratified at a grill — CONTEXT.md's "The five E2
 * goods" entry carries the same flag: translating "grain" isn't a new
 * domain concept, but nobody had picked the Polish word before this pair of
 * files. Flag for owner review.
 */
export const GOOD_NAME_PL: Record<GoodId, string> = {
  grain: "Zboże",
  textiles: "Tekstylia",
  // "eteryczna" (nature), not "eterowa" (industrial) — aetherSalt is mined,
  // CONTEXT.md's Aether ice vocabulary law (2026-07-16 owner decision).
  aetherSalt: "Sól eteryczna",
  electronics: "Elektronika",
  timber: "Drewno",
};
