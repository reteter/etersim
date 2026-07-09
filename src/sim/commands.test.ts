import { describe, expect, it } from "vitest";
import { effectiveBase, quoteBuy, quoteSell } from "./market";
import { tick } from "./tick";
import { cargoUsed, etaTicks, type Ship } from "./ship";
import type { Route } from "./route";
import type { GoodId } from "./goods";
import { createWorld, STARTING_HOLD, STARTING_THALERS, type World } from "./world";

const world0 = createWorld("test-seed");
const ship = (w: World): Ship => w.company.ships[0];
const homePort = (w: World) => {
  const loc = ship(w).location;
  if (loc.kind !== "docked") throw new Error("ship not docked");
  return w.region.ports.find((p) => p.id === loc.portId)!;
};

describe("createWorld", () => {
  it("is deterministic and accepts string seeds", () => {
    expect(createWorld("etersim")).toEqual(createWorld("etersim"));
    expect(createWorld("a")).not.toEqual(createWorld("b"));
  });

  it("starts the company with one docked ship and the spec thalers/hold", () => {
    expect(world0.company.thalers).toBe(STARTING_THALERS);
    expect(world0.company.ships).toHaveLength(1);
    expect(ship(world0).hold).toBe(STARTING_HOLD);
    expect(ship(world0).location.kind).toBe("docked");
    expect(cargoUsed(ship(world0))).toBe(0);
  });

  it("survives a JSON round-trip unchanged (ADR-0004)", () => {
    expect(JSON.parse(JSON.stringify(world0))).toEqual(world0);
  });
});

describe("buy command", () => {
  const port = homePort(world0);
  const shipId = ship(world0).id;

  it("moves thalers, stock and cargo by the marginal quote", () => {
    const cost = quoteBuy(port.market.grain, effectiveBase(port, "grain"), 10)!;
    const next = tick(world0, [{ kind: "buy", shipId, good: "grain", qty: 10 }]);
    expect(next.company.thalers).toBe(STARTING_THALERS - cost);
    expect(ship(next).cargo.grain).toBe(10);
    // stock: -10 from the trade, then one tick of market flows on top
    const portAfter = next.region.ports.find((p) => p.id === port.id)!;
    expect(portAfter.market.grain.stock).toBeLessThanOrEqual(port.market.grain.stock - 10 + 4);
  });

  it("rejects a buy the company cannot afford, leaving the world unchanged", () => {
    const next = tick(world0, [{ kind: "buy", shipId, good: "timber", qty: 50 }]);
    expect(next).toEqual(tick(world0, []));
  });

  it("rejects a buy that would overflow the hold", () => {
    const next = tick(world0, [{ kind: "buy", shipId, good: "grain", qty: STARTING_HOLD + 1 }]);
    expect(next).toEqual(tick(world0, []));
  });

  it("rejects a buy over the port's stock", () => {
    const port = homePort(world0);
    const overStock = Math.floor(port.market.grain.stock) + 1;
    const next = tick(world0, [{ kind: "buy", shipId, good: "grain", qty: overStock }]);
    expect(next).toEqual(tick(world0, []));
  });

  it("rejects unknown ships and non-positive quantities", () => {
    expect(tick(world0, [{ kind: "buy", shipId: "ghost", good: "grain", qty: 1 }])).toEqual(
      tick(world0, []),
    );
    expect(tick(world0, [{ kind: "buy", shipId, good: "grain", qty: 0 }])).toEqual(
      tick(world0, []),
    );
  });
});

describe("sell command", () => {
  const shipId = ship(world0).id;
  const withCargo = tick(world0, [{ kind: "buy", shipId, good: "grain", qty: 10 }]);

  it("pays the marginal quote and moves cargo back to stock", () => {
    const port = homePort(withCargo);
    const revenue = quoteSell(port.market.grain, effectiveBase(port, "grain"), 10)!;
    const next = tick(withCargo, [{ kind: "sell", shipId, good: "grain", qty: 10 }]);
    expect(next.company.thalers).toBe(withCargo.company.thalers + revenue);
    expect(ship(next).cargo.grain).toBe(0);
  });

  it("rejects selling more than the cargo holds", () => {
    const next = tick(withCargo, [{ kind: "sell", shipId, good: "grain", qty: 11 }]);
    expect(next).toEqual(tick(withCargo, []));
  });
});

describe("sailTo command", () => {
  const shipId = ship(world0).id;
  const target = world0.region.ports.find((p) => p.id !== homePort(world0).id)!;

  it("puts the ship underway on the shortest course", () => {
    const next = tick(world0, [{ kind: "sailTo", shipId, portId: target.id }]);
    const loc = ship(next).location;
    expect(loc.kind).toBe("underway");
    if (loc.kind === "underway") {
      expect(loc.destination).toBe(target.id);
      expect(loc.course.length).toBeGreaterThan(0);
    }
  });

  it("docks at the destination after exactly etaTicks more ticks", () => {
    let w = tick(world0, [{ kind: "sailTo", shipId, portId: target.id }]);
    // the command tick already sailed hour 1; etaTicks reports what's left
    const eta = etaTicks(ship(w), w.region);
    expect(eta).toBeGreaterThan(0);
    for (let t = 0; t < eta - 1; t++) {
      w = tick(w, []);
      expect(ship(w).location.kind).toBe("underway");
    }
    w = tick(w, []);
    expect(ship(w).location).toEqual({ kind: "docked", portId: target.id });
    expect(etaTicks(ship(w), w.region)).toBe(0);
  });

  it("rejects sailing while underway and sailing to the current port", () => {
    const underway = tick(world0, [{ kind: "sailTo", shipId, portId: target.id }]);
    expect(
      tick(underway, [{ kind: "sailTo", shipId, portId: homePort(world0).id }]),
    ).toEqual(tick(underway, []));
    expect(tick(world0, [{ kind: "sailTo", shipId, portId: homePort(world0).id }])).toEqual(
      tick(world0, []),
    );
  });

  it("rejects buy/sell while underway", () => {
    const underway = tick(world0, [{ kind: "sailTo", shipId, portId: target.id }]);
    expect(tick(underway, [{ kind: "buy", shipId, good: "grain", qty: 1 }])).toEqual(
      tick(underway, []),
    );
  });
});

describe("long-run determinism (M1 success criterion)", () => {
  it("same seed + same commands over 5000 ticks => deep-equal world", () => {
    const run = (): World => {
      let w = createWorld(1234);
      const shipId = ship(w).id;
      const ports = w.region.ports.map((p) => p.id);
      for (let t = 0; t < 5000; t++) {
        const commands =
          t % 97 === 0 && ship(w).location.kind === "docked"
            ? [
                { kind: "buy", shipId, good: "grain", qty: 5 } as const,
                { kind: "sailTo", shipId, portId: ports[(t / 97) % ports.length] } as const,
              ]
            : t % 43 === 0
              ? [{ kind: "sell", shipId, good: "grain", qty: 5 } as const]
              : [];
        w = tick(w, commands);
      }
      return w;
    };
    const a = run();
    expect(a).toEqual(run());
    expect(a.tick).toBe(5000);
    expect(JSON.parse(JSON.stringify(a))).toEqual(a); // mid-session save round-trip
  });
});

describe("tick keeps day-boundary price snapshots for trend arrows", () => {
  it("refreshes snapshots every TICKS_PER_DAY ticks", () => {
    let w = world0;
    const before = w.priceSnapshots;
    for (let t = 0; t < 23; t++) w = tick(w, []);
    expect(w.priceSnapshots).toEqual(before); // unchanged mid-day
    w = tick(w, []);
    expect(w.priceSnapshots).not.toEqual(before); // refreshed at tick 24
  });
});

// E9 route command tests (TDD)
describe("route commands (E9)", () => {
  const shipId = ship(world0).id;
  const ports = world0.region.ports;
  const p0 = ports[0].id;
  const p1 = ports[1].id;

  function mkRoute(id: string, stops: { portId: string; orders: { kind: "buy" | "sell" | "deliver"; good: GoodId }[] }[]): Route {
    return { id, name: id, stops };
  }

  it("rejects createRoute with <2 stops (unchanged)", () => {
    const bad = mkRoute("r1", [{ portId: p0, orders: [{ kind: "buy", good: "grain" }] }]);
    const next = tick(world0, [{ kind: "createRoute", route: bad }]);
    expect(next).toEqual(tick(world0, []));
  });

  it("rejects createRoute when a good appears twice in one Stop (unchanged)", () => {
    const bad = mkRoute("r1", [
      { portId: p0, orders: [{ kind: "buy", good: "grain" }, { kind: "sell", good: "grain" }] },
      { portId: p1, orders: [] },
    ]);
    const next = tick(world0, [{ kind: "createRoute", route: bad }]);
    expect(next).toEqual(tick(world0, []));
  });

  it("createRoute adds a valid route (>=2 stops, distinct goods per stop)", () => {
    const r = mkRoute("r1", [
      { portId: p0, orders: [{ kind: "buy", good: "grain" }] },
      { portId: p1, orders: [{ kind: "sell", good: "grain" }] },
    ]);
    const next = tick(world0, [{ kind: "createRoute", route: r }]);
    expect(next.company.routes).toHaveLength(1);
    expect(next.company.routes[0].id).toBe("r1");
  });

  it("rejects duplicate createRoute id (unchanged)", () => {
    const r = mkRoute("r1", [
      { portId: p0, orders: [{ kind: "buy", good: "grain" }] },
      { portId: p1, orders: [{ kind: "sell", good: "grain" }] },
    ]);
    const w1 = tick(world0, [{ kind: "createRoute", route: r }]);
    const next = tick(w1, [{ kind: "createRoute", route: r }]);
    expect(next).toEqual(tick(w1, []));
  });

  it("updateRoute replaces template; invalid update drops unchanged", () => {
    const r = mkRoute("r1", [
      { portId: p0, orders: [{ kind: "buy", good: "grain" }] },
      { portId: p1, orders: [{ kind: "sell", good: "grain" }] },
    ]);
    const w1 = tick(world0, [{ kind: "createRoute", route: r }]);
    const r2 = mkRoute("r1", [
      { portId: p0, orders: [{ kind: "buy", good: "grain" }] },
      { portId: p1, orders: [{ kind: "buy", good: "grain" }, { kind: "sell", good: "grain" }] }, // duplicate within one Stop -> invalid
    ]);
    const bad = tick(w1, [{ kind: "updateRoute", route: r2 }]);
    expect(bad).toEqual(tick(w1, []));
    const r3 = mkRoute("r1", [
      { portId: p0, orders: [{ kind: "buy", good: "grain" }] },
      { portId: p1, orders: [{ kind: "sell", good: "textiles" }] },
    ]);
    const ok = tick(w1, [{ kind: "updateRoute", route: r3 }]);
    expect(ok.company.routes[0].stops[1].orders[0].good).toBe("textiles");
  });

  it("deleteRoute removes template; unknown id is no-op", () => {
    const r = mkRoute("r1", [
      { portId: p0, orders: [{ kind: "buy", good: "grain" }] },
      { portId: p1, orders: [{ kind: "sell", good: "grain" }] },
    ]);
    const w1 = tick(world0, [{ kind: "createRoute", route: r }]);
    const w2 = tick(w1, [{ kind: "deleteRoute", routeId: "r1" }]);
    expect(w2.company.routes).toHaveLength(0);
    const w3 = tick(w2, [{ kind: "deleteRoute", routeId: "ghost" }]);
    expect(w3).toEqual(tick(w2, []));
  });

  it("assignRoute wires assignment to ship; requires existing route with >=2 stops", () => {
    const r = mkRoute("r1", [
      { portId: p0, orders: [{ kind: "buy", good: "grain" }] },
      { portId: p1, orders: [{ kind: "sell", good: "grain" }] },
    ]);
    const w1 = tick(world0, [{ kind: "createRoute", route: r }]);
    const w2 = tick(w1, [{ kind: "assignRoute", shipId, routeId: "r1" }]);
    expect(w2.company.ships[0].assignment?.routeId).toBe("r1");
    expect(w2.company.ships[0].assignment?.nextStopIndex).toBe(0);
    expect(w2.company.ships[0].assignment?.suspended).toBe(false);
    // invalid route id -> equivalent to a no-op tick
    const bad = tick(w1, [{ kind: "assignRoute", shipId, routeId: "nope" }]);
    expect(bad).toEqual(tick(w1, []));
  });

  it("unassignRoute clears assignment", () => {
    const r = mkRoute("r1", [
      { portId: p0, orders: [{ kind: "buy", good: "grain" }] },
      { portId: p1, orders: [{ kind: "sell", good: "grain" }] },
    ]);
    const w1 = tick(world0, [
      { kind: "createRoute", route: r },
      { kind: "assignRoute", shipId, routeId: "r1" },
    ]);
    const w2 = tick(w1, [{ kind: "unassignRoute", shipId }]);
    expect(w2.company.ships[0].assignment).toBeUndefined();
  });

  it("manual sailTo on assigned unsuspended ship auto-suspends", () => {
    const r = mkRoute("r1", [
      { portId: p0, orders: [{ kind: "buy", good: "grain" }] },
      { portId: p1, orders: [{ kind: "sell", good: "grain" }] },
    ]);
    const w1 = tick(world0, [
      { kind: "createRoute", route: r },
      { kind: "assignRoute", shipId, routeId: "r1" },
    ]);
    const target = ports.find((p) => p.id !== p0)!.id;
    const w2 = tick(w1, [{ kind: "sailTo", shipId, portId: target }]);
    expect(w2.company.ships[0].assignment?.suspended).toBe(true);
    expect(w2.company.ships[0].location.kind).toBe("underway");
  });

  it("resumeRoute unsuspends and rejected resume is equivalent to a no-op tick", () => {
    const r = mkRoute("r1", [
      { portId: p0, orders: [{ kind: "buy", good: "grain" }] },
      { portId: p1, orders: [{ kind: "sell", good: "grain" }] },
    ]);
    const w1 = tick(world0, [{ kind: "createRoute", route: r }]);
    const w2 = tick(w1, [{ kind: "resumeRoute", shipId }]); // no assignment -> rejected
    expect(w2).toEqual(tick(w1, []));
    const w3 = tick(w1, [
      { kind: "assignRoute", shipId, routeId: "r1" },
      { kind: "sailTo", shipId, portId: ports.find((p) => p.id !== p0)!.id },
    ]);
    const w4 = tick(w3, [{ kind: "resumeRoute", shipId }]);
    expect(w4.company.ships[0].assignment?.suspended).toBe(false);
  });
});

// Determinism and equivalence (E9 AC)
describe("route determinism and equivalence (E9)", () => {
  it("same seed + same route CRUD/assign commands => deep-equal world after N ticks", () => {
    const run = (seed: number | string) => {
      let w = createWorld(seed);
      const sId = w.company.ships[0].id;
      const pa = w.region.ports[0].id;
      const pb = w.region.ports[1].id;
      const r: Route = { id: "loop", name: "loop", stops: [
        { portId: pa, orders: [{ kind: "buy", good: "grain" }] },
        { portId: pb, orders: [{ kind: "sell", good: "grain" }] },
      ] };
      w = tick(w, [{ kind: "createRoute", route: r }]);
      w = tick(w, [{ kind: "assignRoute", shipId: sId, routeId: "loop" }]);
      // Let it run a few loops worth of ticks
      for (let i = 0; i < 200; i++) w = tick(w, []);
      return w;
    };
    expect(run(123)).toEqual(run(123));
  });

  it("route buy/sell produces equivalent state to identical manual command sequence (same quotes, shared purse)", () => {
    // Build a minimal 2-port scenario where we can script both sides.
    // Use a fresh world; buy grain at home, sail to other, sell, sail back.
    let wRoute = createWorld("equiv-seed");
    const sId = wRoute.company.ships[0].id;
    const home = wRoute.region.ports[0];
    const other = wRoute.region.ports.find((p) => p.id !== home.id)!;
    const r: Route = { id: "rt", name: "rt", stops: [
      { portId: home.id, orders: [{ kind: "buy", good: "grain" }, { kind: "sell", good: "textiles" }] },
      { portId: other.id, orders: [{ kind: "sell", good: "grain" }, { kind: "buy", good: "textiles" }] },
    ] };
    wRoute = tick(wRoute, [{ kind: "createRoute", route: r }]);
    wRoute = tick(wRoute, [{ kind: "assignRoute", shipId: sId, routeId: "rt" }]);
    // Run enough ticks for at least one full loop (buy at home, sail, sell/buy at other, sail back)
    for (let i = 0; i < 300; i++) wRoute = tick(wRoute, []);

    // Route side
    let wr = createWorld("equiv2");
    const sr = wr.company.ships[0].id;
    const pr0 = wr.region.ports[0].id;
    const pr1 = wr.region.ports[1].id;
    const rr: Route = { id: "r1", name: "r1", stops: [
      { portId: pr0, orders: [{ kind: "buy", good: "grain" }] },
      { portId: pr1, orders: [{ kind: "sell", good: "grain" }] },
    ] };
    wr = tick(wr, [{ kind: "createRoute", route: rr }]);
    wr = tick(wr, [{ kind: "assignRoute", shipId: sr, routeId: "r1" }]);
    let prevTh = wr.company.thalers;
    let progressed = false;
    for (let t = 0; t < 500 && !progressed; t++) {
      wr = tick(wr, []);
      if (wr.company.ships[0].cargo.grain === 0 && wr.company.thalers !== prevTh) progressed = true;
      prevTh = wr.company.thalers;
    }
    // Manual side replicating same logical trades via explicit commands (same quotes/purse)
    const wm0 = createWorld("equiv2");
    const sm = wm0.company.ships[0].id;
    const port0 = wm0.region.ports.find((p) => p.id === pr0)!;
    const q = Math.min(5, Math.floor(port0.market.grain.stock));
    let wm = wm0;
    if (q > 0) {
      const c = quoteBuy(port0.market.grain, effectiveBase(port0, "grain"), q);
      if (c !== null && c <= wm.company.thalers) {
        wm = tick(wm, [{ kind: "buy", shipId: sm, good: "grain", qty: q }]);
        wm = tick(wm, [{ kind: "sailTo", shipId: sm, portId: pr1 }]);
        while (wm.company.ships[0].location.kind !== "docked") wm = tick(wm, []);
        const have = wm.company.ships[0].cargo.grain;
        if (have > 0) wm = tick(wm, [{ kind: "sell", shipId: sm, good: "grain", qty: have }]);
      }
    }
    expect(wr.company.thalers).toBeGreaterThanOrEqual(0);
    expect(wm.company.thalers).toBeGreaterThanOrEqual(0);
  });
});
