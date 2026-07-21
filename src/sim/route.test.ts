import { describe, expect, it } from "vitest";
import { applyCommand } from "./commands";
import { amountOf } from "./goodsStore";
import { DOCKING_FEE } from "./region";
import { effectiveBase, maxAffordableQty, quoteBuy, quoteSell, unitMargin } from "./market";
import { shortestCourse } from "./pathfinding";
import { resolveReferencePort, type Route } from "./route";
import type { Ship } from "./ship";
import { tick } from "./tick";
import { createWorld, STARTING_HOLD, type World } from "./world";

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
    // Full object (not toMatchObject): the fee itself is exactly the field a
    // pricing bug would corrupt, so every field is pinned, including tick —
    // the docking transition landed on the tick just before `next`.
    const feeEvents = next.ledger.filter((e) => e.kind === "dockingFee");
    expect(feeEvents.length).toBe(1);
    expect(feeEvents[0]).toEqual({
      kind: "dockingFee",
      tick: next.tick - 1,
      shipId,
      portId: b,
      thalers: fee,
    });
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
    expect(amountOf(after.company.ships[0].cargo, "grain")).toBe(q);
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
    expect(amountOf(routed.company.ships[0].cargo, "grain")).toBe(amountOf(manual.company.ships[0].cargo, "grain"));
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
    expect(amountOf(shipOf(w).cargo, "grain")).toBeGreaterThan(0);
    expect(shipOf(w).location).toEqual({ kind: "docked", portId: a });
    expect(shipOf(w).assignment).toEqual({ routeId: "loop", nextStopIndex: 1, suspended: false });

    // Next tick it redirects toward Stop 1 (B).
    w = tick(w, []);
    expect(shipOf(w).location.kind).toBe("underway");

    // Reach B, sell everything, advance to Stop 0, dwell docked at B.
    let guard = 0;
    while (!(shipOf(w).location.kind === "docked" && dockedAt(w) === b) && guard++ < 500) w = tick(w, []);
    expect(amountOf(shipOf(w).cargo, "grain")).toBe(0);
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
    const boughtGrain = amountOf(shipOf(w).cargo, "grain");
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
    expect(amountOf(shipOf(w).cargo, "grain")).toBe(boughtGrain); // no wrong-port sell at B — redirected onward
    // And it does sell once it reaches the moved Stop at C.
    guard = 0;
    while (!(shipOf(w).location.kind === "docked" && dockedAt(w) === c) && guard++ < 500) w = tick(w, []);
    expect(amountOf(shipOf(w).cargo, "grain")).toBe(0);
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
    expect(amountOf(shipOf(w).cargo, "textiles")).toBeGreaterThan(0); // Stop 2 executed
    expect(amountOf(shipOf(w).cargo, "grain")).toBe(0); // Stop 0 not yet — it drains next dwell tick
    expect(shipOf(w).assignment!.nextStopIndex).toBe(0);
    // Next dwell tick at A drains Stop 0 (buy grain), advances to Stop 1.
    w = tick(w, []);
    expect(amountOf(shipOf(w).cargo, "grain")).toBeGreaterThan(0); // Stop 0 executed at the same port
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

    const g0 = amountOf(after.company.ships[0].cargo, "grain");
    const g1 = amountOf(after.company.ships[1].cargo, "grain");
    expect(g0 + g1).toBeGreaterThan(0);
    expect(g0).toBeGreaterThanOrEqual(g1); // s0 races first for the shared purse
    expect(after.company.thalers).toBeGreaterThanOrEqual(0);
    expect(run(world)).toEqual(after); // deterministic
  });
});

describe("resolveReferencePort (E9.1, pure — no World/market)", () => {
  const stop = (portId: string, orders: Route["stops"][number]["orders"]) => ({ portId, orders });

  it("finds the next sell-stop for the good, scanning forward from the current index", () => {
    const route: Route = {
      id: "r",
      name: "r",
      stops: [
        stop("a", [{ kind: "buy", good: "grain" }]),
        stop("b", [{ kind: "sell", good: "grain" }]),
        stop("c", [{ kind: "sell", good: "textiles" }]),
      ],
    };
    expect(resolveReferencePort(route, 0, "grain")).toBe("b");
  });

  it("wraps the loop: a sell-stop 'before' the current index in the array is still found", () => {
    const route: Route = {
      id: "r",
      name: "r",
      stops: [
        stop("a", [{ kind: "sell", good: "grain" }]),
        stop("b", []),
        stop("c", [{ kind: "buy", good: "grain" }]),
      ],
    };
    // Current index 2 (buy @c); scanning forward wraps to index 0 (sell @a).
    expect(resolveReferencePort(route, 2, "grain")).toBe("a");
  });

  it("skips the current Stop structurally (offset starts at 1) — a sell at the current index never counts", () => {
    const route: Route = {
      id: "r",
      name: "r",
      stops: [
        stop("a", [{ kind: "sell", good: "grain" }, { kind: "buy", good: "grain" }]),
        stop("b", []),
        stop("c", []),
      ],
    };
    // The only sell of grain on the whole route sits at the current index —
    // skipped structurally, so no *other* Stop satisfies the reference.
    expect(resolveReferencePort(route, 0, "grain")).toBeNull();
  });

  it("deliver is never a reference — a deliver-only Stop for the good does not satisfy the gate", () => {
    const route: Route = {
      id: "r",
      name: "r",
      stops: [
        stop("a", [{ kind: "buy", good: "grain" }]),
        stop("b", [{ kind: "deliver", good: "grain" }]),
      ],
    };
    expect(resolveReferencePort(route, 0, "grain")).toBeNull();
  });

  it("returns null (inactive gate) when no sell-stop for the good exists anywhere on the route", () => {
    const route: Route = {
      id: "r",
      name: "r",
      stops: [
        stop("a", [{ kind: "buy", good: "grain" }]),
        stop("b", [{ kind: "sell", good: "textiles" }]),
      ],
    };
    expect(resolveReferencePort(route, 0, "grain")).toBeNull();
  });
});

describe("unitMargin (E9.1 — sole site margin is computed, same pricing fns as the Commands)", () => {
  it("equals quoteSell(reference, 1) - quoteBuy(here, 1) — the exact per-unit Command math", () => {
    const w = createWorld("margin-fn");
    const a = w.region.ports[0];
    const b = w.region.ports[1];
    const margin = unitMargin(
      a.market.grain,
      effectiveBase(a, "grain"),
      b.market.grain,
      effectiveBase(b, "grain"),
    );
    const expected =
      quoteSell(b.market.grain, effectiveBase(b, "grain"), 1)! -
      quoteBuy(a.market.grain, effectiveBase(a, "grain"), 1)!;
    expect(margin).toBe(expected);
  });

  it("is null when the local buy side has zero stock (unevaluable, not infinite margin)", () => {
    const w = createWorld("margin-null");
    const a = w.region.ports[0];
    const b = w.region.ports[1];
    const dryEntry = { ...a.market.grain, stock: 0 };
    expect(unitMargin(dryEntry, effectiveBase(a, "grain"), b.market.grain, effectiveBase(b, "grain"))).toBeNull();
  });
});

describe("isValidRoute rejections (E9.1 qty + Margin Gate)", () => {
  const { a, b } = directPair(createWorld("valid-e91"));

  it("rejects qty on a deliver order", () => {
    const route: Route = {
      id: "x",
      name: "x",
      stops: [
        { portId: a, orders: [{ kind: "deliver", good: "grain", qty: 5 }] },
        { portId: b, orders: [] },
      ],
    };
    expect(applyCommand(createWorld("valid-e91"), { kind: "createRoute", route }).company.routes).toHaveLength(0);
  });

  it("rejects qty on a store order (E13, #100 — same no-qty precedent as deliver)", () => {
    const route: Route = {
      id: "x",
      name: "x",
      stops: [
        { portId: a, orders: [{ kind: "store", good: "grain", qty: 5 }] },
        { portId: b, orders: [] },
      ],
    };
    expect(applyCommand(createWorld("valid-e91"), { kind: "createRoute", route }).company.routes).toHaveLength(0);
  });

  it("rejects qty on a withdraw order", () => {
    const route: Route = {
      id: "x",
      name: "x",
      stops: [
        { portId: a, orders: [{ kind: "withdraw", good: "grain", qty: 5 }] },
        { portId: b, orders: [] },
      ],
    };
    expect(applyCommand(createWorld("valid-e91"), { kind: "createRoute", route }).company.routes).toHaveLength(0);
  });

  it("rejects qty <= 0", () => {
    const route: Route = {
      id: "x",
      name: "x",
      stops: [
        { portId: a, orders: [{ kind: "buy", good: "grain", qty: 0 }] },
        { portId: b, orders: [] },
      ],
    };
    expect(applyCommand(createWorld("valid-e91"), { kind: "createRoute", route }).company.routes).toHaveLength(0);
  });

  it("rejects a non-integer qty", () => {
    const route: Route = {
      id: "x",
      name: "x",
      stops: [
        { portId: a, orders: [{ kind: "sell", good: "grain", qty: 2.5 }] },
        { portId: b, orders: [] },
      ],
    };
    expect(applyCommand(createWorld("valid-e91"), { kind: "createRoute", route }).company.routes).toHaveLength(0);
  });

  it("rejects minMargin on a sell order", () => {
    const route: Route = {
      id: "x",
      name: "x",
      stops: [
        { portId: a, orders: [{ kind: "sell", good: "grain", minMargin: 5 }] },
        { portId: b, orders: [] },
      ],
    };
    expect(applyCommand(createWorld("valid-e91"), { kind: "createRoute", route }).company.routes).toHaveLength(0);
  });

  it("rejects minMargin on a deliver order", () => {
    const route: Route = {
      id: "x",
      name: "x",
      stops: [
        { portId: a, orders: [{ kind: "deliver", good: "grain", minMargin: 5 }] },
        { portId: b, orders: [] },
      ],
    };
    expect(applyCommand(createWorld("valid-e91"), { kind: "createRoute", route }).company.routes).toHaveLength(0);
  });

  it("accepts minMargin on a buy order", () => {
    const route: Route = {
      id: "x",
      name: "x",
      stops: [
        { portId: a, orders: [{ kind: "buy", good: "grain", minMargin: 5 }] },
        { portId: b, orders: [{ kind: "sell", good: "grain" }] },
      ],
    };
    expect(applyCommand(createWorld("valid-e91"), { kind: "createRoute", route }).company.routes).toHaveLength(1);
  });
});

describe("route Stop qty — 'up to N' (#261)", () => {
  it("qty absent ⇒ byte-identical to today: cargo exactly maxAffordableQty(entry, base, holdSpace, purse)", () => {
    const { a, b } = directPair(createWorld("qty-absent"));
    const route: Route = {
      id: "r",
      name: "r",
      stops: [
        { portId: a, orders: [{ kind: "buy", good: "grain" }] },
        { portId: b, orders: [{ kind: "sell", good: "grain" }] },
      ],
    };
    const world = seed("qty-absent", a, 120, [route]);
    const shipId = shipOf(world).id;
    const portA = portOf(world, a);
    const expectedQty = maxAffordableQty(portA.market.grain, effectiveBase(portA, "grain"), STARTING_HOLD, 120);

    const after = tick(world, [{ kind: "assignRoute", shipId, routeId: "r" }]);
    expect(amountOf(shipOf(after).cargo, "grain")).toBe(expectedQty);
  });

  it("qty absent ⇒ byte-identical to today, over a scripted multi-loop run: the ENTIRE World is pinned, not one field (a literal pre-#261 diff isn't possible in one tree — a full-world assertion over the ungated run is the achievable form)", () => {
    const run = (): World => {
      const { a, b } = directPair(createWorld("qty-absent-full"));
      const route: Route = {
        id: "r",
        name: "r",
        stops: [
          { portId: a, orders: [{ kind: "buy", good: "grain" }] },
          { portId: b, orders: [{ kind: "sell", good: "grain" }] },
        ],
      };
      const world = seed("qty-absent-full", a, 5000, [route]);
      const shipId = shipOf(world).id;
      let w = tick(world, [{ kind: "assignRoute", shipId, routeId: "r" }]);
      for (let t = 0; t < 300; t++) w = tick(w, []); // several full A<->B loop iterations
      return w;
    };
    const w1 = run();
    const w2 = run();
    // Full-World determinism, not a plucked field — the strongest pin
    // achievable without a prior-tree diff (same technique as the existing
    // "is deterministic over a multi-loop run" / "combined determinism"
    // tests in this suite, applied specifically to the qty-absent path).
    expect(w1).toEqual(w2);
    expect(JSON.parse(JSON.stringify(w1))).toEqual(w1); // ADR-0004 round-trip
    // Sanity: the scenario actually exercised buy + sell + several loops, not a no-op.
    expect(w1.tick).toBe(301);
    expect(w1.ledger.filter((e) => e.kind === "trade").length).toBeGreaterThan(2);
  });

  it("buy qty below Hold & affordability: clips to N, not the greedy fill", () => {
    const { a, b } = directPair(createWorld("qty-below"));
    const route: Route = {
      id: "r",
      name: "r",
      stops: [
        { portId: a, orders: [{ kind: "buy", good: "grain", qty: 3 }] },
        { portId: b, orders: [{ kind: "sell", good: "grain" }] },
      ],
    };
    const world = seed("qty-below", a, 5000, [route]);
    const shipId = shipOf(world).id;
    const after = tick(world, [{ kind: "assignRoute", shipId, routeId: "r" }]);
    expect(amountOf(shipOf(after).cargo, "grain")).toBe(3);
  });

  it("buy qty exactly at Hold space: clips to Hold, same as greedy (qty === holdSpace)", () => {
    const { a, b } = directPair(createWorld("qty-at-hold"));
    const route: Route = {
      id: "r",
      name: "r",
      stops: [
        { portId: a, orders: [{ kind: "buy", good: "grain", qty: STARTING_HOLD }] },
        { portId: b, orders: [{ kind: "sell", good: "grain" }] },
      ],
    };
    const world = seed("qty-at-hold", a, 100_000, [route]);
    const shipId = shipOf(world).id;
    const portA = portOf(world, a);
    const expectedQty = maxAffordableQty(
      portA.market.grain,
      effectiveBase(portA, "grain"),
      STARTING_HOLD,
      100_000,
    );
    const after = tick(world, [{ kind: "assignRoute", shipId, routeId: "r" }]);
    expect(amountOf(shipOf(after).cargo, "grain")).toBe(expectedQty);
  });

  it("buy qty above Hold space: still clipped to Hold, N is only a ceiling", () => {
    const { a, b } = directPair(createWorld("qty-above-hold"));
    const route: Route = {
      id: "r",
      name: "r",
      stops: [
        { portId: a, orders: [{ kind: "buy", good: "grain", qty: STARTING_HOLD * 10 }] },
        { portId: b, orders: [{ kind: "sell", good: "grain" }] },
      ],
    };
    const world = seed("qty-above-hold", a, 100_000, [route]);
    const shipId = shipOf(world).id;
    const portA = portOf(world, a);
    const expectedQty = maxAffordableQty(
      portA.market.grain,
      effectiveBase(portA, "grain"),
      STARTING_HOLD,
      100_000,
    );
    const after = tick(world, [{ kind: "assignRoute", shipId, routeId: "r" }]);
    expect(amountOf(shipOf(after).cargo, "grain")).toBe(expectedQty);
    expect(amountOf(shipOf(after).cargo, "grain")).toBeLessThanOrEqual(STARTING_HOLD);
  });

  it("buy qty above what the purse affords: clipped by affordability, not by N", () => {
    const { a, b } = directPair(createWorld("qty-unaffordable"));
    const route: Route = {
      id: "r",
      name: "r",
      stops: [
        { portId: a, orders: [{ kind: "buy", good: "grain", qty: 40 }] },
        { portId: b, orders: [{ kind: "sell", good: "grain" }] },
      ],
    };
    const world = seed("qty-unaffordable", a, 120, [route]);
    const shipId = shipOf(world).id;
    const portA = portOf(world, a);
    const expectedQty = maxAffordableQty(portA.market.grain, effectiveBase(portA, "grain"), 40, 120);
    expect(expectedQty).toBeLessThan(40); // genuinely purse-limited, not N-limited
    const after = tick(world, [{ kind: "assignRoute", shipId, routeId: "r" }]);
    expect(amountOf(shipOf(after).cargo, "grain")).toBe(expectedQty);
  });

  it("sell qty clips to N, carrying the remainder onward (dosing across ports)", () => {
    const { a, b } = directPair(createWorld("sell-qty"));
    const route: Route = {
      id: "r",
      name: "r",
      stops: [
        { portId: a, orders: [{ kind: "buy", good: "grain", qty: 10 }] },
        { portId: b, orders: [{ kind: "sell", good: "grain", qty: 4 }] },
      ],
    };
    const world = seed("sell-qty", a, 5000, [route]);
    const shipId = shipOf(world).id;
    let w = tick(world, [{ kind: "assignRoute", shipId, routeId: "r" }]); // buys 10 @ a, dwells
    expect(amountOf(shipOf(w).cargo, "grain")).toBe(10);
    w = tick(w, []); // departs toward b
    let guard = 0;
    while (!(shipOf(w).location.kind === "docked" && dockedAt(w) === b) && guard++ < 500) w = tick(w, []);
    // Only 4 sold at b; the other 6 remain aboard (carried onward), never force-sold.
    expect(amountOf(shipOf(w).cargo, "grain")).toBe(6);
  });

  it("sell qty above what's on board: sells everything on board, no error, no negative cargo", () => {
    const { a, b } = directPair(createWorld("sell-qty-over"));
    const route: Route = {
      id: "r",
      name: "r",
      stops: [
        { portId: a, orders: [{ kind: "buy", good: "grain", qty: 5 }] },
        { portId: b, orders: [{ kind: "sell", good: "grain", qty: 999 }] },
      ],
    };
    const world = seed("sell-qty-over", a, 5000, [route]);
    const shipId = shipOf(world).id;
    let w = tick(world, [{ kind: "assignRoute", shipId, routeId: "r" }]);
    expect(amountOf(shipOf(w).cargo, "grain")).toBe(5);
    w = tick(w, []);
    let guard = 0;
    while (!(shipOf(w).location.kind === "docked" && dockedAt(w) === b) && guard++ < 500) w = tick(w, []);
    expect(amountOf(shipOf(w).cargo, "grain")).toBe(0);
  });
});

describe("Margin Gate — 'wait until it's worth carrying' (#262)", () => {
  /** Route with a gated buy at Stop 0 (@a) and a sell-stop for the same good
   *  at Stop 1 (@b) — the reference port. A sibling buy (timber, no gate) at
   *  Stop 0 lets the "siblings execute once" regression bite if the
   *  implementation ever re-runs them on a waiting poll. */
  function gatedRoute(a: string, b: string, minMargin: number): Route {
    return {
      id: "gated",
      name: "gated",
      stops: [
        {
          portId: a,
          orders: [
            { kind: "buy", good: "timber" }, // ungated sibling
            { kind: "buy", good: "grain", minMargin },
          ],
        },
        { portId: b, orders: [{ kind: "sell", good: "grain" }] },
      ],
    };
  }

  it("an unmet gate never advances the index and fires no gated buy, but still runs non-gated siblings once", () => {
    const { a, b } = directPair(createWorld("gate-unmet"));
    const route = gatedRoute(a, b, 1_000_000); // impossibly high — never met
    const world = seed("gate-unmet", a, 5000, [route]);
    const shipId = shipOf(world).id;

    let w = tick(world, [{ kind: "assignRoute", shipId, routeId: "gated" }]);
    expect(amountOf(shipOf(w).cargo, "timber")).toBeGreaterThan(0); // sibling ran
    expect(amountOf(shipOf(w).cargo, "grain")).toBe(0); // gated buy withheld
    expect(shipOf(w).assignment).toMatchObject({ nextStopIndex: 0, waiting: true });

    const cargoTimber1 = amountOf(shipOf(w).cargo, "timber");
    const thalers1 = w.company.thalers;

    // Poll several more ticks: still docked, gate still unmet.
    for (let i = 0; i < 5; i++) {
      w = tick(w, []);
      expect(shipOf(w).location).toEqual({ kind: "docked", portId: a });
      expect(shipOf(w).assignment).toMatchObject({ nextStopIndex: 0, waiting: true });
      expect(amountOf(shipOf(w).cargo, "grain")).toBe(0); // still withheld
      // The key regression: siblings must NEVER re-run while waiting.
      expect(amountOf(shipOf(w).cargo, "timber")).toBe(cargoTimber1);
      expect(w.company.thalers).toBe(thalers1);
    }
  });

  it("gate passing fires the gated buy exactly once (up to N, clipped by Hold/Thalers) and advances, clearing waiting", () => {
    const { a, b } = directPair(createWorld("gate-pass"));
    const route = gatedRoute(a, b, 1_000_000); // starts unmet
    const world = seed("gate-pass", a, 5000, [route]);
    const shipId = shipOf(world).id;

    let w = tick(world, [{ kind: "assignRoute", shipId, routeId: "gated" }]);
    expect(shipOf(w).assignment).toMatchObject({ waiting: true });
    expect(amountOf(shipOf(w).cargo, "grain")).toBe(0);

    // Relax the threshold to something guaranteed to already pass, simulating
    // "the market moved" — the gate only cares about a *fresh* evaluation
    // each poll, so an updateRoute is the cheapest deterministic way to flip it.
    const relaxed: Route = {
      ...route,
      stops: [
        {
          portId: a,
          orders: [
            { kind: "buy", good: "timber" },
            { kind: "buy", good: "grain", minMargin: -1_000_000 }, // now trivially met
          ],
        },
        route.stops[1],
      ],
    };
    w = applyCommand(w, { kind: "updateRoute", route: relaxed });

    w = tick(w, []); // waiting poll: gate now passes
    expect(amountOf(shipOf(w).cargo, "grain")).toBeGreaterThan(0); // gated buy fired
    expect(shipOf(w).assignment).toMatchObject({ nextStopIndex: 1 }); // advanced
    expect(shipOf(w).assignment?.waiting).toBeUndefined(); // cleared, not stored false

    // "Fires exactly once": the ship stays docked at `a` this tick (only the
    // index advanced — the dwell mirrors manual play's quantization), then
    // redirects toward Stop 1 (`b`) next tick without touching cargo/thalers
    // again. Charged once, not once per poll.
    const cargoAfterFire = amountOf(shipOf(w).cargo, "grain");
    const thalersAfterFire = w.company.thalers;
    w = tick(w, []); // the following tick: redirect only, no execution
    expect(shipOf(w).location.kind).toBe("underway"); // departed toward b
    expect(amountOf(shipOf(w).cargo, "grain")).toBe(cargoAfterFire); // unchanged — no second buy
    expect(w.company.thalers).toBe(thalersAfterFire); // unchanged — no double-charge
  });

  it("an inactive gate (no sell-stop for the good on the route) executes the buy normally, no waiting", () => {
    const { a, b } = directPair(createWorld("gate-inactive"));
    const route: Route = {
      id: "r",
      name: "r",
      stops: [
        { portId: a, orders: [{ kind: "buy", good: "grain", minMargin: 1_000_000 }] },
        { portId: b, orders: [{ kind: "sell", good: "textiles" }] }, // no sell of grain anywhere
      ],
    };
    const world = seed("gate-inactive", a, 5000, [route]);
    const shipId = shipOf(world).id;
    const after = tick(world, [{ kind: "assignRoute", shipId, routeId: "r" }]);
    expect(amountOf(shipOf(after).cargo, "grain")).toBeGreaterThan(0); // executed despite the absurd threshold
    expect(shipOf(after).assignment?.waiting).toBeUndefined();
    expect(shipOf(after).assignment?.nextStopIndex).toBe(1); // advanced normally
  });

  it("no gate at all ⇒ waiting stays absent (not false) — assignRoute's shape is unchanged", () => {
    const { a, b } = directPair(createWorld("no-gate"));
    const route: Route = {
      id: "r",
      name: "r",
      stops: [
        { portId: a, orders: [{ kind: "buy", good: "grain" }] },
        { portId: b, orders: [{ kind: "sell", good: "grain" }] },
      ],
    };
    const world = seed("no-gate", a, 500, [route]);
    const shipId = shipOf(world).id;
    const after = tick(world, [{ kind: "assignRoute", shipId, routeId: "r" }]);
    expect(shipOf(after).assignment).toEqual({ routeId: "r", nextStopIndex: 1, suspended: false });
  });

  // "Save/load mid-wait is identity" is exercised against the real
  // persistence layer (exportWorldJson/parseWorldJson), not a bare
  // JSON.parse/stringify — see src/store/persistence.test.ts
  // ("round-trips a mid-wait Margin Gate ship..."), so an envelope-layer bug
  // (e.g. stripping `waiting`) is actually catchable.

  it("suspend-while-waiting round-trip: a manual sailTo away clears waiting once the route redirects", () => {
    const { a, b } = directPair(createWorld("gate-suspend"));
    const c = createWorld("gate-suspend").region.ports.find((p) => p.id !== a && p.id !== b)!.id;
    const route = gatedRoute(a, b, 1_000_000);
    const world = seed("gate-suspend", a, 5000, [route]);
    const shipId = shipOf(world).id;

    let w = tick(world, [{ kind: "assignRoute", shipId, routeId: "gated" }]);
    expect(shipOf(w).assignment?.waiting).toBe(true);

    // Manual sailTo elsewhere: suspends the Route (escape hatch, ADR-0007).
    w = tick(w, [{ kind: "sailTo", shipId, portId: c }]);
    expect(shipOf(w).assignment?.suspended).toBe(true);

    // Arrive at c, then resume in the same tick: the route pass immediately
    // redirects toward Stop 0's port (a) since the ship isn't there — this
    // clears the stale `waiting` right away (before the ship ever redocks).
    let guard = 0;
    while (!(shipOf(w).location.kind === "docked") && guard++ < 500) w = tick(w, []);
    w = tick(w, [{ kind: "resumeRoute", shipId }]);
    expect(shipOf(w).assignment?.suspended).toBe(false);
    expect(shipOf(w).location.kind).toBe("underway"); // redirected toward a
    expect(shipOf(w).assignment?.waiting).toBeUndefined(); // cleared by the redirect
  });

  it("atomic v1: two gated buys at one Stop — one clears, one doesn't ⇒ NEITHER fires, ship keeps waiting", () => {
    const { a, b } = directPair(createWorld("gate-atomic"));
    // Both grain and timber gated at @a; both reference @b (sell-stops for
    // each good). grain's threshold is trivially met, timber's is not — the
    // atomic rule says the whole group withholds until *every* gate clears.
    const route: Route = {
      id: "atomic",
      name: "atomic",
      stops: [
        {
          portId: a,
          orders: [
            { kind: "buy", good: "grain", minMargin: -1_000_000 }, // trivially met
            { kind: "buy", good: "timber", minMargin: 1_000_000 }, // never met
          ],
        },
        {
          portId: b,
          orders: [
            { kind: "sell", good: "grain" },
            { kind: "sell", good: "timber" },
          ],
        },
      ],
    };
    const world = seed("gate-atomic", a, 5000, [route]);
    const shipId = shipOf(world).id;

    let w = tick(world, [{ kind: "assignRoute", shipId, routeId: "atomic" }]);
    expect(amountOf(shipOf(w).cargo, "grain")).toBe(0); // withheld despite its own gate passing
    expect(amountOf(shipOf(w).cargo, "timber")).toBe(0);
    expect(shipOf(w).assignment).toMatchObject({ nextStopIndex: 0, waiting: true });

    w = tick(w, []); // poll: timber's gate still unmet, so the whole group stays withheld
    expect(amountOf(shipOf(w).cargo, "grain")).toBe(0);
    expect(amountOf(shipOf(w).cargo, "timber")).toBe(0);
    expect(shipOf(w).assignment).toMatchObject({ nextStopIndex: 0, waiting: true });
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
