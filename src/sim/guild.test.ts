import { describe, expect, it } from "vitest";
import { CONSTRUCTION_RESERVE, HEADQUARTERS_COST } from "./building";
import { applyCommand } from "./commands";
import {
  ENROLLMENT_FEE,
  GUILDS,
  POINTS_BREACH_OR_RESIGN,
  POINTS_MISSED,
  POINTS_SETTLED,
  RANK_THRESHOLDS,
  rankOf,
  type GuildId,
} from "./guild";
import { ARCHETYPE_PROFILES, ECONOMIC_ARCHETYPES } from "./region";
import { tick } from "./tick";
import { createWorld, type World } from "./world";

/** World with a founded HQ at ports[0] and exactly `thalers` in the purse
 *  afterward — the precondition for enrollment (spec: "companies deal with
 *  guilds"). Founds with ample funds (never dipping the Reserve, #122), then
 *  sets the purse directly to the exact test fixture value — the founding
 *  Reserve rule is #81's concern, not this fixture's. */
function foundedWorld(seedStr: string, thalers: number): World {
  const w = createWorld(seedStr);
  const rich: World = {
    ...w,
    company: { ...w.company, thalers: HEADQUARTERS_COST + CONSTRUCTION_RESERVE + 10_000 },
  };
  const founded = applyCommand(rich, { kind: "foundHeadquarters", portId: rich.region.ports[0].id });
  return { ...founded, company: { ...founded.company, thalers } };
}

describe("GUILDS (#92)", () => {
  it("has exactly the five economic archetypes as keys, each domain matching ARCHETYPE_PROFILES production", () => {
    const keys = Object.keys(GUILDS).sort();
    expect(keys.sort()).toEqual([...ECONOMIC_ARCHETYPES].sort());
    for (const archetype of ECONOMIC_ARCHETYPES) {
      const domain = GUILDS[archetype].domain;
      expect(ARCHETYPE_PROFILES[archetype].productionPerDay[domain]).toBeGreaterThan(0);
    }
  });

  it("matches the spec's working-name table", () => {
    expect(GUILDS.agrarian.name).toBe("Granary Guild");
    expect(GUILDS.urban.name).toBe("Weavers' Assembly");
    expect(GUILDS.mining.name).toBe("Saltworkers' Brotherhood");
    expect(GUILDS.industrial.name).toBe("Foundry League");
    expect(GUILDS.verdant.name).toBe("Livingwood Consortium");
  });
});

describe("rankOf (#92 — ranks derived, never stored)", () => {
  it("is monotonic and matches RANK_THRESHOLDS exactly at each boundary", () => {
    expect(RANK_THRESHOLDS).toEqual([0, 4, 10, 18]);
    expect(rankOf(0)).toBe(1);
    expect(rankOf(3)).toBe(1);
    expect(rankOf(4)).toBe(2);
    expect(rankOf(9)).toBe(2);
    expect(rankOf(10)).toBe(3);
    expect(rankOf(17)).toBe(3);
    expect(rankOf(18)).toBe(4);
    expect(rankOf(100)).toBe(4);
  });

  it("floors negative points at 0 (rank never below 1)", () => {
    expect(rankOf(-1)).toBe(1);
    expect(rankOf(-100)).toBe(1);
  });
});

describe("enroll command (#92)", () => {
  const guildId: GuildId = "agrarian";

  it("rejects without a founded Headquarters, leaving the world unchanged", () => {
    const w = createWorld("no-hq");
    expect(w.company.headquarters).toBeUndefined();
    const next = applyCommand(w, { kind: "enroll", guildId });
    expect(next).toEqual(w);
  });

  it("rejects when unaffordable (purse < ENROLLMENT_FEE), leaving the world unchanged", () => {
    const w = foundedWorld("poor", ENROLLMENT_FEE - 1);
    const next = applyCommand(w, { kind: "enroll", guildId });
    expect(next).toEqual(w);
  });

  it("is NOT Reserve-gated: purse == ENROLLMENT_FEE exactly is affordable (deliberate, spec-mandated)", () => {
    const w = foundedWorld("exact", ENROLLMENT_FEE);
    const next = applyCommand(w, { kind: "enroll", guildId });
    expect(next.company.thalers).toBe(0);
    expect(next.company.guilds[guildId]).toEqual({ points: 0 });
  });

  it("rejects when already enrolled in that guild, leaving the world unchanged", () => {
    const w = foundedWorld("twice", ENROLLMENT_FEE * 2 + 1000);
    const enrolled = applyCommand(w, { kind: "enroll", guildId });
    const again = applyCommand(enrolled, { kind: "enroll", guildId });
    expect(again).toEqual(enrolled);
  });

  it("happy path: deducts the fee, grants rank 1 (points 0), appends one enrollmentFee event", () => {
    const w = foundedWorld("happy", ENROLLMENT_FEE + 1000);
    const next = applyCommand(w, { kind: "enroll", guildId });
    expect(next.company.thalers).toBe(w.company.thalers - ENROLLMENT_FEE);
    expect(next.company.guilds[guildId]).toEqual({ points: 0 });
    expect(rankOf(next.company.guilds[guildId]!.points)).toBe(1);
    expect(next.ledger.length).toBe(w.ledger.length + 1);
    expect(next.ledger[next.ledger.length - 1]).toEqual({
      kind: "enrollmentFee",
      tick: w.tick,
      guildId,
    });
  });

  it("enrolling in a second guild leaves the first guild's standing untouched", () => {
    const w = foundedWorld("second-guild", ENROLLMENT_FEE * 2 + 1000);
    const first = applyCommand(w, { kind: "enroll", guildId: "agrarian" });
    const second = applyCommand(first, { kind: "enroll", guildId: "urban" });
    expect(second.company.guilds.agrarian).toEqual({ points: 0 });
    expect(second.company.guilds.urban).toEqual({ points: 0 });
  });

  it("determinism (ADR-0005): applyCommand(w, enroll) then tick(w', []) equals tick(w, [enroll])", () => {
    const w = foundedWorld("adr0005", ENROLLMENT_FEE + 1000);
    const applied = applyCommand(w, { kind: "enroll", guildId });
    const stepped = tick(applied, []);
    const combined = tick(w, [{ kind: "enroll", guildId }]);
    expect(stepped).toEqual(combined);
  });

  it("save/load round-trips Company.guilds via a JSON round-trip", () => {
    const w = foundedWorld("roundtrip", ENROLLMENT_FEE + 1000);
    const enrolled = applyCommand(w, { kind: "enroll", guildId });
    expect(JSON.parse(JSON.stringify(enrolled))).toEqual(enrolled);
  });
});

describe("point deltas (#92 — named constants, consumed by later issues)", () => {
  it("are exactly +1 / -1 / -3", () => {
    expect(POINTS_SETTLED).toBe(1);
    expect(POINTS_MISSED).toBe(-1);
    expect(POINTS_BREACH_OR_RESIGN).toBe(-3);
  });
});
