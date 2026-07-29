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
 * Coder-proposed, owner-ratified 2026-07-28 — see CONTEXT.md's "The five E2
 * goods" entry for the per-good rationale (`timber → drewno`'s deliberate
 * collision with Clearwood included).
 *
 * These are **nominative, capitalized label forms only** (CONTEXT.md's "Good
 * name grammar", owner decision 2026-07-28, widened same day) — correct for a
 * bare label (`Zboże: 40/60`) but never the bare object of a verb and never
 * directly after a preposition, in either word order (`Kup Zboże` and
 * `Zboże Kup` are the same defect). Callers must break the adjacency with a
 * separator instead of inflecting the name — `<Nazwa> ×<qty>` for a quantity
 * (`LedgerOverlay.tsx`'s `describeTransaction`, `TopBar.tsx`'s
 * `routedSaleNote`), `<Verb>: <Nazwa>` or `<Nazwa>: <Verb>` next to a bare
 * verb (`PortPanel.tsx`'s buy/sell/store/withdraw aria-labels,
 * `RoutesTab.tsx`'s per-good order chips). No second, inflected table —
 * ever, for any future good.
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
