// @vitest-environment jsdom
//
// Render-level proof for the columnExtremes -> market-quality-signal swap
// (E16 #392). The unit tests in store/marketSignal.test.ts prove the
// selector itself marks every tied port "strong" (Trap 1) — this proves the
// board actually *renders* off that tier, not off a singular
// bestAskPortId/bestBidPortId (the exact regression Trap 1 warns a green
// selector test alone would miss).
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { createWorld, GOOD_IDS, type GoodId, type Port, type World } from "../sim";
import { useGameStore } from "../store/gameStore";
import { PriceBoardOverlay } from "./PriceBoardOverlay";

/** Forces ports[0] and ports[1] to tie at the cheapest ask for `good` (same
 *  priceBias + market state), while every other port is bumped strictly
 *  higher so it can't tie by accident. */
function withTiedCheapestAsk(world: World, good: GoodId): World {
  const [a, b, ...rest] = world.region.ports;
  const tiedMarket = { stock: 1000, equilibrium: 1000 };
  const tie = (port: Port): Port => ({
    ...port,
    market: { ...port.market, [good]: tiedMarket },
    priceBias: { ...port.priceBias, [good]: 1 },
  });
  const bump = (port: Port): Port => ({
    ...port,
    market: { ...port.market, [good]: tiedMarket },
    priceBias: { ...port.priceBias, [good]: 2 }, // ~2x price: nowhere near the tie
  });
  return {
    ...world,
    region: { ...world.region, ports: [tie(a), tie(b), ...rest.map(bump)] },
  };
}

describe("PriceBoardOverlay — best-ask/bid highlight (E16 #392 behavior-neutral swap)", () => {
  it("lights up every port tied at the regional cheapest ask, not just one (Trap 1)", () => {
    const good: GoodId = "grain";
    const world = withTiedCheapestAsk(createWorld("price-board-tie"), good);
    useGameStore.setState({ world: null, controlledShipId: null, selection: null });
    useGameStore.getState().loadWorld(world);

    const { container } = render(
      <PriceBoardOverlay onClose={() => {}} tab="ceny" onTabChange={() => {}} />,
    );

    const goodIndex = GOOD_IDS.indexOf(good);
    const rows = container.querySelectorAll(
      ".price-board__row:not(.price-board__row--header)",
    );
    let bestAskCount = 0;
    rows.forEach((row) => {
      const cell = row.querySelectorAll(".price-board__cell")[goodIndex];
      if (cell?.querySelector(".price-board__ask--best")) bestAskCount++;
    });

    // The old singular-extreme highlight would only ever mark one cell even
    // with a genuine tie; the tier-driven highlight marks every tied port.
    expect(bestAskCount).toBeGreaterThanOrEqual(2);
  });
});
