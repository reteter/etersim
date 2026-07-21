import { describe, expect, it } from "vitest";
import { CONSTRUCTION_RESERVE } from "./building";
import { applyCommand } from "./commands";
import { amountOf, emptyStore, storeOf, totalHeld } from "./goodsStore";
import { computeNetWorth, regionAverageMid } from "./ledger";
import {
  STOREHOUSE_CAPACITY,
  STOREHOUSE_LABOR_FEE,
  STOREHOUSE_RECIPE,
  type CompanyBuilding,
} from "./storehouse";
import { tick } from "./tick";
import type { StoreRef } from "./transfer";
import { createWorld, type World } from "./world";

const AGRARIAN = "agrarian" as const;

function withPermit(seed: string): World {
  const created = createWorld(seed);
  const homePortId = created.company.ships[0].location.kind === "docked"
    ? created.company.ships[0].location.portId
    : created.region.ports[0].id;
  return {
    ...created,
    company: {
      ...created.company,
      thalers: 1_000_000,
      headquarters: { portId: homePortId },
      guilds: { ...created.company.guilds, agrarian: { points: 4 } },
    },
  };
}

function granary(portId: string, grain = 0): CompanyBuilding {
  return {
    type: "storehouse",
    variant: AGRARIAN,
    portId,
    store: storeOf({ grain }),
  };
}

function withGranary(seed: string, grain = 0): World {
  const world = withPermit(seed);
  const ship = world.company.ships[0];
  const portId = ship.location.kind === "docked" ? ship.location.portId : world.region.ports[0].id;
  return {
    ...world,
    company: { ...world.company, buildings: [granary(portId, grain)] },
  };
}

describe("Storehouse commission and construction (#100)", () => {
  it("commissions a Granary only with its rank-2 permit and legal placement", () => {
    const permitted = withPermit("storehouse-permit");
    const agrarianPort = permitted.region.ports.find((port) => port.archetype === AGRARIAN)!;
    const beforeThalers = permitted.company.thalers;

    const commissioned = applyCommand(permitted, {
      kind: "commissionGuildBuilding",
      type: "storehouse",
      variant: AGRARIAN,
      portId: agrarianPort.id,
    });

    expect(commissioned.company.guildBuildOrder).toEqual({
      type: "storehouse",
      variant: AGRARIAN,
      portId: agrarianPort.id,
      siteStore: emptyStore(),
    });
    expect(commissioned.company.thalers).toBe(beforeThalers - STOREHOUSE_LABOR_FEE);
    expect(commissioned.ledger.at(-1)).toEqual({
      kind: "laborFee",
      tick: permitted.tick,
      thalers: STOREHOUSE_LABOR_FEE,
    });

    const rankOne = {
      ...permitted,
      company: { ...permitted.company, guilds: { agrarian: { points: 0 } } },
    };
    expect(applyCommand(rankOne, {
      kind: "commissionGuildBuilding",
      type: "storehouse",
      variant: AGRARIAN,
      portId: agrarianPort.id,
    })).toBe(rankOne);

    const unaffordable = {
      ...permitted,
      company: {
        ...permitted.company,
        thalers: STOREHOUSE_LABOR_FEE + CONSTRUCTION_RESERVE - 1,
      },
    };
    expect(applyCommand(unaffordable, {
      kind: "commissionGuildBuilding",
      type: "storehouse",
      variant: AGRARIAN,
      portId: agrarianPort.id,
    })).toBe(unaffordable);

    const illegalPort = permitted.region.ports.find(
      (port) => port.archetype !== AGRARIAN && port.archetype !== "freeport",
    )!;
    expect(applyCommand(permitted, {
      kind: "commissionGuildBuilding",
      type: "storehouse",
      variant: AGRARIAN,
      portId: illegalPort.id,
    })).toBe(permitted);

    const freeport = permitted.region.ports.find((port) => port.archetype === "freeport")!;
    expect(applyCommand(permitted, {
      kind: "commissionGuildBuilding",
      type: "storehouse",
      variant: AGRARIAN,
      portId: freeport.id,
    }).company.guildBuildOrder?.portId).toBe(freeport.id);
  });

  it("uses the one-active-order law and activates with the exact Storehouse recipe", () => {
    const permitted = withPermit("storehouse-scarcity");
    const agrarianPort = permitted.region.ports.find((port) => port.archetype === AGRARIAN)!;
    const withShipOrder = applyCommand(permitted, { kind: "placeBuildOrder" });
    expect(applyCommand(withShipOrder, {
      kind: "commissionGuildBuilding",
      type: "storehouse",
      variant: AGRARIAN,
      portId: agrarianPort.id,
    })).toBe(withShipOrder);

    let world = applyCommand(permitted, {
      kind: "commissionGuildBuilding",
      type: "storehouse",
      variant: AGRARIAN,
      portId: agrarianPort.id,
    });
    expect(applyCommand(world, { kind: "placeBuildOrder" })).toBe(world);
    expect(applyCommand(world, {
      kind: "commissionShipyard",
      portId: permitted.region.ports[0].id,
    })).toBe(world);
    world = applyCommand(world, { kind: "rushGuildBuilding" });

    expect(STOREHOUSE_RECIPE).toEqual({
      grain: 40,
      textiles: 20,
      aetherSalt: 10,
      electronics: 8,
      timber: 6,
    });
    expect(world.company.guildBuildOrder).toBeUndefined();
    expect(world.company.buildings).toEqual([granary(agrarianPort.id)]);
    expect(world.ledger.at(-1)).toEqual({
      kind: "completed",
      tick: permitted.tick,
      type: "storehouse",
      variant: AGRARIAN,
      portId: agrarianPort.id,
    });
  });

  it("auto-draws at the building port and stalls silently at the Reserve", () => {
    const permitted = withPermit("storehouse-auto-draw");
    const agrarianPort = permitted.region.ports.find((port) => port.archetype === AGRARIAN)!;
    const commissioned = applyCommand(permitted, {
      kind: "commissionGuildBuilding",
      type: "storehouse",
      variant: AGRARIAN,
      portId: agrarianPort.id,
    });

    const drawn = tick(commissioned, []);
    expect(totalHeld(drawn.company.guildBuildOrder!.siteStore)).toBe(5);
    expect(drawn.ledger.filter((event) => event.kind === "autoDraw")).toHaveLength(5);
    expect(drawn.ledger.slice(-5).every(
      (event) => event.kind === "autoDraw" && event.portId === agrarianPort.id,
    )).toBe(true);

    const atReserve = {
      ...commissioned,
      company: { ...commissioned.company, thalers: CONSTRUCTION_RESERVE },
    };
    const stalled = tick(atReserve, []);
    expect(stalled.company.guildBuildOrder?.siteStore).toEqual(
      atReserve.company.guildBuildOrder?.siteStore,
    );
    expect(stalled.ledger).toEqual(atReserve.ledger);
  });

  it("delivers explicitly into the guild-building construction site", () => {
    let world = withPermit("storehouse-delivery");
    const agrarianPort = world.region.ports.find((port) => port.archetype === AGRARIAN)!;
    const ship = world.company.ships[0];
    world = {
      ...world,
      company: {
        ...world.company,
        ships: [{
          ...ship,
          cargo: storeOf({ grain: 12 }),
          location: { kind: "docked", portId: agrarianPort.id },
        }],
      },
    };
    world = applyCommand(world, {
      kind: "commissionGuildBuilding",
      type: "storehouse",
      variant: AGRARIAN,
      portId: agrarianPort.id,
    });

    const delivered = applyCommand(world, {
      kind: "deliver",
      shipId: ship.id,
      good: "grain",
      target: { kind: "guildBuild" },
    });

    expect(amountOf(delivered.company.guildBuildOrder!.siteStore, "grain")).toBe(12);
    expect(delivered.ledger.at(-1)).toEqual({
      kind: "delivery",
      tick: world.tick,
      shipId: ship.id,
      portId: agrarianPort.id,
      good: "grain",
      qty: 12,
    });
  });
});

describe("Storehouse transfers (#100)", () => {
  it("stores only the filtered good and clamps at StorePolicy capacity", () => {
    let world = withGranary("storehouse-capacity", STOREHOUSE_CAPACITY - 10);
    const ship = world.company.ships[0];
    const portId = ship.location.kind === "docked" ? ship.location.portId : "";
    world = {
      ...world,
      company: {
        ...world.company,
        ships: [{ ...ship, hold: 100, cargo: storeOf({ grain: 30, textiles: 5 }) }],
      },
    };
    const target: StoreRef = { kind: "storehouse", portId };

    const stored = applyCommand(world, { kind: "storeGood", shipId: ship.id, good: "grain", target });
    expect(amountOf(stored.company.buildings[0].store, "grain")).toBe(STOREHOUSE_CAPACITY);
    expect(amountOf(stored.company.ships[0].cargo, "grain")).toBe(20);
    expect(stored.company.thalers).toBe(world.company.thalers);
    expect(stored.ledger.at(-1)).toEqual({
      kind: "store",
      tick: world.tick,
      shipId: ship.id,
      portId,
      good: "grain",
      qty: 10,
    });

    expect(applyCommand(stored, {
      kind: "storeGood",
      shipId: ship.id,
      good: "textiles",
      target,
    })).toBe(stored);
  });

  it("withdraws best-effort into available Hold space and zero moves are no-ops", () => {
    let world = withGranary("storehouse-withdraw", 20);
    const ship = world.company.ships[0];
    const portId = ship.location.kind === "docked" ? ship.location.portId : "";
    world = {
      ...world,
      company: {
        ...world.company,
        ships: [{ ...ship, hold: 50, cargo: storeOf({ textiles: 47 }) }],
      },
    };
    const source: StoreRef = { kind: "storehouse", portId };

    const withdrawn = applyCommand(world, {
      kind: "withdrawGood",
      shipId: ship.id,
      good: "grain",
      source,
    });
    expect(amountOf(withdrawn.company.buildings[0].store, "grain")).toBe(17);
    expect(amountOf(withdrawn.company.ships[0].cargo, "grain")).toBe(3);
    expect(withdrawn.company.thalers).toBe(world.company.thalers);
    expect(withdrawn.ledger.at(-1)).toEqual({
      kind: "withdraw",
      tick: world.tick,
      shipId: ship.id,
      portId,
      good: "grain",
      qty: 3,
    });

    expect(applyCommand(withdrawn, {
      kind: "withdrawGood",
      shipId: ship.id,
      good: "textiles",
      source,
    })).toBe(withdrawn);
  });

  it("executes a store Stop through the same Command and advances without waiting", () => {
    const base = withGranary("storehouse-route-store", 12);
    const ship = base.company.ships[0];
    const portId = ship.location.kind === "docked" ? ship.location.portId : "";
    const otherPortId = base.region.ports.find((port) => port.id !== portId)!.id;
    const target: StoreRef = { kind: "storehouse", portId };
    const cargo = storeOf({ grain: 8 });
    const prepared = {
      ...base,
      company: { ...base.company, ships: [{ ...ship, cargo }] },
    };
    const manual = applyCommand(prepared, {
      kind: "storeGood",
      shipId: ship.id,
      good: "grain",
      target,
    });
    const route = {
      id: "storage-loop",
      name: "Storage loop",
      stops: [
        {
          portId,
          orders: [{ kind: "store", good: "grain", target }],
        },
        { portId: otherPortId, orders: [] },
      ],
    } as const;
    const routed = tick({
      ...prepared,
      company: {
        ...prepared.company,
        routes: [route],
        ships: [{
          ...ship,
          cargo,
          assignment: { routeId: route.id, nextStopIndex: 0, suspended: false },
        }],
      },
    }, []);

    expect(routed.company.ships[0].cargo).toEqual(manual.company.ships[0].cargo);
    expect(routed.company.buildings[0].store).toEqual(manual.company.buildings[0].store);
    expect(routed.ledger.filter((event) => event.kind === "store"))
      .toEqual(manual.ledger);
    expect(routed.company.ships[0].assignment?.waiting).toBeUndefined();

    const departed = tick(routed, []);
    expect(departed.company.ships[0].location.kind).toBe("underway");
  });

  it("executes a withdraw Stop through the same Command", () => {
    const base = withGranary("storehouse-route-withdraw", 12);
    const ship = base.company.ships[0];
    const portId = ship.location.kind === "docked" ? ship.location.portId : "";
    const otherPortId = base.region.ports.find((port) => port.id !== portId)!.id;
    const source: StoreRef = { kind: "storehouse", portId };
    const manual = applyCommand(base, {
      kind: "withdrawGood",
      shipId: ship.id,
      good: "grain",
      source,
    });
    const route = {
      id: "withdraw-loop",
      name: "Withdraw loop",
      stops: [
        { portId, orders: [{ kind: "withdraw", good: "grain", source }] },
        { portId: otherPortId, orders: [] },
      ],
    } as const;
    const routed = tick({
      ...base,
      company: {
        ...base.company,
        routes: [route],
        ships: [{
          ...ship,
          assignment: { routeId: route.id, nextStopIndex: 0, suspended: false },
        }],
      },
    }, []);

    expect(routed.company.ships[0].cargo).toEqual(manual.company.ships[0].cargo);
    expect(routed.company.buildings[0].store).toEqual(manual.company.buildings[0].store);
    expect(routed.ledger.filter((event) => event.kind === "withdraw")).toEqual(manual.ledger);
  });
});

describe("Storehouse value and determinism (#100)", () => {
  it("reports standing Storehouse goods in buildingStoreValue at region-average mid", () => {
    const world = withGranary("storehouse-net-worth", 37);
    const worth = computeNetWorth(world);
    const expected = 37 * regionAverageMid(world.region, "grain");
    expect(worth.buildingStoreValue).toBe(expected);
    expect(worth.total).toBe(
      worth.thalers + worth.cargoValue + worth.siteStoreValue + worth.buildingStoreValue,
    );
  });

  it("keeps net worth unchanged when goods move between Hold and Storehouse", () => {
    let world = withGranary("storehouse-value-neutral", 0);
    const ship = world.company.ships[0];
    const portId = ship.location.kind === "docked" ? ship.location.portId : "";
    world = {
      ...world,
      company: {
        ...world.company,
        ships: [{ ...ship, cargo: storeOf({ grain: 20 }) }],
      },
    };
    const before = computeNetWorth(world).total;
    const stored = applyCommand(world, {
      kind: "storeGood",
      shipId: ship.id,
      good: "grain",
      target: { kind: "storehouse", portId },
    });
    expect(computeNetWorth(stored).total).toBe(before);
  });

  it("produces byte-equal Ledger output for identical building scripts", () => {
    const run = (): string => {
      let world = withPermit("storehouse-ledger-determinism");
      const port = world.region.ports.find((candidate) => candidate.archetype === AGRARIAN)!;
      world = applyCommand(world, {
        kind: "commissionGuildBuilding",
        type: "storehouse",
        variant: AGRARIAN,
        portId: port.id,
      });
      world = applyCommand(world, { kind: "rushGuildBuilding" });
      const ship = world.company.ships[0];
      world = {
        ...world,
        company: {
          ...world.company,
          ships: [{
            ...ship,
            cargo: storeOf({ grain: 9 }),
            location: { kind: "docked", portId: port.id },
          }],
        },
      };
      const ref: StoreRef = { kind: "storehouse", portId: port.id };
      world = applyCommand(world, { kind: "storeGood", shipId: ship.id, good: "grain", target: ref });
      world = applyCommand(world, { kind: "withdrawGood", shipId: ship.id, good: "grain", source: ref });
      return JSON.stringify(world.ledger);
    };

    expect(run()).toBe(run());
  });
});
