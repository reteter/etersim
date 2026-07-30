import { describe, expect, it } from "vitest";
import { TICKS_PER_DAY } from "../sim";
import { dailyNet } from "./ledgerDaily";

/** Tick at hour `hour` of world day `day` (Day 1 starts at tick 0, ADR-0003). */
function tickAt(day: number, hour: number): number {
  return (day - 1) * TICKS_PER_DAY + hour;
}

describe("dailyNet — the all-ships log's daily roll-up (owner point 7)", () => {
  it("sums every purse movement inside a day into one entry", () => {
    const rows = [
      { tick: tickAt(3, 2), delta: 500 },
      { tick: tickAt(3, 9), delta: -120 },
      { tick: tickAt(3, 23), delta: 38 },
    ];

    expect(dailyNet(rows)).toEqual([{ day: 3, net: 418 }]);
  });

  it("orders days newest first, regardless of input order", () => {
    const rows = [
      { tick: tickAt(1, 0), delta: 10 },
      { tick: tickAt(5, 0), delta: 50 },
      { tick: tickAt(3, 0), delta: 30 },
    ];

    expect(dailyNet(rows).map((d) => d.day)).toEqual([5, 3, 1]);
  });

  it("counts a goods-only movement as zero, keeping its day in the sequence", () => {
    const rows = [{ tick: tickAt(2, 4), delta: null }];

    expect(dailyNet(rows)).toEqual([{ day: 2, net: 0 }]);
  });

  it("returns nothing for an empty ledger", () => {
    expect(dailyNet([])).toEqual([]);
  });
});
