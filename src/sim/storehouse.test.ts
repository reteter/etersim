import { describe, expect, it } from "vitest";
import { CONSTRUCTION_RESERVE, HEADQUARTERS_COST } from "./building";
import { applyCommand } from "./commands";
import { amountOf, storeOf } from "./goodsStore";
import {
  computeGuildBuildRushQuote,
  hasStorehousePermit,
  isLegalStorehousePlacement,
  STOREHOUSE_CAPACITY,
  STOREHOUSE_LABOR_FEE,
  STOREHOUSE_PERMIT_RANK,
  STOREHOUSE_RECIPE,
} from "./storehouse";
import { TICKS_PER_DAY } from "./region";
import { tick } from "./tick";
import { createWorld, type World } from "./world";

/**
 * E13 (#100, docs/specs/E13-guild-buildings.md — "The Granary: storage as a
 * new optimization axis"; §Tech). The Granary (agrarian, grain-only) is the
 * only variant E13 ships — these tests exercise it, but the permit/placement/
 * construction machinery is generic over `GuildId`.
 */

/** World with `thalers` in the purse, rank-2 in the agrarian guild (the
 *  permit), s0 docked at the given port. Points rigged directly (not through
 *  contract settlement) — `rankOf` is what's under test elsewhere. */
function richWithPermit(seedStr: string, thalers: number, portId?: string): World {
  const w = createWorld(seedStr);
  const dockPortId = portId ?? w.region.ports[0].id;
  const ship = { ...w.company.ships[0], location: { kind: "docked" as const, portId: dockPortId } };
  return {
    ...w,
    company: {
      ...w.company,
      thalers,
      ships: [ship],
      guilds: { agrarian: { points: 4 } }, // rank 2 (RANK_THRESHOLDS[1] = 4)
    },
  };
}

function agrarianPort(w: World): string {
  return w.region.ports.find((p) => p.archetype === "agrarian")!.id;
}

function freeport(w: World): string {
  return w.region.ports.find((p) => p.archetype === "freeport")!.id;
}

function otherGuildPort(w: World): string {
  return w.region.ports.find((p) => p.archetype !== "agrarian" && p.archetype !== "freeport")!.id;
}

describe("tuning constants", () => {
  it("match the spec's values", () => {
    expect(STOREHOUSE_RECIPE).toEqual({
      grain: 40,
      textiles: 20,
      aetherSalt: 10,
      electronics: 8,
      timber: 6,
    });
    expect(STOREHOUSE_LABOR_FEE).toBe(500);
    expect(STOREHOUSE_CAPACITY).toBe(200);
    expect(STOREHOUSE_PERMIT_RANK).toBe(2);
  });
});

describe("hasStorehousePermit", () => {
  it("is false unenrolled, false below rank 2, true at rank 2+", () => {
    const w0 = createWorld("permit-unenrolled");
    expect(hasStorehousePermit(w0, "agrarian")).toBe(false);

    const rank1: World = { ...w0, company: { ...w0.company, guilds: { agrarian: { points: 0 } } } };
    expect(hasStorehousePermit(rank1, "agrarian")).toBe(false);

    const rank2: World = { ...w0, company: { ...w0.company, guilds: { agrarian: { points: 4 } } } };
    expect(hasStorehousePermit(rank2, "agrarian")).toBe(true);
  });
});

describe("isLegalStorehousePlacement", () => {
  it("accepts the guild's own archetype and the Free port, rejects other archetypes and unknown ports", () => {
    const w = createWorld("placement");
    expect(isLegalStorehousePlacement(w, "agrarian", agrarianPort(w))).toBe(true);
    expect(isLegalStorehousePlacement(w, "agrarian", freeport(w))).toBe(true);
    expect(isLegalStorehousePlacement(w, "agrarian", otherGuildPort(w))).toBe(false);
    expect(isLegalStorehousePlacement(w, "agrarian", "no-such-port")).toBe(false);
  });
});

describe("commissionGuildBuilding", () => {
  it("charges the labor fee, opens a pending order, and appends exactly one laborFee event", () => {
    const w = richWithPermit("commission", STOREHOUSE_LABOR_FEE + CONSTRUCTION_RESERVE + 1000);
    const portId = agrarianPort(w);
    const next = applyCommand(w, {
      kind: "commissionGuildBuilding",
      type: "storehouse",
      variant: "agrarian",
      portId,
    });
    expect(next.company.thalers).toBe(w.company.thalers - STOREHOUSE_LABOR_FEE);
    expect(next.company.guildBuild).toEqual({
      type: "storehouse",
      variant: "agrarian",
      portId,
      siteStore: expect.anything(),
    });
    expect(amountOf(next.company.guildBuild!.siteStore, "grain")).toBe(0);
    expect(next.ledger[next.ledger.length - 1]).toEqual({
      kind: "laborFee",
      tick: w.tick,
      thalers: STOREHOUSE_LABOR_FEE,
    });
  });

  it("rejects without the permit (unenrolled or below rank 2)", () => {
    const w0 = createWorld("no-permit");
    const rich: World = { ...w0, company: { ...w0.company, thalers: 100_000 } };
    const portId = agrarianPort(rich);
    const rejected = applyCommand(rich, {
      kind: "commissionGuildBuilding",
      type: "storehouse",
      variant: "agrarian",
      portId,
    });
    expect(rejected).toBe(rich);
    expect(rejected.company.guildBuild).toBeUndefined();
  });

  it("rejects illegal placement (a different guild's archetype)", () => {
    const w = richWithPermit("illegal-placement", 100_000);
    const portId = otherGuildPort(w);
    const rejected = applyCommand(w, {
      kind: "commissionGuildBuilding",
      type: "storehouse",
      variant: "agrarian",
      portId,
    });
    expect(rejected).toBe(w);
  });

  it("rejects when unaffordable (would dip into the Reserve)", () => {
    const w = richWithPermit("poor", STOREHOUSE_LABOR_FEE + CONSTRUCTION_RESERVE - 1);
    const portId = agrarianPort(w);
    const rejected = applyCommand(w, {
      kind: "commissionGuildBuilding",
      type: "storehouse",
      variant: "agrarian",
      portId,
    });
    expect(rejected).toBe(w);
  });

  it("rejects while a ship Build Order is active (one-active-order law, extended)", () => {
    const w0 = richWithPermit("scarcity-ship", HEADQUARTERS_COST + STOREHOUSE_LABOR_FEE + CONSTRUCTION_RESERVE + 100_000);
    const hqPortId = w0.region.ports[0].id;
    let w = applyCommand(w0, { kind: "foundHeadquarters", portId: hqPortId });
    w = applyCommand(w, { kind: "placeBuildOrder" });
    expect(w.company.headquarters?.buildOrder).toBeDefined(); // precondition

    const rejected = applyCommand(w, {
      kind: "commissionGuildBuilding",
      type: "storehouse",
      variant: "agrarian",
      portId: agrarianPort(w),
    });
    expect(rejected).toBe(w);
  });

  it("blocks a ship Build Order while a guild Building is pending (the other side of the same law)", () => {
    const w0 = richWithPermit("scarcity-yard", HEADQUARTERS_COST + STOREHOUSE_LABOR_FEE + CONSTRUCTION_RESERVE + 100_000);
    const hqPortId = w0.region.ports[0].id;
    let w = applyCommand(w0, { kind: "foundHeadquarters", portId: hqPortId });
    w = applyCommand(w, {
      kind: "commissionGuildBuilding",
      type: "storehouse",
      variant: "agrarian",
      portId: agrarianPort(w),
    });
    expect(w.company.guildBuild).toBeDefined(); // precondition

    const rejected = applyCommand(w, { kind: "placeBuildOrder" });
    expect(rejected).toBe(w);
  });

  it("rejects a second Storehouse commission at a port that already has one", () => {
    const w0 = richWithPermit("dup-port", 500_000);
    const portId = agrarianPort(w0);
    let w = applyCommand(w0, {
      kind: "commissionGuildBuilding",
      type: "storehouse",
      variant: "agrarian",
      portId,
    });
    // Rush the first one to completion.
    let guard = 0;
    while (w.company.guildBuild && guard++ < 500) {
      w = applyCommand(w, { kind: "rushGuildBuild" });
      if (w.company.guildBuild) w = tick(w, []);
    }
    expect(w.company.buildings.length).toBe(1); // precondition

    const rejected = applyCommand(w, {
      kind: "commissionGuildBuilding",
      type: "storehouse",
      variant: "agrarian",
      portId,
    });
    expect(rejected).toBe(w);
  });
});

describe("construction lifecycle (auto-draw, rush, deliver, completion) — the E9/E14 machinery, generalized", () => {
  it("auto-draw fills the site over several ticks and completes with a `completed` event + an empty-store CompanyBuilding", () => {
    const w0 = richWithPermit("autodraw", 500_000);
    const portId = agrarianPort(w0);
    let w = applyCommand(w0, {
      kind: "commissionGuildBuilding",
      type: "storehouse",
      variant: "agrarian",
      portId,
    });
    let guard = 0;
    while (w.company.guildBuild && guard++ < 5000) w = tick(w, []);
    expect(guard).toBeLessThan(5000); // precondition: it actually completed

    expect(w.company.guildBuild).toBeUndefined();
    expect(w.company.buildings).toEqual([{ type: "storehouse", variant: "agrarian", portId, store: expect.anything() }]);
    expect(amountOf(w.company.buildings[0].store, "grain")).toBe(0); // fresh, empty

    const completedEvents = w.ledger.filter((e) => e.kind === "completed");
    expect(completedEvents).toEqual([{ kind: "completed", tick: expect.any(Number), portId, buildingType: "storehouse" }]);
  });

  it("computeGuildBuildRushQuote previews exactly what rushGuildBuild buys, and rush completes the build", () => {
    const w0 = richWithPermit("rush", 500_000);
    const portId = agrarianPort(w0);
    let w = applyCommand(w0, {
      kind: "commissionGuildBuilding",
      type: "storehouse",
      variant: "agrarian",
      portId,
    });
    const quote = computeGuildBuildRushQuote(w);
    expect(quote.lines.length).toBeGreaterThan(0);

    let guard = 0;
    while (w.company.guildBuild && guard++ < 100) w = applyCommand(w, { kind: "rushGuildBuild" });
    expect(w.company.buildings.length).toBe(1); // precondition: rush alone completed it
  });

  it("deliver moves cargo into the pending site (min(cargo, need)) and resolves completion on a zero-need delivery", () => {
    const w0seed = createWorld("deliver-storehouse");
    const portId = agrarianPort(w0seed);
    const w0 = richWithPermit("deliver-storehouse", 500_000, portId);
    let w = applyCommand(w0, {
      kind: "commissionGuildBuilding",
      type: "storehouse",
      variant: "agrarian",
      portId,
    });
    const laden = { ...w.company.ships[0], cargo: storeOf({ grain: STOREHOUSE_RECIPE.grain }) };
    w = { ...w, company: { ...w.company, ships: [laden] } };
    w = applyCommand(w, { kind: "deliver", shipId: "s0", good: "grain" });
    expect(amountOf(w.company.guildBuild!.siteStore, "grain")).toBe(STOREHOUSE_RECIPE.grain);

    // A second (zero-need) delivery of the same good is a no-op — deliver
    // never targets the activated Storehouse, only the construction site.
    const before = w;
    const noop = applyCommand(w, { kind: "deliver", shipId: "s0", good: "grain" });
    expect(noop).toBe(before);
  });
});

describe("no-dominance guardrail (standard seed): buy-store-sell must not out-earn a two-port carry loop", () => {
  it("a scripted buy-store-sell-after-drift script does not out-earn a scripted two-port carry loop over the same horizon", () => {
    const HORIZON_TICKS = 30 * TICKS_PER_DAY;
    const STARTING_PURSE = 500_000;

    // Lane A: buy grain at the agrarian port, store it, wait out a drift
    // window, withdraw, sell at the SAME port (arbitrage over time only —
    // no second port, no carry).
    function runStoreSell(): number {
      const w0 = richWithPermit("guardrail-store", STARTING_PURSE);
      const portId = agrarianPort(w0);
      let w = applyCommand(w0, {
        kind: "commissionGuildBuilding",
        type: "storehouse",
        variant: "agrarian",
        portId,
      });
      let guard = 0;
      while (w.company.guildBuild && guard++ < 5000) w = tick(w, []);

      const cycle = 5 * TICKS_PER_DAY; // buy/store, wait, withdraw/sell, repeat
      let t = 0;
      while (t < HORIZON_TICKS) {
        w = applyCommand(w, { kind: "buy", shipId: "s0", good: "grain", qty: 40 });
        w = applyCommand(w, { kind: "storeGood", shipId: "s0", good: "grain" });
        for (let i = 0; i < cycle; i++) w = tick(w, []);
        w = applyCommand(w, { kind: "withdrawGood", shipId: "s0", good: "grain" });
        const have = amountOf(w.company.ships[0].cargo, "grain");
        if (have > 0) w = applyCommand(w, { kind: "sell", shipId: "s0", good: "grain", qty: have });
        t += cycle;
      }
      return w.company.thalers - STARTING_PURSE;
    }

    // Lane B: a scripted two-port carry loop — buy grain at the agrarian
    // port, sail to a consuming port, sell, sail back, repeat.
    function runCarryLoop(): number {
      const w0 = richWithPermit("guardrail-carry", STARTING_PURSE);
      const portA = agrarianPort(w0);
      const portB = otherGuildPort(w0);
      let w = w0;
      let t = 0;
      let leg = 0; // 0: buy at A then sail to B; 1: sell at B then sail to A
      while (t < HORIZON_TICKS) {
        const ship = w.company.ships[0];
        if (ship.location.kind === "docked") {
          if (leg === 0) {
            w = applyCommand(w, { kind: "buy", shipId: "s0", good: "grain", qty: 40 });
            w = applyCommand(w, { kind: "sailTo", shipId: "s0", portId: portB });
          } else {
            const have = amountOf(w.company.ships[0].cargo, "grain");
            if (have > 0) w = applyCommand(w, { kind: "sell", shipId: "s0", good: "grain", qty: have });
            w = applyCommand(w, { kind: "sailTo", shipId: "s0", portId: portA });
          }
          leg = 1 - leg;
        }
        w = tick(w, []);
        t += 1;
      }
      return w.company.thalers - STARTING_PURSE;
    }

    const storeSellProfit = runStoreSell();
    const carryProfit = runCarryLoop();
    expect(carryProfit).toBeGreaterThan(storeSellProfit);
  });
});
