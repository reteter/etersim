import { describe, expect, it } from "vitest";
import { createWorld, ECONOMIC_ARCHETYPES } from "../../src/sim/index.ts";
import { runOne } from "../batch.ts";
import { resolvePolicy } from "./registry.ts";
import { greedyContractor } from "./greedyContractor.ts";

/**
 * greedyContractor — the bug-hunt reference policy (docs/experiments/README.md
 * §Bug-hunt mode, #234). Conformance + registry wiring; the actual
 * invariant-stress claim is validated by running it with
 * `--enable-assertions` (a Batch, not a unit test) — see the experiment
 * write-up this policy is committed alongside.
 */
describe("greedyContractor — the adversarial reference policy", () => {
  it("is registered and resolvable by name, taking no params", () => {
    const policy = resolvePolicy("greedyContractor", {});
    expect(policy.name).toBe("greedyContractor");
  });

  it("is not diagnostic (reads only player-visible guild roster and board offers)", () => {
    expect(greedyContractor.diagnostic).toBe(false);
  });

  it("issues an enroll command for every guild it has not yet joined, on the first tick", () => {
    const world = createWorld(1);
    const memory = greedyContractor.init(world);
    const step = greedyContractor.act(world, memory);

    const enrollCommands = step.commands.filter((c) => c.kind === "enroll");
    expect(enrollCommands).toHaveLength(ECONOMIC_ARCHETYPES.length);
    expect(new Set(enrollCommands.map((c) => c.guildId))).toEqual(new Set(ECONOMIC_ARCHETYPES));
  });

  it("issues no further enroll commands once every guild is joined", () => {
    const world = createWorld(1);
    const memory = greedyContractor.init(world);
    const enrolledWorld = {
      ...world,
      company: {
        ...world.company,
        guilds: Object.fromEntries(ECONOMIC_ARCHETYPES.map((g) => [g, { points: 0 }])),
      },
    };
    const step = greedyContractor.act(enrolledWorld, memory);
    expect(step.commands.filter((c) => c.kind === "enroll")).toHaveLength(0);
  });

  it("issues an acceptContract command for every open offer, whatever its rank or feasibility", () => {
    const world = createWorld(1);
    const memory = greedyContractor.init(world);
    const withOffers = {
      ...world,
      contractOffers: [
        {
          id: "test:offer:1",
          guildId: ECONOMIC_ARCHETYPES[0]!, // any real guild id — a "freeport" port has none
          portId: world.region.ports[0]!.id,
          good: "grain" as const,
          quotaPerPeriod: 1,
          periodDays: 1,
          minPeriods: 1,
          feePerPeriod: 1,
          tier: 4,
          requiredRank: 4, // unreachable rank — greedyContractor tries anyway.
          basis: { sourcePortId: world.region.ports[0]!.id, roundTripTicks: 10, expectedTrips: 2 },
        },
      ],
    };
    const step = greedyContractor.act(withOffers, memory);
    const acceptCommands = step.commands.filter((c) => c.kind === "acceptContract");
    expect(acceptCommands).toHaveLength(1);
    expect(acceptCommands[0]).toEqual({ kind: "acceptContract", offerId: "test:offer:1" });
  });

  it("runs a real Batch with assertions enabled without crashing the Run", () => {
    // The bug-hunt smoke test: this policy is adversarial toward guild
    // state, not toward the Run's own plumbing — it must still produce a
    // valid RunRecord over a real seed.
    const record = runOne("greedyContractor", {}, 1, 20, { enableAssertions: true });
    expect(record.ledger).toBeDefined();
    expect(Array.isArray(record.anomalies)).toBe(true);
  });
});
