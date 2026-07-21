import { describe, expect, it } from "vitest";
import tickSource from "./tick.ts?raw";
import { DAY_BOUNDARY_PHASES } from "./tick";

/**
 * E13.0 (#306, docs/specs/E13.0-goods-store.md §Testing, C4) — phase order is
 * semantically load-bearing (Professor F3): the tick site-runner sequence
 * (HQ build site, Shipyard construction, guild-building construction, then
 * Refit — all drawing from the same shared purse) and `DAY_BOUNDARY_PHASES` must
 * both stay pinned as ordered string arrays, so a future edit that
 * accidentally reorders either is caught at the structural level, not just
 * (or not at all, if the reorder happens not to perturb C1's scripted
 * scenario) behaviorally.
 */

/** The four site-runner call sites inside `tick()` (`tick.ts`), in the exact
 *  literal order they're invoked. Extracted from source text (imported via
 *  Vite's `?raw` — no Node `fs`; this project has no `@types/node` and is
 *  browser-only, CLAUDE.md) rather than by runtime instrumentation:
 *  `runDockingPhase` is a module-private helper (not exported, and #306 is
 *  tests-only — no production export may be added to observe it), and
 *  Vitest's ESM transform makes `vi.spyOn` on live-binding named imports
 *  unreliable for this. A literal call-site scan is a faithful, non-invasive
 *  proxy for "the order these four run in": each pattern below (`= runX(`)
 *  appears exactly once in the file, at its one real call site — the
 *  identifiers also appear in the `import { ... }` lines at the top, but
 *  never followed by `= name(`, so those don't collide. Asserted with an
 *  "each found exactly once" pre-check so a rename (which would otherwise
 *  vanish silently, since a missing substring's `indexOf` result of -1 sorts
 *  first) fails loudly instead of reordering unnoticed. */
const SITE_RUNNERS = [
  "runDockingPhase",
  "runBuildSiteAutoDraw",
  "runShipyardConstructionAutoDraw",
  "runGuildBuildAutoDraw",
  "runShipyardAutoDraw",
] as const;

function actualSiteRunnerOrder(source: string): string[] {
  const found = SITE_RUNNERS.map((name) => {
    const pattern = `= ${name}(`;
    const first = source.indexOf(pattern);
    const last = source.lastIndexOf(pattern);
    if (first === -1) throw new Error(`e13-0-phase-order: call site for ${name} not found in tick.ts`);
    if (first !== last) throw new Error(`e13-0-phase-order: call site for ${name} is not unique in tick.ts`);
    return { name, index: first };
  });
  return found.sort((a, b) => a.index - b.index).map((r) => r.name);
}

describe("E13.0 phase-order snapshot (#306, spec C4)", () => {
  it("tick's site-runner sequence pins guild-building construction before Refit", () => {
    expect(actualSiteRunnerOrder(tickSource)).toEqual([
      "runDockingPhase",
      "runBuildSiteAutoDraw",
      "runShipyardConstructionAutoDraw",
      "runGuildBuildAutoDraw",
      "runShipyardAutoDraw",
    ]);
  });

  it("DAY_BOUNDARY_PHASES runs drift -> priceSnapshot -> upkeep -> settleContracts -> refreshOffers -> netWorth", () => {
    expect(DAY_BOUNDARY_PHASES.map((phase) => phase.name)).toEqual([
      "drift",
      "priceSnapshot",
      "upkeep",
      "settleContracts",
      "refreshOffers",
      "netWorth",
    ]);
  });
});
