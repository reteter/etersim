import { describe, expect, it } from "vitest";
import { createWorld, type Route, type Ship, type World } from "../sim";
import { formatWaitingGates, waitingGates } from "./waitingStatus";

/** A World with two known ports (the shortest lane's ends), s0 docked at
 *  the first, no Route/assignment yet — callers layer routes/ships/waiting
 *  on top. */
function twoPortWorld(seed: string): { world: World; a: string; b: string } {
  const w0 = createWorld(seed);
  const lane = [...w0.region.lanes].sort((x, y) => x.voyageTicks - y.voyageTicks)[0];
  const ship: Ship = { ...w0.company.ships[0], location: { kind: "docked", portId: lane.a } };
  const world: World = { ...w0, company: { ...w0.company, ships: [ship] } };
  return { world, a: lane.a, b: lane.b };
}

function withWaiting(world: World, route: Route, extra: Partial<Ship> = {}): World {
  const ship: Ship = {
    ...world.company.ships[0],
    assignment: { routeId: route.id, nextStopIndex: 0, suspended: false, waiting: true },
    ...extra,
  };
  return { ...world, company: { ...world.company, ships: [ship], routes: [route] } };
}

describe("waitingGates", () => {
  it("is empty when the ship isn't waiting", () => {
    const { world } = twoPortWorld("wg-not-waiting");
    expect(waitingGates(world, world.company.ships[0])).toEqual([]);
  });

  it("resolves one active gate: good, threshold, and a non-null live margin", () => {
    const { world, a, b } = twoPortWorld("wg-single-gate");
    const route: Route = {
      id: "r1",
      name: "loop",
      stops: [
        { portId: a, orders: [{ kind: "buy", good: "grain", minMargin: 1 }] },
        { portId: b, orders: [{ kind: "sell", good: "grain" }] },
      ],
    };
    const waitingWorld = withWaiting(world, route);
    const gates = waitingGates(waitingWorld, waitingWorld.company.ships[0]);
    expect(gates).toHaveLength(1);
    expect(gates[0]).toMatchObject({ good: "grain", minMargin: 1 });
    expect(gates[0].liveMargin).not.toBeNull();
    expect(formatWaitingGates(gates)).toBe(`czeka na marżę ≥ ₸1 (teraz ₸${gates[0].liveMargin})`);
  });

  it("reports a null live margin (as \"—\") when the buy side has zero local stock", () => {
    const { world, a, b } = twoPortWorld("wg-null-margin");
    const portIdx = world.region.ports.findIndex((p) => p.id === a);
    const port = world.region.ports[portIdx];
    const ports = [...world.region.ports];
    ports[portIdx] = { ...port, market: { ...port.market, grain: { ...port.market.grain, stock: 0 } } };
    const zeroed: World = { ...world, region: { ...world.region, ports } };

    const route: Route = {
      id: "r1",
      name: "loop",
      stops: [
        { portId: a, orders: [{ kind: "buy", good: "grain", minMargin: 1 }] },
        { portId: b, orders: [{ kind: "sell", good: "grain" }] },
      ],
    };
    const waitingWorld = withWaiting(zeroed, route);
    const gates = waitingGates(waitingWorld, waitingWorld.company.ships[0]);
    expect(gates).toHaveLength(1);
    expect(gates[0].liveMargin).toBeNull();
    expect(formatWaitingGates(gates)).toBe("czeka na marżę ≥ ₸1 (teraz —)");
  });

  it("filters out an inactive gate (no sell-stop for the good anywhere on the route)", () => {
    const { world, a, b } = twoPortWorld("wg-inactive-gate");
    const route: Route = {
      id: "r1",
      name: "loop",
      stops: [
        { portId: a, orders: [{ kind: "buy", good: "grain", minMargin: 1 }] },
        { portId: b, orders: [{ kind: "deliver", good: "grain" }] }, // never a reference
      ],
    };
    const waitingWorld = withWaiting(world, route);
    expect(waitingGates(waitingWorld, waitingWorld.company.ships[0])).toEqual([]);
  });

  it("prefixes each line with the good's name when several gates hold the same Stop (v1 atomic wait)", () => {
    const { world, a, b } = twoPortWorld("wg-multi-gate");
    const route: Route = {
      id: "r1",
      name: "loop",
      stops: [
        {
          portId: a,
          orders: [
            { kind: "buy", good: "grain", minMargin: 1 },
            { kind: "buy", good: "textiles", minMargin: 2 },
          ],
        },
        {
          portId: b,
          orders: [
            { kind: "sell", good: "grain" },
            { kind: "sell", good: "textiles" },
          ],
        },
      ],
    };
    const waitingWorld = withWaiting(world, route);
    const gates = waitingGates(waitingWorld, waitingWorld.company.ships[0]);
    expect(gates).toHaveLength(2);
    const text = formatWaitingGates(gates);
    expect(text).toContain("Grain: czeka na marżę ≥ ₸1");
    expect(text).toContain("Textiles: czeka na marżę ≥ ₸2");
    expect(text).toContain("; ");
  });
});
