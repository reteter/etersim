import { describe, expect, it } from "vitest";
import type { GoodId, PortId, Route, RouteId, World } from "../sim";
import type { MarketSignal, MarketSignalEntry } from "../store/marketSignal";
import {
  appendStop,
  inferOrderKind,
  isValidRouteDraft,
  lastStopIndexForPort,
  moveStop,
  nextRouteId,
  parseMinMarginInput,
  parseQtyInput,
  patchStopOrder,
  removeStop,
  setStopOrder,
  suggestedPairingPortIds,
} from "./routeAuthoring";

const GRAIN = "grain" as GoodId;
const TIMBER = "timber" as GoodId;
const P1 = "p1" as PortId;
const P2 = "p2" as PortId;
const P3 = "p3" as PortId;

function emptyWorld(routes: Route[] = [], ledger: World["ledger"] = []): World {
  return {
    company: { routes, ships: [], buildings: [], thalers: 0 },
    ledger,
  } as unknown as World;
}

describe("routeAuthoring — nextRouteId (relocated, behavior-neutral)", () => {
  it("returns r1 for an empty world", () => {
    expect(nextRouteId(emptyWorld())).toBe("r1");
  });

  it("scans past the highest numeric id among live routes", () => {
    const routes = [
      { id: "r1" as RouteId, name: "A", stops: [] },
      { id: "r3" as RouteId, name: "B", stops: [] },
    ];
    expect(nextRouteId(emptyWorld(routes))).toBe("r4");
  });

  it("also scans routeId-tagged Ledger trades, so a deleted route's id is never recycled", () => {
    const ledger = [
      { kind: "trade", routeId: "r5" as RouteId } as World["ledger"][number],
    ];
    expect(nextRouteId(emptyWorld([], ledger))).toBe("r6");
  });
});

describe("routeAuthoring — qty/minMargin parsers (mirror RoutesTab semantics)", () => {
  it("parseQtyInput: blank -> clear (qty undefined)", () => {
    expect(parseQtyInput("")).toEqual({ kind: "clear" });
    expect(parseQtyInput("   ")).toEqual({ kind: "clear" });
  });

  it("parseQtyInput: a positive integer -> set", () => {
    expect(parseQtyInput("5")).toEqual({ kind: "set", qty: 5 });
  });

  it("parseQtyInput: non-positive or non-integer -> ignore", () => {
    expect(parseQtyInput("0")).toEqual({ kind: "ignore" });
    expect(parseQtyInput("-3")).toEqual({ kind: "ignore" });
    expect(parseQtyInput("2.5")).toEqual({ kind: "ignore" });
    expect(parseQtyInput("abc")).toEqual({ kind: "ignore" });
  });

  it("parseMinMarginInput: blank -> clear (no gate)", () => {
    expect(parseMinMarginInput("")).toEqual({ kind: "clear" });
  });

  it("parseMinMarginInput: any finite number -> set (including negative/zero)", () => {
    expect(parseMinMarginInput("12.5")).toEqual({ kind: "set", minMargin: 12.5 });
    expect(parseMinMarginInput("-3")).toEqual({ kind: "set", minMargin: -3 });
    expect(parseMinMarginInput("0")).toEqual({ kind: "set", minMargin: 0 });
  });

  it("parseMinMarginInput: non-finite -> ignore", () => {
    expect(parseMinMarginInput("abc")).toEqual({ kind: "ignore" });
  });
});

describe("routeAuthoring — draft validity (≥2 Stops over ≥2 distinct ports)", () => {
  const base: Route = { id: "r1" as RouteId, name: "Draft", stops: [] };

  it("empty draft is invalid", () => {
    expect(isValidRouteDraft(base)).toBe(false);
  });

  it("one Stop is invalid", () => {
    expect(isValidRouteDraft({ ...base, stops: [{ portId: P1, orders: [] }] })).toBe(false);
  });

  it("two Stops at the same port is invalid (not 2 distinct ports)", () => {
    const draft = { ...base, stops: [{ portId: P1, orders: [] }, { portId: P1, orders: [] }] };
    expect(isValidRouteDraft(draft)).toBe(false);
  });

  it("two Stops over two distinct ports is valid", () => {
    const draft = { ...base, stops: [{ portId: P1, orders: [] }, { portId: P2, orders: [] }] };
    expect(isValidRouteDraft(draft)).toBe(true);
  });
});

describe("routeAuthoring — appendStop / removeStop / moveStop", () => {
  const base: Route = { id: "r1" as RouteId, name: "Draft", stops: [] };

  it("appendStop adds a Stop with no orders at the end", () => {
    const next = appendStop(base, P1);
    expect(next.stops).toEqual([{ portId: P1, orders: [] }]);
    const next2 = appendStop(next, P2);
    expect(next2.stops).toEqual([{ portId: P1, orders: [] }, { portId: P2, orders: [] }]);
  });

  it("removeStop drops the Stop at the given index", () => {
    const draft = appendStop(appendStop(base, P1), P2);
    const next = removeStop(draft, 0);
    expect(next.stops).toEqual([{ portId: P2, orders: [] }]);
  });

  it("moveStop reorders Stops by swapping with the adjacent index", () => {
    const draft = appendStop(appendStop(appendStop(base, P1), P2), P3);
    const next = moveStop(draft, 0, 1);
    expect(next.stops.map((s) => s.portId)).toEqual([P2, P1, P3]);
  });

  it("moveStop is a no-op out of bounds", () => {
    const draft = appendStop(appendStop(base, P1), P2);
    expect(moveStop(draft, 0, -1)).toBe(draft);
    expect(moveStop(draft, 1, 1)).toBe(draft);
  });
});

describe("routeAuthoring — setStopOrder / patchStopOrder", () => {
  const draft: Route = {
    id: "r1" as RouteId,
    name: "Draft",
    stops: [{ portId: P1, orders: [] }, { portId: P2, orders: [] }],
  };

  it("setStopOrder attaches a new order for a good with no prior order", () => {
    const next = setStopOrder(draft, 0, GRAIN, "buy");
    expect(next.stops[0].orders).toEqual([{ kind: "buy", good: GRAIN }]);
  });

  it("setStopOrder replaces (never adds to) an existing order for that good", () => {
    const withBuy = setStopOrder(draft, 0, GRAIN, "buy");
    const next = setStopOrder(withBuy, 0, GRAIN, "sell");
    expect(next.stops[0].orders).toEqual([{ kind: "sell", good: GRAIN }]);
  });

  it("setStopOrder toggles off when re-clicking the same active kind", () => {
    const withBuy = setStopOrder(draft, 0, GRAIN, "buy");
    const next = setStopOrder(withBuy, 0, GRAIN, "buy");
    expect(next.stops[0].orders).toEqual([]);
  });

  it("patchStopOrder sets qty/minMargin on the existing order without touching kind/good", () => {
    const withBuy = setStopOrder(draft, 0, GRAIN, "buy");
    const next = patchStopOrder(withBuy, 0, GRAIN, { qty: 10 });
    expect(next.stops[0].orders).toEqual([{ kind: "buy", good: GRAIN, qty: 10 }]);
  });
});

describe("routeAuthoring — inferOrderKind (tie rule, playtest-tunable)", () => {
  const entry = (buyTier: MarketSignalEntry["buyTier"], sellTier: MarketSignalEntry["sellTier"]): MarketSignalEntry => ({
    buyTier,
    sellTier,
  });

  it("a strictly stronger buy tier infers buy", () => {
    expect(inferOrderKind(entry("strong", "weak"))).toBe("buy");
  });

  it("a strictly stronger sell tier infers sell", () => {
    expect(inferOrderKind(entry("weak", "strong"))).toBe("sell");
  });

  it("a tie (equal tiers) defaults to buy", () => {
    expect(inferOrderKind(entry("mid", "mid"))).toBe("buy");
  });

  it("both weak defaults to buy", () => {
    expect(inferOrderKind(entry("weak", "weak"))).toBe("buy");
  });

  it("returns null when neither side has a market at all", () => {
    expect(inferOrderKind(entry(null, null))).toBe(null);
  });

  it("a present tier beats a null (no market) opposite side", () => {
    expect(inferOrderKind(entry(null, "weak"))).toBe("sell");
    expect(inferOrderKind(entry("weak", null))).toBe("buy");
  });
});

describe("routeAuthoring — suggestedPairingPortIds (highlight-only pairing)", () => {
  it("suggests the best-bid port for each good bought in the draft, excluding ports already in the draft", () => {
    const draft: Route = {
      id: "r1" as RouteId,
      name: "Draft",
      stops: [{ portId: P1, orders: [{ kind: "buy", good: GRAIN }] }],
    };
    const signal: MarketSignal = {
      entries: {},
      bestAskPortId: { [GRAIN]: P1 } as Record<GoodId, PortId | null>,
      bestBidPortId: { [GRAIN]: P2 } as Record<GoodId, PortId | null>,
    };
    expect(suggestedPairingPortIds(draft, signal)).toEqual(new Set([P2]));
  });

  it("excludes a suggestion whose port is already a Stop in the draft", () => {
    const draft: Route = {
      id: "r1" as RouteId,
      name: "Draft",
      stops: [
        { portId: P1, orders: [{ kind: "buy", good: GRAIN }] },
        { portId: P2, orders: [] },
      ],
    };
    const signal: MarketSignal = {
      entries: {},
      bestAskPortId: { [GRAIN]: P1 } as Record<GoodId, PortId | null>,
      bestBidPortId: { [GRAIN]: P2 } as Record<GoodId, PortId | null>,
    };
    expect(suggestedPairingPortIds(draft, signal)).toEqual(new Set());
  });

  it("never suggests for sell orders (buy-only pairing assist, spec §Attaching orders)", () => {
    const draft: Route = {
      id: "r1" as RouteId,
      name: "Draft",
      stops: [{ portId: P1, orders: [{ kind: "sell", good: TIMBER }] }],
    };
    const signal: MarketSignal = {
      entries: {},
      bestAskPortId: { [TIMBER]: P3 } as Record<GoodId, PortId | null>,
      bestBidPortId: { [TIMBER]: P2 } as Record<GoodId, PortId | null>,
    };
    expect(suggestedPairingPortIds(draft, signal)).toEqual(new Set());
  });
});

describe("routeAuthoring — lastStopIndexForPort", () => {
  it("returns null when the port has no Stop in the draft", () => {
    const draft: Route = { id: "r1" as RouteId, name: "Draft", stops: [{ portId: P1, orders: [] }] };
    expect(lastStopIndexForPort(draft, P2)).toBeNull();
  });

  it("returns the most recently appended Stop's index for a repeated port", () => {
    const draft: Route = {
      id: "r1" as RouteId,
      name: "Draft",
      stops: [
        { portId: P1, orders: [] },
        { portId: P2, orders: [] },
        { portId: P1, orders: [] },
      ],
    };
    expect(lastStopIndexForPort(draft, P1)).toBe(2);
  });
});

describe("routeAuthoring — order equivalence (pin #4)", () => {
  it("a board-built draft matches a hand-built Route for the same intent", () => {
    // Intent: buy grain at P1, sell it at P2 — the classic two-stop loop.
    let draft: Route = { id: "r7" as RouteId, name: "Route 1", stops: [] };
    draft = appendStop(draft, P1);
    draft = appendStop(draft, P2);
    draft = setStopOrder(draft, 0, GRAIN, "buy");
    draft = patchStopOrder(draft, 0, GRAIN, { qty: 20 });
    draft = setStopOrder(draft, 1, GRAIN, "sell");

    const expected: Route = {
      id: "r7" as RouteId,
      name: "Route 1",
      stops: [
        { portId: P1, orders: [{ kind: "buy", good: GRAIN, qty: 20 }] },
        { portId: P2, orders: [{ kind: "sell", good: GRAIN }] },
      ],
    };

    expect(draft).toEqual(expected);
    expect(isValidRouteDraft(draft)).toBe(true);
  });
});
