import { describe, expect, it } from "vitest";
import { quoteBuy, quoteSell } from "./market";
import { tick } from "./tick";
import { cargoUsed, type Ship } from "./ship";
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
    expect(ship(world0).holdCapacity).toBe(STARTING_HOLD);
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
    const cost = quoteBuy("grain", port.market.grain, 10)!;
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
    const revenue = quoteSell("grain", port.market.grain, 10)!;
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

  it("puts the ship underway on the shortest route", () => {
    const next = tick(world0, [{ kind: "sailTo", shipId, portId: target.id }]);
    const loc = ship(next).location;
    expect(loc.kind).toBe("underway");
    if (loc.kind === "underway") {
      expect(loc.destination).toBe(target.id);
      expect(loc.route.length).toBeGreaterThan(0);
    }
  });

  it("docks at the destination after the route's total ticks", () => {
    let w = tick(world0, [{ kind: "sailTo", shipId, portId: target.id }]);
    const loc = ship(w).location;
    if (loc.kind !== "underway") throw new Error("expected underway");
    const total = loc.route.reduce(
      (sum, step) => sum + w.region.lanes.find((l) => l.id === step.laneId)!.voyageTicks,
      0,
    );
    // the command tick already sailed hour 1, so total-1 ticks remain
    for (let t = 1; t < total - 1; t++) {
      w = tick(w, []);
      expect(ship(w).location.kind).toBe("underway");
    }
    w = tick(w, []);
    expect(ship(w).location).toEqual({ kind: "docked", portId: target.id });
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
