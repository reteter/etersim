import { describe, expect, it } from "vitest";
import { HEADQUARTERS_COST, CONSTRUCTION_RESERVE } from "./building";
import { applyCommand, MAX_SHIP_NAME_LENGTH } from "./commands";
import type { ActiveContract, ContractOffer } from "./contract";
import { RANK_THRESHOLDS, UPKEEP_PER_DAY } from "./guild";
import { effectiveBase, quoteBuy, quoteSell } from "./market";
import { TICKS_PER_DAY } from "./region";
import { tick } from "./tick";
import { cargoUsed, etaTicks, type Ship } from "./ship";
import { createWorld, STARTING_HOLD, STARTING_THALERS, type World } from "./world";

/** World with a founded HQ, exactly `thalers` in the purse, enrolled in
 *  `guildId` with `points` progress — the shared precondition for accept/resign
 *  command tests (docs/specs/E3-contracts-and-guilds.md — Tech: Contracts). */
function contractWorld(
  seedStr: string,
  thalers: number,
  guildId: ContractOffer["guildId"],
  points: number,
): World {
  const w = createWorld(seedStr);
  const rich: World = {
    ...w,
    company: { ...w.company, thalers: HEADQUARTERS_COST + CONSTRUCTION_RESERVE + 10_000 },
  };
  const founded = applyCommand(rich, { kind: "foundHeadquarters", portId: rich.region.ports[0].id });
  return {
    ...founded,
    company: {
      ...founded.company,
      thalers,
      guilds: { ...founded.company.guilds, [guildId]: { points } },
    },
  };
}

const sampleOffer = (overrides: Partial<ContractOffer> = {}): ContractOffer => ({
  id: "agrarian:agrarian-port:textiles",
  guildId: "agrarian",
  portId: "agrarian-port",
  good: "textiles",
  quotaPerPeriod: 50,
  periodDays: 7,
  minPeriods: 3,
  feePerPeriod: 200,
  tier: 1,
  basis: { sourcePortId: "urban-port", roundTripTicks: 40, expectedTrips: 2 },
  ...overrides,
});

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

  it("appends exactly one trade event for the buy, with no routeId (manual trade)", () => {
    const before = tick(world0, []);
    const cost = quoteBuy(port.market.grain, effectiveBase(port, "grain"), 10)!;
    const next = tick(world0, [{ kind: "buy", shipId, good: "grain", qty: 10 }]);
    expect(next.ledger.length).toBe(before.ledger.length + 1);
    const event = next.ledger[next.ledger.length - 1];
    // Full object, not toMatchObject: thalers is exactly the field a pricing
    // bug would corrupt, so it must be asserted, not omitted.
    expect(event).toEqual({
      kind: "trade",
      tick: world0.tick,
      shipId,
      portId: port.id,
      good: "grain",
      side: "buy",
      qty: 10,
      thalers: cost,
      routeId: undefined,
    });
  });

  it("rejects a buy the company cannot afford, leaving the world (and ledger) unchanged", () => {
    const next = tick(world0, [{ kind: "buy", shipId, good: "timber", qty: 50 }]);
    expect(next).toEqual(tick(world0, []));
    expect(next.ledger).toEqual(tick(world0, []).ledger);
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

  it("appends exactly one trade event for the sell", () => {
    const before = tick(withCargo, []);
    const port = homePort(withCargo);
    const revenue = quoteSell(port.market.grain, effectiveBase(port, "grain"), 10)!;
    const next = tick(withCargo, [{ kind: "sell", shipId, good: "grain", qty: 10 }]);
    expect(next.ledger.length).toBe(before.ledger.length + 1);
    expect(next.ledger[next.ledger.length - 1]).toEqual({
      kind: "trade",
      tick: withCargo.tick,
      shipId,
      portId: port.id,
      good: "grain",
      side: "sell",
      qty: 10,
      thalers: revenue,
      routeId: undefined,
    });
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

describe("renameShip command (#83/#54)", () => {
  const shipId = ship(world0).id;

  it("sets the ship's display name, trimmed", () => {
    const next = tick(world0, [{ kind: "renameShip", shipId, name: "  Aether Queen  " }]);
    expect(ship(next).name).toBe("Aether Queen");
  });

  it("rejects an empty or whitespace-only name, leaving the world unchanged", () => {
    expect(tick(world0, [{ kind: "renameShip", shipId, name: "   " }])).toEqual(tick(world0, []));
    expect(tick(world0, [{ kind: "renameShip", shipId, name: "" }])).toEqual(tick(world0, []));
  });

  it("rejects an unknown ship id, leaving the world unchanged", () => {
    expect(tick(world0, [{ kind: "renameShip", shipId: "nope", name: "Ghost" }])).toEqual(
      tick(world0, []),
    );
  });

  it("does not touch any other field on the ship", () => {
    const next = tick(world0, [{ kind: "renameShip", shipId, name: "Renamed" }]);
    expect(ship(next)).toEqual({ ...ship(world0), name: "Renamed" });
  });

  it("truncates a trimmed name longer than MAX_SHIP_NAME_LENGTH", () => {
    const overlong = "A".repeat(MAX_SHIP_NAME_LENGTH + 10);
    const next = tick(world0, [{ kind: "renameShip", shipId, name: overlong }]);
    expect(ship(next).name).toBe("A".repeat(MAX_SHIP_NAME_LENGTH));
    expect(ship(next).name.length).toBe(MAX_SHIP_NAME_LENGTH);
  });

  it("truncates after trimming — surrounding whitespace doesn't count toward the limit", () => {
    const padded = `  ${"B".repeat(MAX_SHIP_NAME_LENGTH + 5)}  `;
    const next = tick(world0, [{ kind: "renameShip", shipId, name: padded }]);
    expect(ship(next).name).toBe("B".repeat(MAX_SHIP_NAME_LENGTH));
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
    const b = run();
    expect(a).toEqual(b);
    expect(a.tick).toBe(5000);
    expect(JSON.parse(JSON.stringify(a))).toEqual(a); // mid-session save round-trip
    // Byte-equal Ledger (docs/specs/E9 — Testing: determinism): same seed +
    // same commands ⇒ the serialized event stream is identical, not just
    // deep-equal — a stricter check that catches key-order/undefined drift
    // JSON.stringify would otherwise hide.
    expect(JSON.stringify(a.ledger)).toBe(JSON.stringify(b.ledger));
    expect(a.ledger.length).toBeGreaterThan(0);
  });
});

describe("acceptContract command (#94)", () => {
  it("rejects an unknown offerId, leaving the world unchanged", () => {
    const w = contractWorld("no-offer", 5000, "agrarian", 0);
    const next = applyCommand(w, { kind: "acceptContract", offerId: "missing" });
    expect(next).toEqual(w);
  });

  it("rejects when not enrolled in the offering guild, leaving the world unchanged", () => {
    const offer = sampleOffer();
    let w = contractWorld("not-enrolled", 5000, "urban", 0); // enrolled elsewhere
    w = { ...w, contractOffers: [offer] };
    const next = applyCommand(w, { kind: "acceptContract", offerId: offer.id });
    expect(next).toEqual(w);
  });

  it("rejects when enrolled but below the offer's tier, leaving the world unchanged", () => {
    const offer = sampleOffer({ tier: 2 });
    let w = contractWorld("low-rank", 5000, "agrarian", 0); // rank 1
    w = { ...w, contractOffers: [offer] };
    const next = applyCommand(w, { kind: "acceptContract", offerId: offer.id });
    expect(next).toEqual(w);
  });

  it("accepts when enrolled and rank meets the tier: contract added, offer removed from the board, no Ledger event", () => {
    const offer = sampleOffer({ tier: 1 });
    let w = contractWorld("happy-accept", 5000, "agrarian", 0);
    w = { ...w, contractOffers: [offer] };
    const next = applyCommand(w, { kind: "acceptContract", offerId: offer.id });
    expect(next.contractOffers).toEqual([]);
    expect(next.company.contracts).toHaveLength(1);
    const contract = next.company.contracts[0] as ActiveContract;
    expect(contract).toMatchObject({
      ...offer,
      startTick: w.tick,
      periodIndex: 0,
      deliveredThisPeriod: 0,
      consecutiveMisses: 0,
    });
    expect(next.ledger).toEqual(w.ledger);
  });

  it("higher rank than required still qualifies", () => {
    const offer = sampleOffer({ tier: 1 });
    let w = contractWorld("high-rank", 5000, "agrarian", RANK_THRESHOLDS[3]); // rank 4
    w = { ...w, contractOffers: [offer] };
    const next = applyCommand(w, { kind: "acceptContract", offerId: offer.id });
    expect(next.company.contracts).toHaveLength(1);
  });

  it("rejects re-accepting an offer already active as a contract (drops unchanged)", () => {
    const offer = sampleOffer({ tier: 1 });
    let w = contractWorld("dup-accept", 5000, "agrarian", 0);
    w = { ...w, contractOffers: [offer] };
    const once = applyCommand(w, { kind: "acceptContract", offerId: offer.id });
    // Same offer id reappears on the board (a fresh generation cycle) while
    // the contract is still active — acceptance must still drop, never
    // duplicate the active contract.
    const withOfferBack = { ...once, contractOffers: [offer] };
    const twice = applyCommand(withOfferBack, { kind: "acceptContract", offerId: offer.id });
    expect(twice).toEqual(withOfferBack);
  });
});

describe("resignContract command (#94)", () => {
  it("rejects an unknown contractId, leaving the world unchanged", () => {
    const w = contractWorld("no-contract", 5000, "agrarian", 0);
    const next = applyCommand(w, { kind: "resignContract", contractId: "missing" });
    expect(next).toEqual(w);
  });

  it("removes the contract and applies POINTS_BREACH_OR_RESIGN (-3), floored at 0, any time", () => {
    const offer = sampleOffer({ tier: 1 });
    let w = contractWorld("resign", 5000, "agrarian", 5);
    w = { ...w, contractOffers: [offer] };
    const accepted = applyCommand(w, { kind: "acceptContract", offerId: offer.id });
    const contractId = accepted.company.contracts[0].id;
    const resigned = applyCommand(accepted, { kind: "resignContract", contractId });
    expect(resigned.company.contracts).toEqual([]);
    expect(resigned.company.guilds.agrarian).toEqual({ points: 2 }); // 5 - 3
  });

  it("floors at 0 when points would go negative", () => {
    const offer = sampleOffer({ tier: 1 });
    let w = contractWorld("resign-floor", 5000, "agrarian", 1);
    w = { ...w, contractOffers: [offer] };
    const accepted = applyCommand(w, { kind: "acceptContract", offerId: offer.id });
    const contractId = accepted.company.contracts[0].id;
    const resigned = applyCommand(accepted, { kind: "resignContract", contractId });
    expect(resigned.company.guilds.agrarian).toEqual({ points: 0 });
  });

  it("emits a settlement(resigned, -3) Ledger event — the audit trail must carry termination too", () => {
    const offer = sampleOffer({ tier: 1 });
    let w = contractWorld("resign-ledger", 5000, "agrarian", 5);
    w = { ...w, contractOffers: [offer] };
    const accepted = applyCommand(w, { kind: "acceptContract", offerId: offer.id });
    const contractId = accepted.company.contracts[0].id;
    const resigned = applyCommand(accepted, { kind: "resignContract", contractId });
    expect(resigned.ledger.length).toBe(accepted.ledger.length + 1);
    expect(resigned.ledger[resigned.ledger.length - 1]).toMatchObject({
      kind: "settlement",
      contractId,
      guildId: "agrarian",
      outcome: "resigned",
      pointsDelta: -3,
    });
  });
});

describe("sale attribution to active contracts — the E9 equivalence guarantee (#94)", () => {
  it("manual sell of the contracted good at the contracted port increments deliveredThisPeriod", () => {
    let w = contractWorld("manual-sell", 5000, "agrarian", 0);
    const portId = w.region.ports[0].id;
    const offer = sampleOffer({ portId, good: "grain", tier: 1 });
    w = { ...w, contractOffers: [offer] };
    const accepted = applyCommand(w, { kind: "acceptContract", offerId: offer.id });

    // Move the ship to the contracted port and give it cargo to sell.
    const shipId = accepted.company.ships[0].id;
    const withCargoAtPort: World = {
      ...accepted,
      company: {
        ...accepted.company,
        ships: accepted.company.ships.map((s) =>
          s.id === shipId
            ? { ...s, cargo: { ...s.cargo, grain: 10 }, location: { kind: "docked", portId } }
            : s,
        ),
      },
    };
    const sold = applyCommand(withCargoAtPort, { kind: "sell", shipId, good: "grain", qty: 10 });
    expect(sold.company.contracts[0].deliveredThisPeriod).toBe(10);
  });

  it("sale of a different good at the contracted port never counts", () => {
    let w = contractWorld("wrong-good", 5000, "agrarian", 0);
    const portId = w.region.ports[0].id;
    const offer = sampleOffer({ portId, good: "grain", tier: 1 });
    w = { ...w, contractOffers: [offer] };
    const accepted = applyCommand(w, { kind: "acceptContract", offerId: offer.id });
    const shipId = accepted.company.ships[0].id;
    const withCargoAtPort: World = {
      ...accepted,
      company: {
        ...accepted.company,
        ships: accepted.company.ships.map((s) =>
          s.id === shipId
            ? {
                ...s,
                cargo: { ...s.cargo, textiles: 10 },
                location: { kind: "docked", portId },
              }
            : s,
        ),
      },
    };
    const sold = applyCommand(withCargoAtPort, { kind: "sell", shipId, good: "textiles", qty: 10 });
    expect(sold.company.contracts[0].deliveredThisPeriod).toBe(0);
  });

  it("sale of the contracted good at a different port never counts", () => {
    let w = contractWorld("wrong-port", 5000, "agrarian", 0);
    const portId = w.region.ports[0].id;
    const elsewhereId = w.region.ports[1].id;
    const offer = sampleOffer({ portId, good: "grain", tier: 1 });
    w = { ...w, contractOffers: [offer] };
    const accepted = applyCommand(w, { kind: "acceptContract", offerId: offer.id });
    const shipId = accepted.company.ships[0].id;
    const withCargoAtPort: World = {
      ...accepted,
      company: {
        ...accepted.company,
        ships: accepted.company.ships.map((s) =>
          s.id === shipId
            ? {
                ...s,
                cargo: { ...s.cargo, grain: 10 },
                location: { kind: "docked", portId: elsewhereId },
              }
            : s,
        ),
      },
    };
    const sold = applyCommand(withCargoAtPort, { kind: "sell", shipId, good: "grain", qty: 10 });
    expect(sold.company.contracts[0].deliveredThisPeriod).toBe(0);
  });

  it("routed sale (route dispatch's same sell command) counts identically to a manual sale", () => {
    let w = contractWorld("routed-sell", 5000, "agrarian", 0);
    const portId = w.region.ports[0].id;
    const offer = sampleOffer({ portId, good: "grain", tier: 1 });
    w = { ...w, contractOffers: [offer] };
    const accepted = applyCommand(w, { kind: "acceptContract", offerId: offer.id });
    const shipId = accepted.company.ships[0].id;
    const withCargoAtPort: World = {
      ...accepted,
      company: {
        ...accepted.company,
        ships: accepted.company.ships.map((s) =>
          s.id === shipId
            ? { ...s, cargo: { ...s.cargo, grain: 10 }, location: { kind: "docked", portId } }
            : s,
        ),
      },
    };
    const manual = applyCommand(withCargoAtPort, { kind: "sell", shipId, good: "grain", qty: 10 });
    const routed = applyCommand(withCargoAtPort, {
      kind: "sell",
      shipId,
      good: "grain",
      qty: 10,
      routeId: "r0",
    });
    expect(routed.company.contracts[0].deliveredThisPeriod).toBe(
      manual.company.contracts[0].deliveredThisPeriod,
    );
  });
});

describe("contract settlement at the day boundary (#94)", () => {
  it("quota met: fee paid, +1 point, contractFee + settlement(met) Ledger events, contract continues", () => {
    let w = contractWorld("settle-met", 5000, "agrarian", 0);
    const shipId0 = w.company.ships[0].id;
    const portId = w.region.ports[0].id;
    const offer = sampleOffer({
      portId,
      good: "grain",
      tier: 1,
      quotaPerPeriod: 10,
      periodDays: 1, // 1 day period for a fast test
      feePerPeriod: 200,
    });
    w = { ...w, contractOffers: [offer] };
    let accepted = applyCommand(w, { kind: "acceptContract", offerId: offer.id });
    accepted = {
      ...accepted,
      company: {
        ...accepted.company,
        ships: accepted.company.ships.map((s) =>
          s.id === shipId0
            ? { ...s, cargo: { ...s.cargo, grain: 10 }, location: { kind: "docked", portId } }
            : s,
        ),
      },
    };
    const sold = applyCommand(accepted, { kind: "sell", shipId: shipId0, good: "grain", qty: 10 });

    let world = sold;
    for (let i = 0; i < TICKS_PER_DAY; i++) world = tick(world, []);

    // One ship's daily upkeep is charged before settlement in the same
    // boundary (spec order: upkeep → contract settlements).
    expect(world.company.thalers).toBe(sold.company.thalers - UPKEEP_PER_DAY + offer.feePerPeriod);
    expect(world.company.guilds.agrarian).toEqual({ points: 1 });
    const contractFeeEvents = world.ledger.filter((e) => e.kind === "contractFee");
    expect(contractFeeEvents).toHaveLength(1);
    expect(contractFeeEvents[0]).toMatchObject({
      kind: "contractFee",
      guildId: "agrarian",
      contractId: offer.id,
      thalers: offer.feePerPeriod,
    });
    const settlementEvents = world.ledger.filter((e) => e.kind === "settlement");
    expect(settlementEvents).toHaveLength(1);
    expect(settlementEvents[0]).toMatchObject({
      kind: "settlement",
      contractId: offer.id,
      guildId: "agrarian",
      outcome: "met",
      pointsDelta: 1,
    });
    expect(world.company.contracts).toHaveLength(1);
    expect(world.company.contracts[0].periodIndex).toBe(1);
    expect(world.company.contracts[0].deliveredThisPeriod).toBe(0);
    expect(world.company.contracts[0].consecutiveMisses).toBe(0);
  });

  it("quota missed: no fee, -1 point, settlement(missed) Ledger event, contract continues", () => {
    let w = contractWorld("settle-missed", 5000, "agrarian", 3);
    const offer = sampleOffer({
      portId: w.region.ports[0].id,
      good: "grain",
      tier: 1,
      quotaPerPeriod: 10,
      periodDays: 1,
      feePerPeriod: 200,
    });
    w = { ...w, contractOffers: [offer] };
    const accepted = applyCommand(w, { kind: "acceptContract", offerId: offer.id });

    let world = accepted; // never deliver anything this period
    for (let i = 0; i < TICKS_PER_DAY; i++) world = tick(world, []);

    expect(world.company.thalers).toBe(accepted.company.thalers - UPKEEP_PER_DAY);
    expect(world.company.guilds.agrarian).toEqual({ points: 2 }); // 3 - 1
    expect(world.ledger.filter((e) => e.kind === "contractFee")).toEqual([]);
    const settlementEvents = world.ledger.filter((e) => e.kind === "settlement");
    expect(settlementEvents).toHaveLength(1);
    expect(settlementEvents[0]).toMatchObject({
      kind: "settlement",
      contractId: offer.id,
      guildId: "agrarian",
      outcome: "missed",
      pointsDelta: -1,
    });
    expect(world.company.contracts).toHaveLength(1);
    expect(world.company.contracts[0].consecutiveMisses).toBe(1);
  });

  it("two consecutive misses: guild terminates the contract (breach, additional -3)", () => {
    let w = contractWorld("settle-breach", 5000, "agrarian", 5);
    const offer = sampleOffer({
      portId: w.region.ports[0].id,
      good: "grain",
      tier: 1,
      quotaPerPeriod: 10,
      periodDays: 1,
      feePerPeriod: 200,
    });
    w = { ...w, contractOffers: [offer] };
    const accepted = applyCommand(w, { kind: "acceptContract", offerId: offer.id });

    let world = accepted;
    for (let i = 0; i < TICKS_PER_DAY; i++) world = tick(world, []); // miss 1: 5-1=4
    expect(world.company.contracts).toHaveLength(1);
    // miss 2 -> breach: the breach penalty REPLACES this period's miss
    // penalty (owner decision — parity with resignContract's same -3 cost,
    // not additive): 4 + POINTS_BREACH_OR_RESIGN(-3) = 1, not 4-1-3=0.
    for (let i = 0; i < TICKS_PER_DAY; i++) world = tick(world, []);

    expect(world.company.contracts).toEqual([]);
    expect(world.company.guilds.agrarian).toEqual({ points: 1 });
    const settlementEvents = world.ledger.filter((e) => e.kind === "settlement");
    expect(settlementEvents).toHaveLength(2);
    expect(settlementEvents[1]).toMatchObject({ outcome: "breached", pointsDelta: -3 });
  });

  it("settlement math is recomputable from trade events alone (audit trail)", () => {
    let w = contractWorld("settle-recompute", 5000, "agrarian", 0);
    const shipId0 = w.company.ships[0].id;
    const portId = w.region.ports[0].id;
    const offer = sampleOffer({
      portId,
      good: "grain",
      tier: 1,
      quotaPerPeriod: 10,
      periodDays: 1,
      feePerPeriod: 200,
    });
    w = { ...w, contractOffers: [offer] };
    let accepted = applyCommand(w, { kind: "acceptContract", offerId: offer.id });
    accepted = {
      ...accepted,
      company: {
        ...accepted.company,
        ships: accepted.company.ships.map((s) =>
          s.id === shipId0
            ? { ...s, cargo: { ...s.cargo, grain: 12 }, location: { kind: "docked", portId } }
            : s,
        ),
      },
    };
    const sold = applyCommand(accepted, { kind: "sell", shipId: shipId0, good: "grain", qty: 12 });

    let world = sold;
    for (let i = 0; i < TICKS_PER_DAY; i++) world = tick(world, []);

    const acceptTick = accepted.tick;
    const deliveredFromTrades = world.ledger
      .filter(
        (e) =>
          e.kind === "trade" &&
          e.side === "sell" &&
          e.portId === offer.portId &&
          e.good === offer.good &&
          e.tick >= acceptTick,
      )
      .reduce((sum, e) => sum + (e as { qty: number }).qty, 0);
    expect(deliveredFromTrades).toBe(12);
    expect(deliveredFromTrades).toBeGreaterThanOrEqual(offer.quotaPerPeriod);
    const settlementEvent = world.ledger.find((e) => e.kind === "settlement")!;
    expect(settlementEvent).toMatchObject({ outcome: "met" });
  });

  it("save/load round-trips an active Company.contracts entry via a JSON round-trip", () => {
    let w = contractWorld("contract-roundtrip", 5000, "agrarian", 0);
    const offer = sampleOffer({ portId: w.region.ports[0].id, good: "grain", tier: 1 });
    w = { ...w, contractOffers: [offer] };
    const accepted = applyCommand(w, { kind: "acceptContract", offerId: offer.id });
    expect(accepted.company.contracts).toHaveLength(1);
    expect(JSON.parse(JSON.stringify(accepted))).toEqual(accepted);
  });

  it("determinism: same seed + same command script (incl. enroll/accept/resign) ⇒ byte-equal Ledger", () => {
    const run = () => {
      let w = contractWorld("contract-ledger-determinism", 5000, "agrarian", 0);
      const portId = w.region.ports[0].id;
      const offer = sampleOffer({
        portId,
        good: "grain",
        tier: 1,
        quotaPerPeriod: 10,
        periodDays: 1,
        feePerPeriod: 200,
      });
      w = { ...w, contractOffers: [offer] };
      let world = applyCommand(w, { kind: "acceptContract", offerId: offer.id });
      const shipId = world.company.ships[0].id;
      world = {
        ...world,
        company: {
          ...world.company,
          ships: world.company.ships.map((s) =>
            s.id === shipId
              ? { ...s, cargo: { ...s.cargo, grain: 10 }, location: { kind: "docked", portId } }
              : s,
          ),
        },
      };
      world = applyCommand(world, { kind: "sell", shipId, good: "grain", qty: 10 });
      for (let i = 0; i < TICKS_PER_DAY; i++) world = tick(world, []); // settles: met, +1 point
      const contractId = world.company.contracts[0].id;
      world = applyCommand(world, { kind: "resignContract", contractId });
      return world;
    };
    const a = run();
    const b = run();
    expect(JSON.stringify(a.ledger)).toBe(JSON.stringify(b.ledger));
    expect(a.ledger.some((e) => e.kind === "contractFee")).toBe(true);
    expect(a.ledger.some((e) => e.kind === "settlement")).toBe(true);
  });

  it("invariant: summing settlement.pointsDelta over a script (met, missed, breach, resign) reproduces the guild's actual points (wave-check finding — the undercount bug)", () => {
    // First contract: run to breach (miss, miss -> breached, replacing the
    // second miss's own -1, per the owner's parity decision).
    let w = contractWorld("points-invariant", 5000, "agrarian", 0);
    const offerA = sampleOffer({
      id: "agrarian:a:grain",
      portId: w.region.ports[0].id,
      good: "grain",
      tier: 1,
      quotaPerPeriod: 10,
      periodDays: 1,
      feePerPeriod: 200,
    });
    w = { ...w, contractOffers: [offerA] };
    let world = applyCommand(w, { kind: "acceptContract", offerId: offerA.id });
    for (let i = 0; i < TICKS_PER_DAY; i++) world = tick(world, []); // miss -> -1
    for (let i = 0; i < TICKS_PER_DAY; i++) world = tick(world, []); // miss -> breached -3

    // Second contract, same guild: met once (+1), then resigned (-3).
    const portId = world.region.ports[0].id;
    const offerB = sampleOffer({
      id: "agrarian:b:grain",
      portId,
      good: "grain",
      tier: 1,
      quotaPerPeriod: 10,
      periodDays: 1,
      feePerPeriod: 200,
    });
    world = { ...world, contractOffers: [offerB] };
    world = applyCommand(world, { kind: "acceptContract", offerId: offerB.id });
    const shipId = world.company.ships[0].id;
    world = {
      ...world,
      company: {
        ...world.company,
        ships: world.company.ships.map((s) =>
          s.id === shipId
            ? { ...s, cargo: { ...s.cargo, grain: 10 }, location: { kind: "docked", portId } }
            : s,
        ),
      },
    };
    world = applyCommand(world, { kind: "sell", shipId, good: "grain", qty: 10 });
    for (let i = 0; i < TICKS_PER_DAY; i++) world = tick(world, []); // met -> +1
    const contractIdB = world.company.contracts[0].id;
    world = applyCommand(world, { kind: "resignContract", contractId: contractIdB }); // -3

    const summedDelta = world.ledger
      .filter((e) => e.kind === "settlement" && e.guildId === "agrarian")
      .reduce((sum, e) => sum + (e as { pointsDelta: number }).pointsDelta, 0);
    // Raw sum (unfloored): -1 -3 +1 -3 = -6; actual stored points floor at 0
    // after each individual delta (guild.ts — "floor at 0"), so the two can
    // only be compared once the same floor-at-0-per-step folding is applied.
    let folded = 0;
    for (const e of world.ledger) {
      if (e.kind === "settlement" && e.guildId === "agrarian") {
        folded = Math.max(0, folded + e.pointsDelta);
      }
    }
    expect(folded).toBe(world.company.guilds.agrarian!.points);
    expect(summedDelta).toBe(-6); // sanity: the raw sum this invariant is folding
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
