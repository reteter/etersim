import { describe, expect, it } from "vitest";
import { applyCommand } from "./commands";
import { DOCKING_FEE } from "./region";
import { effectiveBase, maxAffordableQty, quoteBuy } from "./market";
import { shortestCourse } from "./pathfinding";
import type { Route } from "./route";
import type { Ship } from "./ship";
import { tick } from "./tick";
import { createWorld, type World } from "./world";

const shipOf = (w: World): Ship => w.company.ships[0];
const portOf = (w: World, id: string) => w.region.ports.find((p) => p.id === id)!;
const dockedAt = (w: World): string => {
  const loc = shipOf(w).location;
  if (loc.kind !== "docked") throw new Error("ship underway");
  return loc.portId;
};

/** Put ship s0 docked at `portId` with `thalers` in the purse, empty cargo,
 *  no assignment — the clean slate every scenario starts from. */
function seed(seedStr: string, portId: string, thalers: number, routes: Route[] = []): World {
  const w = createWorld(seedStr);
  const ship: Ship = {
    ...shipOf(w),
    cargo: shipOf(w).cargo,
    location: { kind: "docked", portId },
    assignment: undefined,
  };
  return {
    ...w,
    company: { ...w.company, thalers, ships: [ship], routes },
  };
}

/** A pair of directly-connected ports (a single-voyage lane). */
function directPair(w: World): { a: string; b: string; ticks: number } {
  const lane = w.region.lanes[0];
  return { a: lane.a, b: lane.b, ticks: lane.voyageTicks };
}

/** Sail a docked ship to `to` and tick until it docks; returns the world the
 *  moment it arrives. */
function sailAndArrive(w: World, to: string): World {
  const shipId = shipOf(w).id;
  let next = tick(w, [{ kind: "sailTo", shipId, portId: to }]);
  let guard = 0;
  while (shipOf(next).location.kind !== "docked" && guard++ < 500) next = tick(next, []);
  return next;
}

describe("docking fee (#80)", () => {
  it("charges exactly DOCKING_FEE[archetype] on the arrival tick, and nothing before", () => {
    const w = seed("fee", directPair(createWorld("fee")).a, 500);
    const { a, b } = directPair(w);
    const shipId = shipOf(w).id;
    const fee = DOCKING_FEE[portOf(w, b).archetype];

    let next = tick(w, [{ kind: "sailTo", shipId, portId: b }]);
    // Underway ticks charge no fee.
    while (shipOf(next).location.kind !== "docked") {
      expect(next.company.thalers).toBe(500);
      next = tick(next, []);
    }
    expect(dockedAt(next)).toBe(b);
    expect(next.company.thalers).toBe(500 - fee);
    void a;

    // Exactly one dockingFee event, tagged with the arriving ship and port.
    const feeEvents = next.ledger.filter((e) => e.kind === "dockingFee");
    expect(feeEvents.length).toBe(1);
    expect(feeEvents[0]).toMatchObject({ kind: "dockingFee", shipId, portId: b, thalers: fee });
  });

  it("never drives the purse negative — an empty purse pays what it has", () => {
    const { a, b } = directPair(createWorld("broke"));
    const fee = DOCKING_FEE[portOf(createWorld("broke"), b).archetype];
    const w = seed("broke", a, Math.max(0, fee - 1)); // cannot cover the fee
    const arrived = sailAndArrive(w, b);
    expect(arrived.company.thalers).toBe(0);
  });

  it("charges no fee for a port passed through without docking", () => {
    // Find a 2-hop shortest course A -> ... -> C; the intermediate port is not docked.
    const w0 = createWorld("passthrough");
    let src = "";
    let dst = "";
    for (const from of w0.region.ports) {
      for (const to of w0.region.ports) {
        if (from.id === to.id) continue;
        const course = shortestCourse(w0.region, from.id, to.id);
        if (course && course.length >= 2) {
          src = from.id;
          dst = to.id;
          break;
        }
      }
      if (src) break;
    }
    expect(src).not.toBe(""); // topology sanity
    const w = seed("passthrough", src, 500);
    const arrived = sailAndArrive(w, dst);
    // Exactly one docking (the destination): one fee, intermediate ports free.
    expect(arrived.company.thalers).toBe(500 - DOCKING_FEE[portOf(w, dst).archetype]);
  });
});

describe("routed buy — no free goods, equivalence by construction (#80)", () => {
  it("spends exactly the quote for the max affordable Hold, purse never negative", () => {
    const { a, b } = directPair(createWorld("eq"));
    const route: Route = {
      id: "r",
      name: "loop",
      stops: [
        { portId: a, orders: [{ kind: "buy", good: "grain" }] },
        { portId: b, orders: [{ kind: "sell", good: "grain" }] },
      ],
    };
    // Purse deliberately too small for a full Hold, so the buy is purse-bounded.
    const start = seed("eq", a, 120, [route]);
    const shipId = shipOf(start).id;
    const portA = portOf(start, a);
    const q = maxAffordableQty(portA.market.grain, effectiveBase(portA, "grain"), 50, 120);
    expect(q).toBeGreaterThan(0);
    expect(q).toBeLessThan(50); // genuinely purse-limited
    const cost = quoteBuy(portA.market.grain, effectiveBase(portA, "grain"), q)!;

    const after = tick(start, [{ kind: "assignRoute", shipId, routeId: "r" }]);
    // No transition this tick (started docked at Stop 0) => no fee; buy only.
    expect(after.company.ships[0].cargo.grain).toBe(q);
    expect(after.company.thalers).toBe(120 - cost);
    expect(after.company.thalers).toBeGreaterThanOrEqual(0);

    // The route-driven buy is tagged with the originating Route (the
    // keystone: per-route economics fall out of a filter on this field).
    const tradeEvents = after.ledger.filter((e) => e.kind === "trade");
    expect(tradeEvents.length).toBe(1);
    expect(tradeEvents[0]).toMatchObject({ side: "buy", good: "grain", qty: q, routeId: "r" });
  });

  it("produces the same purse/stock/cargo as the identical manual buy command", () => {
    const { a, b } = directPair(createWorld("eq2"));
    const route: Route = {
      id: "r",
      name: "loop",
      stops: [
        { portId: a, orders: [{ kind: "buy", good: "grain" }] },
        { portId: b, orders: [{ kind: "sell", good: "grain" }] },
      ],
    };
    const start = seed("eq2", a, 120, [route]);
    const shipId = shipOf(start).id;
    const portA = portOf(start, a);
    const q = maxAffordableQty(portA.market.grain, effectiveBase(portA, "grain"), 50, 120);

    const routed = tick(start, [{ kind: "assignRoute", shipId, routeId: "r" }]);
    const manual = tick(seed("eq2", a, 120), [{ kind: "buy", shipId, good: "grain", qty: q }]);

    expect(routed.company.thalers).toBe(manual.company.thalers);
    expect(routed.company.ships[0].cargo.grain).toBe(manual.company.ships[0].cargo.grain);
    // The only Ledger difference between the two: the routed trade carries
    // routeId, the manual one does not (equivalence by construction, tagged).
    const routedTrade = routed.ledger.find((e) => e.kind === "trade");
    const manualTrade = manual.ledger.find((e) => e.kind === "trade");
    expect(routedTrade).toMatchObject({ routeId: "r" });
    expect(manualTrade && "routeId" in manualTrade ? manualTrade.routeId : undefined).toBeUndefined();
    // Port A market identical: both bought q at A before the market tick.
    expect(portOf(routed, a).market.grain.stock).toBe(portOf(manual, a).market.grain.stock);
  });
});

describe("route assignment & loop execution (#80)", () => {
  const setup = (seedStr: string, purse = 500) => {
    const { a, b } = directPair(createWorld(seedStr));
    const route: Route = {
      id: "loop",
      name: "A<->B",
      stops: [
        { portId: a, orders: [{ kind: "buy", good: "grain" }] },
        { portId: b, orders: [{ kind: "sell", good: "grain" }] },
      ],
    };
    return { a, b, route, world: seed(seedStr, a, purse, [route]) };
  };

  it("assign executes Stop 0, dwells one tick, then departs and loops", () => {
    const { a, b, world } = setup("assign");
    const shipId = shipOf(world).id;
    // Assign while docked at Stop 0 (A): buys at A this tick, then dwells docked
    // (a routed ship never departs the tick it acts — the intervention window).
    let w = tick(world, [{ kind: "assignRoute", shipId, routeId: "loop" }]);
    expect(shipOf(w).cargo.grain).toBeGreaterThan(0);
    expect(shipOf(w).location).toEqual({ kind: "docked", portId: a });
    expect(shipOf(w).assignment).toEqual({ routeId: "loop", nextStopIndex: 1, suspended: false });

    // Next tick it redirects toward Stop 1 (B).
    w = tick(w, []);
    expect(shipOf(w).location.kind).toBe("underway");

    // Reach B, sell everything, advance to Stop 0, dwell docked at B.
    let guard = 0;
    while (!(shipOf(w).location.kind === "docked" && dockedAt(w) === b) && guard++ < 500) w = tick(w, []);
    expect(shipOf(w).cargo.grain).toBe(0);
    expect(shipOf(w).assignment!.nextStopIndex).toBe(0);
  });

  it("is deterministic over a multi-loop run", () => {
    const run = () => {
      const { world } = setup("det");
      const shipId = shipOf(world).id;
      let w = tick(world, [{ kind: "assignRoute", shipId, routeId: "loop" }]);
      for (let t = 0; t < 800; t++) w = tick(w, []);
      return w;
    };
    expect(run()).toEqual(run());
  });
});

describe("suspend & resume (#80)", () => {
  it("a manual sailTo suspends the Route but keeps it assigned", () => {
    const { a, b } = directPair(createWorld("susp"));
    const route: Route = {
      id: "loop",
      name: "r",
      stops: [
        { portId: a, orders: [{ kind: "buy", good: "grain" }] },
        { portId: b, orders: [{ kind: "sell", good: "grain" }] },
      ],
    };
    const world = seed("susp", a, 500, [route]);
    const shipId = shipOf(world).id;
    let w = tick(world, [{ kind: "assignRoute", shipId, routeId: "loop" }]);
    // While underway to B, a manual sailTo back to A suspends (only lands once docked).
    let guard = 0;
    while (!(shipOf(w).location.kind === "docked" && dockedAt(w) === b) && guard++ < 500) w = tick(w, []);
    // Now underway toward A on the route; force it to dock at A by waiting, then intervene.
    guard = 0;
    while (!(shipOf(w).location.kind === "docked") && guard++ < 500) w = tick(w, []);
    const here = dockedAt(w);
    const elsewhere = w.region.ports.find((p) => p.id !== here)!.id;
    w = tick(w, [{ kind: "sailTo", shipId, portId: elsewhere }]);
    expect(shipOf(w).assignment!.suspended).toBe(true);
    expect(shipOf(w).assignment!.routeId).toBe("loop");
  });

  it("resume targets the next Stop in order, never the nearest", () => {
    // Route across 3 stops; suspend at a known index, resume, assert the dispatch
    // destination is stops[nextStopIndex], not whichever is closest.
    const w0 = createWorld("resume");
    const ports = w0.region.ports.slice(0, 3).map((p) => p.id);
    const route: Route = {
      id: "tri",
      name: "tri",
      stops: [
        { portId: ports[0], orders: [] },
        { portId: ports[1], orders: [] },
        { portId: ports[2], orders: [] },
      ],
    };
    // Ship docked at ports[0], assignment pointing at Stop 2, suspended.
    const base = seed("resume", ports[0], 500, [route]);
    const suspended: Ship = {
      ...shipOf(base),
      assignment: { routeId: "tri", nextStopIndex: 2, suspended: true },
    };
    const world = { ...base, company: { ...base.company, ships: [suspended] } };
    const shipId = shipOf(world).id;

    // Resume clears the suspend flag; the same tick's route pass redirects to
    // Stop 2's port — the next Stop in order, not the geographically nearest.
    const resumed = tick(world, [{ kind: "resumeRoute", shipId }]);
    const loc = shipOf(resumed).location;
    expect(loc.kind).toBe("underway");
    if (loc.kind === "underway") expect(loc.destination).toBe(ports[2]);
    expect(shipOf(resumed).assignment).toEqual({ routeId: "tri", nextStopIndex: 2, suspended: false });
  });
});

describe("deterministic edge semantics (#80)", () => {
  it("rejects an all-same-port Route (< 2 distinct ports)", () => {
    const w = createWorld("valid");
    const p = w.region.ports[0].id;
    const bad: Route = {
      id: "x",
      name: "x",
      stops: [
        { portId: p, orders: [] },
        { portId: p, orders: [] },
      ],
    };
    expect(applyCommand(w, { kind: "createRoute", route: bad }).company.routes).toHaveLength(0);
  });

  it("a stale next-Stop index left out of range by a shortening edit wraps to Stop 0", () => {
    const w0 = createWorld("wrap");
    const ports = w0.region.ports.slice(0, 3).map((p) => p.id);
    const route: Route = {
      id: "r",
      name: "r",
      stops: ports.map((portId) => ({ portId, orders: [] as const })),
    };
    const base = seed("wrap", ports[0], 500, [route]);
    // Ship pointing at Stop 2, then the route is shortened to 2 stops.
    const ship: Ship = { ...shipOf(base), assignment: { routeId: "r", nextStopIndex: 2, suspended: false } };
    const shorter: Route = { ...route, stops: [{ portId: ports[0], orders: [] }, { portId: ports[1], orders: [] }] };
    const world = {
      ...base,
      company: { ...base.company, ships: [ship], routes: [shorter] },
    };
    const shipId = shipOf(world).id;
    // Resume re-normalizes the index (2 -> 0) and dispatches to Stop 0's port.
    const resumed = applyCommand(world, { kind: "resumeRoute", shipId });
    expect(shipOf(resumed).assignment!.nextStopIndex).toBe(0);
  });

  it("redirects (no trade) when a template edit moves the Stop out from under an in-flight ship", () => {
    const { a, b } = directPair(createWorld("redir"));
    const c = createWorld("redir").region.ports.find((p) => p.id !== a && p.id !== b)?.id ?? b;
    const route: Route = {
      id: "r",
      name: "r",
      stops: [
        { portId: a, orders: [{ kind: "buy", good: "grain" }] },
        { portId: b, orders: [{ kind: "sell", good: "grain" }] },
      ],
    };
    expect(c).not.toBe(b); // topology sanity: a genuine third port exists
    const world = seed("redir", a, 500, [route]);
    const shipId = shipOf(world).id;
    let w = tick(world, [{ kind: "assignRoute", shipId, routeId: "r" }]); // buys at A, dwells
    const boughtGrain = shipOf(w).cargo.grain;
    expect(boughtGrain).toBeGreaterThan(0);
    w = tick(w, []); // redirect: now genuinely in flight toward B (Stop 1)
    expect(shipOf(w).location.kind).toBe("underway");
    // In-flight, move Stop 1 from B to C.
    const edited: Route = { ...route, stops: [route.stops[0], { portId: c, orders: [{ kind: "sell", good: "grain" }] }] };
    w = tick(w, [{ kind: "updateRoute", route: edited }]);
    // The ship reaches B (the old dest) but Stop 1 is now C: it redirects there
    // rather than trading — destination flips to C with the cargo still aboard.
    let guard = 0;
    while (
      !(shipOf(w).location.kind === "underway" &&
        (shipOf(w).location as { destination: string }).destination === c) &&
      guard++ < 500
    ) {
      w = tick(w, []);
    }
    expect(shipOf(w).cargo.grain).toBe(boughtGrain); // no wrong-port sell at B — redirected onward
    // And it does sell once it reaches the moved Stop at C.
    guard = 0;
    while (!(shipOf(w).location.kind === "docked" && dockedAt(w) === c) && guard++ < 500) w = tick(w, []);
    expect(shipOf(w).cargo.grain).toBe(0);
  });

  it("clears the assignment once a ship on a deleted Route finishes its Course", () => {
    const { a, b } = directPair(createWorld("del"));
    const route: Route = {
      id: "r",
      name: "r",
      stops: [
        { portId: a, orders: [] },
        { portId: b, orders: [] },
      ],
    };
    const world = seed("del", a, 500, [route]);
    const shipId = shipOf(world).id;
    let w = tick(world, [{ kind: "assignRoute", shipId, routeId: "r" }]); // execute Stop 0, dwell at A
    w = tick(w, []); // depart toward B
    expect(shipOf(w).location.kind).toBe("underway");
    w = tick(w, [{ kind: "deleteRoute", routeId: "r" }]); // delete mid-Course
    expect(shipOf(w).assignment).toBeDefined(); // still assigned while in flight
    let guard = 0;
    while (!(shipOf(w).location.kind === "docked" && dockedAt(w) === b) && guard++ < 500) w = tick(w, []);
    // Docked at B after the Course completed → assignment cleared (routeless, not stranded).
    expect(shipOf(w).assignment).toBeUndefined();
  });
});

describe("[A,B,A] co-located drain (#80)", () => {
  it("drains both same-port Stops across successive dwell ticks, then sails on", () => {
    const { a, b } = directPair(createWorld("aba"));
    // Stops: 0 buy grain @A, 1 sell grain @B, 2 buy textiles @A. The wrap visit to
    // A drains Stop 2 then Stop 0 (both at A), one per dwell tick, before B.
    const route: Route = {
      id: "aba",
      name: "aba",
      stops: [
        { portId: a, orders: [{ kind: "buy", good: "grain" }] },
        { portId: b, orders: [{ kind: "sell", good: "grain" }] },
        { portId: a, orders: [{ kind: "buy", good: "textiles" }] },
      ],
    };
    const world = seed("aba", a, 500, [route]);
    const shipId = shipOf(world).id;
    let w = tick(world, [{ kind: "assignRoute", shipId, routeId: "aba" }]); // Stop 0 buy grain @A, dwell
    expect(shipOf(w).assignment!.nextStopIndex).toBe(1);
    // Reach B, sell grain, advance to Stop 2.
    let guard = 0;
    while (!(shipOf(w).location.kind === "docked" && dockedAt(w) === b) && guard++ < 500) w = tick(w, []);
    expect(shipOf(w).assignment!.nextStopIndex).toBe(2);
    // Reach A: this docking executes Stop 2 (buy textiles), advances to Stop 0, dwells.
    guard = 0;
    while (!(shipOf(w).location.kind === "docked" && dockedAt(w) === a) && guard++ < 500) w = tick(w, []);
    expect(shipOf(w).cargo.textiles).toBeGreaterThan(0); // Stop 2 executed
    expect(shipOf(w).cargo.grain).toBe(0); // Stop 0 not yet — it drains next dwell tick
    expect(shipOf(w).assignment!.nextStopIndex).toBe(0);
    // Next dwell tick at A drains Stop 0 (buy grain), advances to Stop 1.
    w = tick(w, []);
    expect(shipOf(w).cargo.grain).toBeGreaterThan(0); // Stop 0 executed at the same port
    expect(shipOf(w).assignment!.nextStopIndex).toBe(1);
    expect(dockedAt(w)).toBe(a); // still dwelling at A
    // Following tick departs for B (Stop 1, a different port).
    w = tick(w, []);
    expect(shipOf(w).location.kind).toBe("underway");
  });
});

describe("assign while underway (#80)", () => {
  it("takes effect only once the ship docks, then redirects to Stop 0", () => {
    const { a, b } = directPair(createWorld("underway"));
    const route: Route = {
      id: "r",
      name: "r",
      stops: [
        { portId: a, orders: [] },
        { portId: b, orders: [] },
      ],
    };
    // Ship starts at B, manually sailing to A; assign the A-first route mid-flight.
    const world = seed("underway", b, 500, [route]);
    const shipId = shipOf(world).id;
    let w = tick(world, [{ kind: "sailTo", shipId, portId: a }]);
    expect(shipOf(w).location.kind).toBe("underway");
    w = tick(w, [{ kind: "assignRoute", shipId, routeId: "r" }]);
    // Still underway to A; the assignment is set but dormant until it docks.
    expect(shipOf(w).assignment).toEqual({ routeId: "r", nextStopIndex: 0, suspended: false });
    let guard = 0;
    while (!(shipOf(w).location.kind === "docked" && dockedAt(w) === a) && guard++ < 500) w = tick(w, []);
    // Docked at A (= Stop 0): executes Stop 0 and dwells, advancing to Stop 1.
    expect(shipOf(w).assignment!.nextStopIndex).toBe(1);
  });
});

describe("shared-purse race in ships[] order (#80)", () => {
  it("two ships assigned the same tick contend deterministically, first ship first", () => {
    const { a, b } = directPair(createWorld("race"));
    const route: Route = {
      id: "r",
      name: "r",
      stops: [
        { portId: a, orders: [{ kind: "buy", good: "grain" }] },
        { portId: b, orders: [{ kind: "sell", good: "grain" }] },
      ],
    };
    const base = createWorld("race");
    const s0: Ship = { ...base.company.ships[0], id: "s0", name: "s0", location: { kind: "docked", portId: a } };
    const s1: Ship = { ...base.company.ships[0], id: "s1", name: "s1", location: { kind: "docked", portId: a } };
    // Purse small enough that the two ships genuinely compete for it.
    const world: World = { ...base, company: { ...base.company, thalers: 160, ships: [s0, s1], routes: [route] } };

    const run = (w: World) =>
      tick(w, [
        { kind: "assignRoute", shipId: "s0", routeId: "r" },
        { kind: "assignRoute", shipId: "s1", routeId: "r" },
      ]);
    const after = run(world);

    const g0 = after.company.ships[0].cargo.grain;
    const g1 = after.company.ships[1].cargo.grain;
    expect(g0 + g1).toBeGreaterThan(0);
    expect(g0).toBeGreaterThanOrEqual(g1); // s0 races first for the shared purse
    expect(after.company.thalers).toBeGreaterThanOrEqual(0);
    expect(run(world)).toEqual(after); // deterministic
  });
});

describe("combined determinism — routes + HQ + build (#80/#81)", () => {
  it("same seed + same scripted commands ⇒ deep-equal world after several days", () => {
    const TICKS = 120;
    const script = (): World => {
      const base = createWorld("combined");
      const { a, b } = directPair(base);
      const shipId = base.company.ships[0].id;
      const route: Route = {
        id: "r",
        name: "r",
        stops: [
          { portId: a, orders: [{ kind: "buy", good: "grain" }] },
          { portId: b, orders: [{ kind: "sell", good: "grain" }] },
        ],
      };
      // Fund the company so founding + a build are reachable.
      let w: World = { ...base, company: { ...base.company, thalers: 20000, routes: [route] } };
      const homeId = dockedAt(w);
      w = tick(w, [
        { kind: "foundHeadquarters", portId: homeId },
        { kind: "assignRoute", shipId, routeId: "r" },
      ]);
      w = tick(w, [{ kind: "placeBuildOrder" }]);
      for (let t = 0; t < TICKS; t++) {
        w = tick(w, t === 40 ? [{ kind: "rushBuild" }] : []);
      }
      return w;
    };
    const a = script();
    const b = script();
    expect(a).toEqual(b);
    expect(JSON.parse(JSON.stringify(a))).toEqual(a); // save round-trip clean (ADR-0004)
    // Byte-equal Ledger across the whole mixed scenario (routes, HQ, rush).
    expect(JSON.stringify(a.ledger)).toBe(JSON.stringify(b.ledger));
    // Sanity: every event kind this scenario exercises actually fired.
    const kinds = new Set(a.ledger.map((e) => e.kind));
    for (const kind of ["trade", "dockingFee", "founding", "rush"] as const) {
      expect(kinds.has(kind)).toBe(true);
    }
  });
});
