import type { GoodId } from "./goods";
import type { PortId } from "./region";
import type { StoreRef } from "./transfer";

/** Stable identifier for a Route template (CONTEXT.md). */
export type RouteId = string;

/** One order at a Stop. Goods movements that are not market trades carry an
 *  explicit Company-store address (E13/ADR-0008). */
export type StopOrder =
  | {
      readonly kind: "buy";
      readonly good: GoodId;
      readonly qty?: number;
      readonly minMargin?: number;
    }
  | {
      readonly kind: "sell";
      readonly good: GoodId;
      readonly qty?: number;
      readonly minMargin?: number;
    }
  | {
      readonly kind: "deliver";
      readonly good: GoodId;
      readonly target: StoreRef;
      readonly qty?: number;
      readonly minMargin?: number;
    }
  | {
      readonly kind: "store";
      readonly good: GoodId;
      readonly target: StoreRef;
      readonly qty?: number;
      readonly minMargin?: number;
    }
  | {
      readonly kind: "withdraw";
      readonly good: GoodId;
      readonly source: StoreRef;
      readonly qty?: number;
      readonly minMargin?: number;
    };

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
