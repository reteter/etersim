import { describe, expect, it } from "vitest";
import { TICKS_PER_DAY } from "./region";
import { tick } from "./tick";
import { createWorld } from "./world";

/** FNV-1a — a cheap, order-sensitive structural hash of the World's JSON
 *  representation, used only to pin the golden values below (not a
 *  production helper). */
function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Proof of behavior preservation for the #168 `dayBoundary(world)` extraction
 * (docs/specs/E3-contracts-and-guilds.md — Tick day-boundary order). These
 * golden values were captured from the pre-refactor inline day-boundary block
 * (drift step → price snapshots → netWorth snapshot) at src/sim/tick.ts:219-241
 * — 30 world days, no commands, three seeds (seed 1 included per the #115
 * lesson). If the refactor changes ordering or values in any way, either the
 * world hash or the Ledger JSON below will stop matching.
 */
describe("dayBoundary golden (behavior preservation, #168)", () => {
  const golden: Record<number, { worldHash: number; ledgerJson: string }> = {
    1: {
      worldHash: 3203657492,
      ledgerJson:
        '[{"kind":"netWorth","tick":24,"thalers":500,"cargoValue":0,"siteStoreValue":0,"total":500},{"kind":"netWorth","tick":48,"thalers":500,"cargoValue":0,"siteStoreValue":0,"total":500},{"kind":"netWorth","tick":72,"thalers":500,"cargoValue":0,"siteStoreValue":0,"total":500},{"kind":"netWorth","tick":96,"thalers":500,"cargoValue":0,"siteStoreValue":0,"total":500},{"kind":"netWorth","tick":120,"thalers":500,"cargoValue":0,"siteStoreValue":0,"total":500},{"kind":"netWorth","tick":144,"thalers":500,"cargoValue":0,"siteStoreValue":0,"total":500},{"kind":"netWorth","tick":168,"thalers":500,"cargoValue":0,"siteStoreValue":0,"total":500},{"kind":"netWorth","tick":192,"thalers":500,"cargoValue":0,"siteStoreValue":0,"total":500},{"kind":"netWorth","tick":216,"thalers":500,"cargoValue":0,"siteStoreValue":0,"total":500},{"kind":"netWorth","tick":240,"thalers":500,"cargoValue":0,"siteStoreValue":0,"total":500},{"kind":"netWorth","tick":264,"thalers":500,"cargoValue":0,"siteStoreValue":0,"total":500},{"kind":"netWorth","tick":288,"thalers":500,"cargoValue":0,"siteStoreValue":0,"total":500},{"kind":"netWorth","tick":312,"thalers":500,"cargoValue":0,"siteStoreValue":0,"total":500},{"kind":"netWorth","tick":336,"thalers":500,"cargoValue":0,"siteStoreValue":0,"total":500},{"kind":"netWorth","tick":360,"thalers":500,"cargoValue":0,"siteStoreValue":0,"total":500},{"kind":"netWorth","tick":384,"thalers":500,"cargoValue":0,"siteStoreValue":0,"total":500},{"kind":"netWorth","tick":408,"thalers":500,"cargoValue":0,"siteStoreValue":0,"total":500},{"kind":"netWorth","tick":432,"thalers":500,"cargoValue":0,"siteStoreValue":0,"total":500},{"kind":"netWorth","tick":456,"thalers":500,"cargoValue":0,"siteStoreValue":0,"total":500},{"kind":"netWorth","tick":480,"thalers":500,"cargoValue":0,"siteStoreValue":0,"total":500},{"kind":"netWorth","tick":504,"thalers":500,"cargoValue":0,"siteStoreValue":0,"total":500},{"kind":"netWorth","tick":528,"thalers":500,"cargoValue":0,"siteStoreValue":0,"total":500},{"kind":"netWorth","tick":552,"thalers":500,"cargoValue":0,"siteStoreValue":0,"total":500},{"kind":"netWorth","tick":576,"thalers":500,"cargoValue":0,"siteStoreValue":0,"total":500},{"kind":"netWorth","tick":600,"thalers":500,"cargoValue":0,"siteStoreValue":0,"total":500},{"kind":"netWorth","tick":624,"thalers":500,"cargoValue":0,"siteStoreValue":0,"total":500},{"kind":"netWorth","tick":648,"thalers":500,"cargoValue":0,"siteStoreValue":0,"total":500},{"kind":"netWorth","tick":672,"thalers":500,"cargoValue":0,"siteStoreValue":0,"total":500},{"kind":"netWorth","tick":696,"thalers":500,"cargoValue":0,"siteStoreValue":0,"total":500},{"kind":"netWorth","tick":720,"thalers":500,"cargoValue":0,"siteStoreValue":0,"total":500}]',
    },
    7: {
      worldHash: 2028601201,
      ledgerJson:
        '[{"kind":"netWorth","tick":24,"thalers":500,"cargoValue":0,"siteStoreValue":0,"total":500},{"kind":"netWorth","tick":48,"thalers":500,"cargoValue":0,"siteStoreValue":0,"total":500},{"kind":"netWorth","tick":72,"thalers":500,"cargoValue":0,"siteStoreValue":0,"total":500},{"kind":"netWorth","tick":96,"thalers":500,"cargoValue":0,"siteStoreValue":0,"total":500},{"kind":"netWorth","tick":120,"thalers":500,"cargoValue":0,"siteStoreValue":0,"total":500},{"kind":"netWorth","tick":144,"thalers":500,"cargoValue":0,"siteStoreValue":0,"total":500},{"kind":"netWorth","tick":168,"thalers":500,"cargoValue":0,"siteStoreValue":0,"total":500},{"kind":"netWorth","tick":192,"thalers":500,"cargoValue":0,"siteStoreValue":0,"total":500},{"kind":"netWorth","tick":216,"thalers":500,"cargoValue":0,"siteStoreValue":0,"total":500},{"kind":"netWorth","tick":240,"thalers":500,"cargoValue":0,"siteStoreValue":0,"total":500},{"kind":"netWorth","tick":264,"thalers":500,"cargoValue":0,"siteStoreValue":0,"total":500},{"kind":"netWorth","tick":288,"thalers":500,"cargoValue":0,"siteStoreValue":0,"total":500},{"kind":"netWorth","tick":312,"thalers":500,"cargoValue":0,"siteStoreValue":0,"total":500},{"kind":"netWorth","tick":336,"thalers":500,"cargoValue":0,"siteStoreValue":0,"total":500},{"kind":"netWorth","tick":360,"thalers":500,"cargoValue":0,"siteStoreValue":0,"total":500},{"kind":"netWorth","tick":384,"thalers":500,"cargoValue":0,"siteStoreValue":0,"total":500},{"kind":"netWorth","tick":408,"thalers":500,"cargoValue":0,"siteStoreValue":0,"total":500},{"kind":"netWorth","tick":432,"thalers":500,"cargoValue":0,"siteStoreValue":0,"total":500},{"kind":"netWorth","tick":456,"thalers":500,"cargoValue":0,"siteStoreValue":0,"total":500},{"kind":"netWorth","tick":480,"thalers":500,"cargoValue":0,"siteStoreValue":0,"total":500},{"kind":"netWorth","tick":504,"thalers":500,"cargoValue":0,"siteStoreValue":0,"total":500},{"kind":"netWorth","tick":528,"thalers":500,"cargoValue":0,"siteStoreValue":0,"total":500},{"kind":"netWorth","tick":552,"thalers":500,"cargoValue":0,"siteStoreValue":0,"total":500},{"kind":"netWorth","tick":576,"thalers":500,"cargoValue":0,"siteStoreValue":0,"total":500},{"kind":"netWorth","tick":600,"thalers":500,"cargoValue":0,"siteStoreValue":0,"total":500},{"kind":"netWorth","tick":624,"thalers":500,"cargoValue":0,"siteStoreValue":0,"total":500},{"kind":"netWorth","tick":648,"thalers":500,"cargoValue":0,"siteStoreValue":0,"total":500},{"kind":"netWorth","tick":672,"thalers":500,"cargoValue":0,"siteStoreValue":0,"total":500},{"kind":"netWorth","tick":696,"thalers":500,"cargoValue":0,"siteStoreValue":0,"total":500},{"kind":"netWorth","tick":720,"thalers":500,"cargoValue":0,"siteStoreValue":0,"total":500}]',
    },
    13: {
      worldHash: 3855793336,
      ledgerJson:
        '[{"kind":"netWorth","tick":24,"thalers":500,"cargoValue":0,"siteStoreValue":0,"total":500},{"kind":"netWorth","tick":48,"thalers":500,"cargoValue":0,"siteStoreValue":0,"total":500},{"kind":"netWorth","tick":72,"thalers":500,"cargoValue":0,"siteStoreValue":0,"total":500},{"kind":"netWorth","tick":96,"thalers":500,"cargoValue":0,"siteStoreValue":0,"total":500},{"kind":"netWorth","tick":120,"thalers":500,"cargoValue":0,"siteStoreValue":0,"total":500},{"kind":"netWorth","tick":144,"thalers":500,"cargoValue":0,"siteStoreValue":0,"total":500},{"kind":"netWorth","tick":168,"thalers":500,"cargoValue":0,"siteStoreValue":0,"total":500},{"kind":"netWorth","tick":192,"thalers":500,"cargoValue":0,"siteStoreValue":0,"total":500},{"kind":"netWorth","tick":216,"thalers":500,"cargoValue":0,"siteStoreValue":0,"total":500},{"kind":"netWorth","tick":240,"thalers":500,"cargoValue":0,"siteStoreValue":0,"total":500},{"kind":"netWorth","tick":264,"thalers":500,"cargoValue":0,"siteStoreValue":0,"total":500},{"kind":"netWorth","tick":288,"thalers":500,"cargoValue":0,"siteStoreValue":0,"total":500},{"kind":"netWorth","tick":312,"thalers":500,"cargoValue":0,"siteStoreValue":0,"total":500},{"kind":"netWorth","tick":336,"thalers":500,"cargoValue":0,"siteStoreValue":0,"total":500},{"kind":"netWorth","tick":360,"thalers":500,"cargoValue":0,"siteStoreValue":0,"total":500},{"kind":"netWorth","tick":384,"thalers":500,"cargoValue":0,"siteStoreValue":0,"total":500},{"kind":"netWorth","tick":408,"thalers":500,"cargoValue":0,"siteStoreValue":0,"total":500},{"kind":"netWorth","tick":432,"thalers":500,"cargoValue":0,"siteStoreValue":0,"total":500},{"kind":"netWorth","tick":456,"thalers":500,"cargoValue":0,"siteStoreValue":0,"total":500},{"kind":"netWorth","tick":480,"thalers":500,"cargoValue":0,"siteStoreValue":0,"total":500},{"kind":"netWorth","tick":504,"thalers":500,"cargoValue":0,"siteStoreValue":0,"total":500},{"kind":"netWorth","tick":528,"thalers":500,"cargoValue":0,"siteStoreValue":0,"total":500},{"kind":"netWorth","tick":552,"thalers":500,"cargoValue":0,"siteStoreValue":0,"total":500},{"kind":"netWorth","tick":576,"thalers":500,"cargoValue":0,"siteStoreValue":0,"total":500},{"kind":"netWorth","tick":600,"thalers":500,"cargoValue":0,"siteStoreValue":0,"total":500},{"kind":"netWorth","tick":624,"thalers":500,"cargoValue":0,"siteStoreValue":0,"total":500},{"kind":"netWorth","tick":648,"thalers":500,"cargoValue":0,"siteStoreValue":0,"total":500},{"kind":"netWorth","tick":672,"thalers":500,"cargoValue":0,"siteStoreValue":0,"total":500},{"kind":"netWorth","tick":696,"thalers":500,"cargoValue":0,"siteStoreValue":0,"total":500},{"kind":"netWorth","tick":720,"thalers":500,"cargoValue":0,"siteStoreValue":0,"total":500}]',
    },
  };

  for (const seed of [1, 7, 13]) {
    it(`seed ${seed}: 30 world days, no commands => pinned World hash + byte-equal Ledger`, () => {
      let world = createWorld(seed);
      for (let i = 0; i < 30 * TICKS_PER_DAY; i++) world = tick(world, []);
      expect(fnv1a(JSON.stringify(world))).toBe(golden[seed].worldHash);
      expect(JSON.stringify(world.ledger)).toBe(golden[seed].ledgerJson);
    });
  }
});
