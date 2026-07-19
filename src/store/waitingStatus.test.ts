import { describe, expect, it } from "vitest";
import type { WaitingGate } from "../sim";
import { formatWaitingGates } from "./waitingStatus";

/** *"czeka na marżę ≥ X (teraz Y)"* (CONTEXT.md — Margin Gate, ADR-0007):
 *  the one required-by-spec player-facing string. Derivation of the gates
 *  themselves (waitingGates) is pure sim logic, tested in
 *  src/sim/waiting.test.ts — these tests exercise the formatter in
 *  isolation with hand-built WaitingGate literals. */
describe("formatWaitingGates", () => {
  it("formats a single gate with a live margin", () => {
    const gates: WaitingGate[] = [{ good: "grain", minMargin: 1, liveMargin: 5 }];
    expect(formatWaitingGates(gates)).toBe("czeka na marżę ≥ ₸1 (teraz ₸5)");
  });

  it("renders a null live margin as \"—\"", () => {
    const gates: WaitingGate[] = [{ good: "grain", minMargin: 1, liveMargin: null }];
    expect(formatWaitingGates(gates)).toBe("czeka na marżę ≥ ₸1 (teraz —)");
  });

  it("prefixes each line with the good's name when several gates hold the same Stop, joined by \"; \"", () => {
    const gates: WaitingGate[] = [
      { good: "grain", minMargin: 1, liveMargin: 5 },
      { good: "textiles", minMargin: 2, liveMargin: null },
    ];
    const text = formatWaitingGates(gates);
    expect(text).toBe("Grain: czeka na marżę ≥ ₸1 (teraz ₸5); Textiles: czeka na marżę ≥ ₸2 (teraz —)");
  });

  it("returns an empty string for no gates", () => {
    expect(formatWaitingGates([])).toBe("");
  });
});
