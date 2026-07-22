import type { GoodId, PortId, Route, RouteId, Stop, StopOrder, World } from "../sim";
import type { MarketSignal, MarketSignalEntry, SignalTier } from "../store/marketSignal";

/**
 * Pure Route-draft-authoring helpers (docs/specs/E16-workbench.md §Construction
 * is port-centric, §Attaching orders; issue #394 pin #2). Relocated from
 * `RoutesTab.tsx` (`nextRouteId`, the qty/minMargin parsers, the draft-validity
 * check) so the board (`PriceBoardOverlay.tsx`) and the roster editor
 * (`RoutesTab.tsx`) share one copy — `nextRouteId` in particular is
 * determinism-critical: two independent copies could drift and recycle a
 * Route id, polluting loop metrics (routeMetrics.ts folds the Ledger by
 * routeId). Editing `RoutesTab.tsx` to import these is a behavior-neutral
 * mechanical change (in-scope per #394's package).
 *
 * No React/DOM here — these are plain functions over the `Route` value the
 * caller holds in local `useState` (Pin #1: dispatch only at valid
 * checkpoints, never on every gesture).
 */

/** Next Route id: "r" + one past the highest numeric id used so far — by a
 *  live Route or by any routeId-tagged trade in the Ledger, so a deleted
 *  Route's id is never recycled into a new Route (its old Ledger tags would
 *  pollute the new Route's loop metrics). Deterministic, derived from World
 *  state only (ADR-0003 — no RNG, no clock). */
export function nextRouteId(world: World): RouteId {
  let max = 0;
  const consider = (id: string) => {
    const m = /^r(\d+)$/.exec(id);
    if (m) max = Math.max(max, Number(m[1]));
  };
  for (const route of world.company.routes) consider(route.id);
  for (const event of world.ledger) {
    if (event.kind === "trade" && event.routeId !== undefined) consider(event.routeId);
  }
  return `r${max + 1}`;
}

export type QtyInputResult =
  | { readonly kind: "clear" }
  | { readonly kind: "set"; readonly qty: number }
  | { readonly kind: "ignore" };

/** "up to N": blank ⇒ greedy (`qty` absent, "clear"); anything short of a
 *  positive integer is ignored (matches `isValidRoute`'s own qty check,
 *  commands.ts) rather than let the editor build a route the sim would
 *  reject outright. Pure parse rule — the caller decides how to apply
 *  "ignore" (RoutesTab/board both mean "leave the field as it was"). */
export function parseQtyInput(raw: string): QtyInputResult {
  const trimmed = raw.trim();
  if (trimmed === "") return { kind: "clear" };
  const n = Number(trimmed);
  if (!Number.isInteger(n) || n <= 0) return { kind: "ignore" };
  return { kind: "set", qty: n };
}

export type MinMarginInputResult =
  | { readonly kind: "clear" }
  | { readonly kind: "set"; readonly minMargin: number }
  | { readonly kind: "ignore" };

/** Margin Gate threshold: blank ⇒ no gate ("clear", `minMargin` absent);
 *  `isValidRoute` places no sign/integer constraint on `minMargin` itself
 *  (only that it's buy-only), so any finite number is accepted. */
export function parseMinMarginInput(raw: string): MinMarginInputResult {
  const trimmed = raw.trim();
  if (trimmed === "") return { kind: "clear" };
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return { kind: "ignore" };
  return { kind: "set", minMargin: n };
}

/** Draft-validity gate (Pin #1): mirrors the structural half of
 *  `isValidRoute` (commands.ts) that a half-built draft can actually violate
 *  in the editors — ≥2 Stops over ≥2 distinct ports. (Per-Stop "≤1 order per
 *  good" is enforced by construction in `setStopOrder` below, so it never
 *  needs re-checking here.) `createRoute`/`updateRoute` still no-op through
 *  the sim's own full `isValidRoute` — this is a UI-side hint, not a
 *  replacement for that gate. */
export function isValidRouteDraft(draft: Route): boolean {
  return draft.stops.length >= 2 && new Set(draft.stops.map((s) => s.portId)).size >= 2;
}

/** Appends a new, order-less Stop for `portId` at the end of the draft — the
 *  port-centric spine gesture (spec §Construction is port-centric): "click a
 *  port's row → the port appends to the ribbon as a Stop." */
export function appendStop(draft: Route, portId: PortId): Route {
  return { ...draft, stops: [...draft.stops, { portId, orders: [] }] };
}

/** Removes the Stop at `index`. */
export function removeStop(draft: Route, index: number): Route {
  return { ...draft, stops: draft.stops.filter((_, i) => i !== index) };
}

/** Reorders by swapping the Stop at `index` with its neighbor at
 *  `index + direction` (direction -1 = move earlier, +1 = move later). A
 *  no-op (same reference back) when the swap would fall out of bounds. */
export function moveStop(draft: Route, index: number, direction: -1 | 1): Route {
  const target = index + direction;
  if (target < 0 || target >= draft.stops.length) return draft;
  const stops = draft.stops.slice();
  [stops[index], stops[target]] = [stops[target], stops[index]];
  return { ...draft, stops };
}

/** Attaches/replaces/toggles-off an order for `good` at the Stop `stopIndex`
 *  — mirrors `RoutesTab`'s `StopRow.setOrder`: clicking the already-active
 *  kind for that good removes the order; any other kind replaces (never
 *  adds to) the good's order, enforcing "a good in at most one order per
 *  Stop" by construction. */
export function setStopOrder(
  draft: Route,
  stopIndex: number,
  good: GoodId,
  kind: StopOrder["kind"],
): Route {
  const stop = draft.stops[stopIndex];
  const current = stop.orders.find((o) => o.good === good);
  const withoutGood = stop.orders.filter((o) => o.good !== good);
  const nextOrders: readonly StopOrder[] =
    current?.kind === kind ? withoutGood : [...withoutGood, { kind, good }];
  return patchStop(draft, stopIndex, { ...stop, orders: nextOrders });
}

/** Removes any order for `good` at the Stop `stopIndex` (no-op if none). */
export function removeStopOrder(draft: Route, stopIndex: number, good: GoodId): Route {
  const stop = draft.stops[stopIndex];
  return patchStop(draft, stopIndex, {
    ...stop,
    orders: stop.orders.filter((o) => o.good !== good),
  });
}

/** Patches the good's existing order (qty and/or minMargin) in place — never
 *  changes `kind`/`good`; a no-op if the good has no active order yet
 *  (mirrors `RoutesTab`'s `StopRow.patchOrder`, only ever called for an
 *  already-active cell). */
export function patchStopOrder(
  draft: Route,
  stopIndex: number,
  good: GoodId,
  patch: Partial<Pick<StopOrder, "qty" | "minMargin">>,
): Route {
  const stop = draft.stops[stopIndex];
  const nextOrders = stop.orders.map((o) => (o.good === good ? { ...o, ...patch } : o));
  return patchStop(draft, stopIndex, { ...stop, orders: nextOrders });
}

function patchStop(draft: Route, stopIndex: number, nextStop: Stop): Route {
  return { ...draft, stops: draft.stops.map((s, i) => (i === stopIndex ? nextStop : s)) };
}

const TIER_STRENGTH: Record<SignalTier, number> = { strong: 3, mid: 2, weak: 1 };

function tierStrength(tier: SignalTier | null): number {
  return tier === null ? 0 : TIER_STRENGTH[tier];
}

/**
 * Inferred-kind tie rule (E16 spec §Attaching orders, #394 pin #3 —
 * playtest-tunable, like `NEAR_BEST_BAND`): a clicked (port, good) has both a
 * buyTier and a sellTier. Infer the kind whose tier is **strictly** stronger;
 * on a tie (including both-weak, or both-absent-on-one-side-only-if-equal)
 * default to **buy** (you buy before you sell on a fresh leg). Always
 * overridable by the player (the caller's UI, not this function). Returns
 * `null` only when the good has no market at all here (`buyTier` and
 * `sellTier` both `null`) — nothing to attach.
 */
export function inferOrderKind(entry: MarketSignalEntry): "buy" | "sell" | null {
  if (entry.buyTier === null && entry.sellTier === null) return null;
  const buyStrength = tierStrength(entry.buyTier);
  const sellStrength = tierStrength(entry.sellTier);
  return sellStrength > buyStrength ? "sell" : "buy";
}

/**
 * Highlight-only pairing assist (spec §Attaching orders — "never auto-wire"):
 * for every **buy** order already in the draft, the region's best-bid port
 * for that good is a *suggested* next Stop — surfaced as a highlight, never
 * wired automatically. Ports already present as a Stop in the draft are
 * excluded (nothing to suggest, they're already there). Sell orders never
 * suggest (buying pairs forward to a sell-stop; a sell order has no forward
 * leg to suggest under this scheme).
 */
/** The index of the most recently appended Stop at `portId`, or `null` if
 *  the port has no Stop yet in the draft. Board authoring attaches a
 *  good-cell order to *this* Stop — the one the player is most likely
 *  building against — when a port appears more than once in the draft. */
export function lastStopIndexForPort(draft: Route, portId: PortId): number | null {
  for (let i = draft.stops.length - 1; i >= 0; i--) {
    if (draft.stops[i].portId === portId) return i;
  }
  return null;
}

export function suggestedPairingPortIds(draft: Route, signal: MarketSignal): Set<PortId> {
  const existing = new Set(draft.stops.map((s) => s.portId));
  const suggested = new Set<PortId>();
  for (const stop of draft.stops) {
    for (const order of stop.orders) {
      if (order.kind !== "buy") continue;
      const bidPortId = signal.bestBidPortId[order.good];
      if (bidPortId !== null && bidPortId !== undefined && !existing.has(bidPortId)) {
        suggested.add(bidPortId);
      }
    }
  }
  return suggested;
}
