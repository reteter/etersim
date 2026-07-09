import type { GoodId } from "./goods";
import type { PortId } from "./region";

/** Stable identifier for a Route template (CONTEXT.md). */
export type RouteId = string;

/** One order at a Stop: buy/sell/deliver a specific good. */
export interface StopOrder {
  readonly kind: "buy" | "sell" | "deliver";
  readonly good: GoodId;
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
