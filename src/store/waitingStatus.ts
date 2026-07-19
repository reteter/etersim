import { GOODS, type WaitingGate } from "../sim";

/** *"czeka na marżę ≥ X (teraz Y)"* (CONTEXT.md — Margin Gate, ADR-0007): the
 *  one required-by-spec player-facing string. Prefixes the good's name when
 *  more than one gate is holding the same Stop (v1's atomic wait). The gates
 *  themselves are derived by `waitingGates` (src/sim/waiting.ts, pure sim
 *  logic) — this file is the store-side formatter only. */
export function formatWaitingGates(gates: readonly WaitingGate[]): string {
  const multi = gates.length > 1;
  return gates
    .map((g) => {
      const live = g.liveMargin === null ? "—" : `₸${g.liveMargin}`;
      const line = `czeka na marżę ≥ ₸${g.minMargin} (teraz ${live})`;
      return multi ? `${GOODS[g.good].name}: ${line}` : line;
    })
    .join("; ");
}
