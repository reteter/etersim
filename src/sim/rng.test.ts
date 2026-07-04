import { describe, expect, it } from "vitest";
import { nextFloat, nextInt, nextShuffle, nextUint32, seedRng, type RngState } from "./rng";

describe("seeded RNG", () => {
  it("produces an identical sequence for an identical seed", () => {
    const drawSequence = (seed: number): number[] => {
      let state = seedRng(seed);
      const values: number[] = [];
      for (let i = 0; i < 100; i++) {
        const [value, next] = nextUint32(state);
        values.push(value);
        state = next;
      }
      return values;
    };

    expect(drawSequence(42)).toEqual(drawSequence(42));
  });

  it("produces different sequences for different seeds", () => {
    const [a] = nextUint32(seedRng(1));
    const [b] = nextUint32(seedRng(2));
    expect(a).not.toBe(b);
  });

  it("is pure: drawing from the same state twice yields the same result", () => {
    const state = seedRng(7);
    expect(nextUint32(state)).toEqual(nextUint32(state));
  });

  it("decorrelates consecutive integer seeds", () => {
    // Raw counter-based PRNGs often start near-identical for seeds 1,2,3…
    // seedRng must scramble the seed so first draws differ meaningfully.
    const firstDraws = new Set<number>();
    for (let seed = 0; seed < 50; seed++) {
      const [value] = nextUint32(seedRng(seed));
      firstDraws.add(value);
    }
    expect(firstDraws.size).toBe(50);
  });

  it("nextFloat stays within [0, 1)", () => {
    let state: RngState = seedRng(123);
    for (let i = 0; i < 1000; i++) {
      const [value, next] = nextFloat(state);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
      state = next;
    }
  });

  it("nextInt stays within inclusive bounds and hits both ends", () => {
    let state: RngState = seedRng(9);
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i++) {
      const [value, next] = nextInt(state, 3, 6);
      expect(value).toBeGreaterThanOrEqual(3);
      expect(value).toBeLessThanOrEqual(6);
      expect(Number.isInteger(value)).toBe(true);
      seen.add(value);
      state = next;
    }
    expect(seen).toEqual(new Set([3, 4, 5, 6]));
  });

  it("nextShuffle permutes without mutating and is seed-deterministic", () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const frozen = [...input];
    const [shuffledA] = nextShuffle(seedRng(5), input);
    const [shuffledB] = nextShuffle(seedRng(5), input);
    expect(input).toEqual(frozen);
    expect(shuffledA).toEqual(shuffledB);
    expect([...shuffledA].sort((a, b) => a - b)).toEqual(frozen);
    expect(shuffledA).not.toEqual(frozen); // 1/8! chance of false alarm — fixed seed makes it stable
  });

  it("keeps state JSON-serializable (a plain number)", () => {
    const state = seedRng(2026);
    expect(typeof state).toBe("number");
    expect(JSON.parse(JSON.stringify(state))).toBe(state);
  });
});
