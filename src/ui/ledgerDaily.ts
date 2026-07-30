import { worldDay } from "./worldDate";

/** One day's net purse movement, as the daily transaction log renders it. */
export type DailyNet = {
  readonly day: number;
  readonly net: number;
};

/** A transaction reduced to what the daily roll-up needs: when it happened and
 *  what it did to the purse (`null` for goods-only movements — delivery, store,
 *  withdraw, launch — which contribute nothing to a day's balance). */
export type DailyNetInput = {
  readonly tick: number;
  readonly delta: number | null;
};

/**
 * Rolls transactions up into one entry per world day, newest day first (owner
 * directive 2026-07-30, point 7): the all-ships log answers "how did the
 * Company do today", not "what happened at 07:00". Days with no purse movement
 * at all still appear — a day of pure deliveries is a real day with a zero
 * balance, and hiding it would leave a gap in the sequence the player reads as
 * missing data. Only the per-ship filter keeps row-per-event detail
 * (CompanyValueTab.tsx).
 */
export function dailyNet(rows: readonly DailyNetInput[]): readonly DailyNet[] {
  const byDay = new Map<number, number>();
  for (const row of rows) {
    const day = worldDay(row.tick);
    byDay.set(day, (byDay.get(day) ?? 0) + (row.delta ?? 0));
  }
  return [...byDay.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([day, net]) => ({ day, net }));
}
