import type { GoodId } from "./goods";
import type { PortId } from "./region";

/** Stable identifier for a Route template (CONTEXT.md). */
export type RouteId = string;

/** One order at a Stop: buy/sell/deliver a specific good. */
export interface StopOrder {
  readonly kind: "buy" | "sell" | "deliver";
  readonly good: GoodId;
  /** "Up to N" ceiling (E9.1, buy & sell only). Absent ⇒ today's greedy
   *  behavior (buy fills the Hold, sell empties the good). */
  readonly qty?: number;
  /** Margin Gate (E9.1, buy only). Absent ⇒ no gate — the buy executes
   *  normally on arrival. See CONTEXT.md — Margin Gate. */
  readonly minMargin?: number;
}

/** One entry in a Route: a port plus its ordered StopOrders. */
export interface Stop {
  readonly portId: PortId;
  readonly orders: readonly StopOrder[];
}

/** A Company-level Route template (CONTEXT.md). */
export interface Route {
  readonly id: RouteId;
  readonly name: string;
  readonly stops: readonly Stop[];
}

/**
 * Reference port for a Margin Gate (E9.1): the next *sell*-stop for `good`
 * along the route, scanning forward from `currentStopIndex` and wrapping the
 * loop (routes are cyclic — the sell may sit "before" the current Stop in
 * the array but still be next in the voyage). The current Stop is skipped
 * structurally (offset starts at 1). deliver is never a reference (it
 * yields no Thalers). No sell-stop for the good on the route ⇒ `null` — the
 * gate is inactive and the buy executes normally.
 */
export function resolveReferencePort(
  route: Route,
  currentStopIndex: number,
  good: GoodId,
): PortId | null {
  const n = route.stops.length;
  for (let offset = 1; offset < n; offset++) {
    const idx = (currentStopIndex + offset) % n;
    const stop = route.stops[idx];
    if (stop.orders.some((order) => order.kind === "sell" && order.good === good)) {
      return stop.portId;
    }
  }
  return null;
}
