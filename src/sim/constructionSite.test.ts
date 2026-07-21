import { describe, expect, it } from "vitest";
import {
  applyDeliveryToConstructionSite,
  applyRushQuoteToSite,
  commissionBuilding,
  CONSTRUCTION_RESERVE,
  drawConstructionSite,
  emptySiteStore,
  isSiteComplete,
  quoteConstructionSiteRush,
  siteRemainingNeed,
  SHIP_RECIPE,
  type ConstructionSite,
} from "./building";
import { GOOD_IDS, type GoodId } from "./goods";
import { amountOf, storeOf } from "./goodsStore";
import { effectiveBase, maxAffordableQty, quoteBuy } from "./market";
import { createWorld } from "./world";

/**
 * ConstructionSite seam (#99): every test here drives the generic engine
 * with a recipe that is NOT SHIP_RECIPE and a port that is not tied to any
 * Headquarters — the discriminator that proves the helpers are actually
 * parameterized on `{ recipe, siteStore, portId }`, not secretly reaching
 * for SHIP_RECIPE or `world.company.headquarters`. The HQ-shaped wrappers
 * (`remainingNeed`, `isRecipeComplete`, `runBuildSiteAutoDraw`,
 * `computeRushQuote`, ...) keep their own coverage, unmodified, in
 * building.test.ts.
 */

// A recipe deliberately shaped differently from SHIP_RECIPE (which needs all
// five goods): only two goods, small quantities. `recipe` stays a plain
// Record<GoodId, number> (ADR-0008 — only stored goods contents are opaque,
// never a target recipe), so this is a literal, not a GoodsStore.
const CUSTOM_RECIPE: Record<GoodId, number> = {
  grain: 3,
  textiles: 0,
  aetherSalt: 0,
  electronics: 0,
  timber: 1,
};

function customSite(portId: string, siteStore = emptySiteStore()): ConstructionSite {
  return { recipe: CUSTOM_RECIPE, siteStore, portId };
}

describe("siteRemainingNeed / isSiteComplete (#99)", () => {
  it("computes need against the site's own recipe, not SHIP_RECIPE", () => {
    const site = customSite("p-anywhere", storeOf({ grain: 1 }));
    expect(siteRemainingNeed(site, "grain")).toBe(2);
    expect(siteRemainingNeed(site, "timber")).toBe(1);
    // SHIP_RECIPE.grain is 100 — if this leaked SHIP_RECIPE, need would be 99.
    expect(siteRemainingNeed(site, "grain")).not.toBe(SHIP_RECIPE.grain - 1);
  });

  it("is complete once every recipe good is met, independent of untouched goods", () => {
    const incomplete = customSite("p-x", storeOf({ grain: 3, timber: 0 }));
    expect(isSiteComplete(incomplete)).toBe(false);
    const complete = customSite("p-x", storeOf({ grain: 3, timber: 1, electronics: 999 }));
    expect(isSiteComplete(complete)).toBe(true);
  });
});

describe("applyDeliveryToConstructionSite (#99)", () => {
  it("moves min(cargo, remaining need) per the site's own recipe", () => {
    const site = customSite("p-anywhere", storeOf({ grain: 1 }));
    const { siteStore, moved } = applyDeliveryToConstructionSite(site, storeOf({ grain: 5 }), "grain");
    expect(moved).toBe(2); // need was 3 - 1
    expect(amountOf(siteStore, "grain")).toBe(3);
  });

  it("moves nothing and returns the same siteStore reference when need is 0", () => {
    const site = customSite("p-anywhere", storeOf({ grain: 3 }));
    const result = applyDeliveryToConstructionSite(site, storeOf({ grain: 10 }), "grain");
    expect(result.moved).toBe(0);
    expect(result.siteStore).toBe(site.siteStore);
  });
});

describe("commissionBuilding (#99 — generic placement shape)", () => {
  it("charges the fee and opens an empty site store when affordable above the Reserve", () => {
    const result = commissionBuilding(10_000, 750);
    expect(result).not.toBeNull();
    expect(result!.thalers).toBe(10_000 - 750);
    expect(result!.siteStore).toEqual(emptySiteStore());
  });

  it("rejects when the fee would dip below the Reserve, at the exact boundary", () => {
    expect(commissionBuilding(750 + CONSTRUCTION_RESERVE, 750)).not.toBeNull();
    expect(commissionBuilding(750 + CONSTRUCTION_RESERVE - 1, 750)).toBeNull();
  });
});

describe("drawConstructionSite (#99 — generic auto-draw engine)", () => {
  it("buys against a custom recipe at a non-HQ port, tagging events with the site's own portId", () => {
    const w = createWorld("construction-site-draw");
    const port = w.region.ports[1]; // an arbitrary port — no HQ exists in this World at all
    const site = customSite(port.id);

    const cap = 2;
    const result = drawConstructionSite(site, port, 1_000_000, cap, w.tick);

    // grain need is 3, cap 2 → buys 2; timber need is 1, cap 2 but need caps it → buys 1.
    const expectGrainQty = Math.min(cap, 3, Math.floor(port.market.grain.stock));
    const expectTimberQty = Math.min(cap, 1, Math.floor(port.market.timber.stock));
    expect(amountOf(result.siteStore, "grain")).toBe(expectGrainQty);
    expect(amountOf(result.siteStore, "timber")).toBe(expectTimberQty);
    // Untouched goods (recipe 0) never move, even though SHIP_RECIPE wants them.
    expect(amountOf(result.siteStore, "electronics")).toBe(0);
    expect(amountOf(result.siteStore, "aetherSalt")).toBe(0);

    for (const event of result.events) {
      expect(event.kind).toBe("autoDraw");
      if (event.kind === "autoDraw") expect(event.portId).toBe(port.id);
    }
    expect(result.port.market.grain.stock).toBe(port.market.grain.stock - expectGrainQty);
  });

  it("stalls silently at the Reserve — no event, no store growth, port untouched", () => {
    const w = createWorld("construction-site-stall");
    const port = w.region.ports[0];
    const site = customSite(port.id);
    const result = drawConstructionSite(site, port, CONSTRUCTION_RESERVE, 5, w.tick);
    expect(result.siteStore).toEqual(emptySiteStore());
    expect(result.events).toEqual([]);
    expect(result.port).toBe(port);
    expect(result.thalers).toBe(CONSTRUCTION_RESERVE);
  });
});

describe("quoteConstructionSiteRush / applyRushQuoteToSite (#99 — generic rush engine)", () => {
  it("quotes and charges exactly the same total against a custom recipe at a non-HQ port", () => {
    const w = createWorld("construction-site-rush");
    const port = w.region.ports[2];
    const site = customSite(port.id);
    const thalers = 5000;

    const quote = quoteConstructionSiteRush(site, port, thalers);
    expect(quote.lines.length).toBeGreaterThan(0);
    for (const line of quote.lines) {
      expect(["grain", "timber"]).toContain(line.good); // only recipe goods can appear
    }

    // Cross-check against the manual maxAffordableQty walk (mirrors building.test.ts's rush test).
    let purse = thalers - CONSTRUCTION_RESERVE;
    for (const good of GOOD_IDS) {
      const need = siteRemainingNeed(site, good);
      if (need <= 0) continue;
      const entry = port.market[good];
      const base = effectiveBase(port, good);
      const qty = maxAffordableQty(entry, base, need, purse);
      if (qty <= 0) continue;
      const cost = quoteBuy(entry, base, qty)!;
      purse -= cost;
      const line = quote.lines.find((l) => l.good === good)!;
      expect(line.qty).toBe(qty);
      expect(line.thalers).toBe(cost);
    }

    const result = applyRushQuoteToSite(site, port, thalers, quote, w.tick);
    expect(result.thalers).toBe(thalers - quote.total);
    expect(result.events.length).toBe(quote.lines.length);
    for (const event of result.events) {
      expect(event.kind).toBe("rush");
      if (event.kind === "rush") expect(event.portId).toBe(port.id);
    }
    expect(amountOf(result.siteStore, "grain")).toBe(quote.lines.find((l) => l.good === "grain")?.qty ?? 0);
    expect(amountOf(result.siteStore, "timber")).toBe(quote.lines.find((l) => l.good === "timber")?.qty ?? 0);
  });

  it("is empty with a completed site (no remaining need)", () => {
    const w = createWorld("construction-site-rush-complete");
    const port = w.region.ports[0];
    const site = customSite(port.id, storeOf({ grain: 3, timber: 1 }));
    expect(quoteConstructionSiteRush(site, port, 1_000_000)).toEqual({ lines: [], total: 0 });
  });
});
