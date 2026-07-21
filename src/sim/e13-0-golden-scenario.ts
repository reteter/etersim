import { expect } from "vitest";
import { applyCommand } from "./commands";
import { TICKS_PER_DAY } from "./region";
import { tick } from "./tick";
import { createWorld, type World } from "./world";

/**
 * E13.0 golden-run scenario builder — shared between `e13-0-equivalence.test.ts`
 * (C1, the digest behavior-preservation proof) and `src/store/persistence.test.ts`
 * (C2, the byte-identical save round-trip): both must run the *exact same*
 * scripted command list so their fixtures were generated from, and are
 * verified against, one scenario. Factored into its own (non-`.test.ts`)
 * module rather than imported directly from `e13-0-equivalence.test.ts`
 * because importing a `.test.ts` file as a plain module re-executes its
 * top-level `describe`/`it` calls, double-registering that suite's tests in
 * whichever file imports it (observed empirically while wiring up C2 — see
 * the #307 completion report).
 *
 * Uses vitest's `expect` for its embedded intermediate-state assertions (the
 * same assertions `e13-0-equivalence.test.ts` had inline before the
 * extraction) — a test-support module, not part of the sim's public surface
 * (never re-exported from `src/sim/index.ts`), so depending on the test
 * framework here is the same category as the already-exported `digestWorld`.
 */

const SEED = "e13-0-golden-run";
const BUDGET = 45_000;

/**
 * The scripted golden run. Exercises, in order: found HQ, buy (with a
 * deliberate cargo surplus over the HQ site's remaining electronics need —
 * the exact shape that catches a dropped `min(need, have)`, since grain's
 * hold-sized cargo can never exceed its 100-unit recipe need), deliver to
 * the HQ site, >=3 world days of pure auto-draw, rush to finish, the
 * resulting launch, sailing to a second port, commissionShipyard, deliver
 * to the Shipyard's own site, rush to finish (shipyardBuilt), a second HQ
 * build order placed concurrently with commissionRefit (the F3 shared-purse
 * race — HQ build site + Refit site both drawing the same tick), a spell of
 * pure auto-draw over that concurrent phase, and a closing sell.
 */
export function runGoldenScenario(): World {
  const w0 = createWorld(SEED);
  let w: World = { ...w0, company: { ...w0.company, thalers: BUDGET } };

  // The starting ship's home port is RNG-drawn (world.ts createWorld), NOT
  // necessarily `region.ports[0]` — found the HQ where s0 actually is, so
  // the immediate buy/deliver below lands at the HQ port without an extra
  // sail (a hardcoded `ports[0]` here would silently no-op every HQ
  // `deliver` call, since `deliver` gates on the ship's *current* dock).
  const s0Start = w.company.ships[0];
  if (s0Start.location.kind !== "docked") throw new Error("golden scenario: s0 must start docked");
  const hqPortId = s0Start.location.portId;
  const yardPortId = w.region.ports.find((p) => p.id !== hqPortId)!.id;

  w = applyCommand(w, { kind: "foundHeadquarters", portId: hqPortId });
  expect(w.company.headquarters).toBeDefined();

  w = applyCommand(w, { kind: "placeBuildOrder" });
  expect(w.company.headquarters?.buildOrder).toBeDefined();

  // Surplus buy: HQ site's electronics need is 5 (SHIP_RECIPE); buying 10
  // leaves cargo > need at the moment of delivery below — the mutation
  // target (`applyDeliveryToConstructionSite`, dropping `min`) diverges here.
  w = applyCommand(w, { kind: "buy", shipId: "s0", good: "electronics", qty: 10 });
  // 10 electronics + 35 grain = 45 <= hold 50 — both buys must actually
  // clear the Hold cap (a grain qty large enough to overflow it, as an
  // earlier draft of this scenario did, silently no-ops the buy).
  w = applyCommand(w, { kind: "buy", shipId: "s0", good: "grain", qty: 35 });
  expect(w.company.ships.find((s) => s.id === "s0")!.cargo).toMatchObject({ electronics: 10, grain: 35 });

  w = applyCommand(w, { kind: "deliver", shipId: "s0", good: "electronics" });
  // The surplus actually landed: site takes only the recipe's need (5), the
  // rest (5) stays aboard — this is exactly what a dropped `min` would break.
  expect(w.company.headquarters?.buildOrder?.siteStore.electronics).toBe(5);
  expect(w.company.ships.find((s) => s.id === "s0")!.cargo.electronics).toBe(5);

  w = applyCommand(w, { kind: "deliver", shipId: "s0", good: "grain" });
  expect(w.company.headquarters?.buildOrder?.siteStore.grain).toBe(35);
  expect(w.company.ships.find((s) => s.id === "s0")!.cargo.grain).toBe(0);

  // >=3 world days of pure auto-draw (no rush) — the AC's explicit
  // requirement, not just "however many ticks completion happens to take".
  for (let i = 0; i < 3 * TICKS_PER_DAY; i++) w = tick(w, []);

  // Finish the HQ hull via rush.
  w = applyCommand(w, { kind: "rushBuild" });
  let guard = 0;
  while (w.company.headquarters?.buildOrder && guard++ < 2000) w = tick(w, []);
  expect(w.company.headquarters?.buildOrder).toBeUndefined();
  // launchIfComplete fired: a second ship (s1) now exists.
  expect(w.company.ships.length).toBe(2);

  // Sell the electronics surplus left over from the HQ delivery (trade/sell
  // coverage), still docked at the HQ port.
  const s0AfterLaunch = w.company.ships.find((s) => s.id === "s0")!;
  const leftoverElectronics = s0AfterLaunch.cargo.electronics;
  if (leftoverElectronics > 0) {
    w = applyCommand(w, { kind: "sell", shipId: "s0", good: "electronics", qty: leftoverElectronics });
  }

  // Sail s0 to the Shipyard's port.
  w = applyCommand(w, { kind: "sailTo", shipId: "s0", portId: yardPortId });
  guard = 0;
  while (w.company.ships.find((s) => s.id === "s0")!.location.kind !== "docked" && guard++ < 2000) {
    w = tick(w, []);
  }
  expect(w.company.ships.find((s) => s.id === "s0")!.location).toEqual({ kind: "docked", portId: yardPortId });

  w = applyCommand(w, { kind: "commissionShipyard", portId: yardPortId });
  expect(w.company.shipyard?.site).toBeDefined();

  w = applyCommand(w, { kind: "buy", shipId: "s0", good: "timber", qty: 5 });
  expect(w.company.ships.find((s) => s.id === "s0")!.cargo.timber).toBe(5);
  w = applyCommand(w, { kind: "deliver", shipId: "s0", good: "timber" });
  expect(w.company.shipyard?.site?.siteStore.timber).toBe(5);
  expect(w.company.ships.find((s) => s.id === "s0")!.cargo.timber).toBe(0);

  for (let i = 0; i < TICKS_PER_DAY; i++) w = tick(w, []);
  w = applyCommand(w, { kind: "rushShipyard" });
  guard = 0;
  while (w.company.shipyard?.site && guard++ < 2000) w = tick(w, []);
  expect(w.company.shipyard?.site).toBeUndefined();

  // Buy the Refit's delivery material *before* commissioning it: the Refit
  // lock (E14 #275) blocks `buy`/`sell`/`sailTo` on the locked ship itself
  // (cargo trade is barred while under refit) but deliberately NOT `deliver`
  // — the locked ship may still deliver from cargo it already holds
  // (`shipyard.ts` — `isUnderRefit`). Buying after commissioning would
  // silently no-op here.
  w = applyCommand(w, { kind: "buy", shipId: "s0", good: "grain", qty: 20 });
  expect(w.company.ships.find((s) => s.id === "s0")!.cargo.grain).toBe(20);

  // The F3 shared-purse race: a second HQ build order (now legal — the
  // Shipyard itself is built) placed concurrently with a Refit, both drawing
  // from the same purse the same tick (docs/specs/E13.0 — Determinism,
  // hazard 4; the existing shared-purse pin, shipyard.test.ts ~L732).
  w = applyCommand(w, { kind: "placeBuildOrder" });
  expect(w.company.headquarters?.buildOrder).toBeDefined();
  w = applyCommand(w, { kind: "commissionRefit", shipId: "s0" });
  expect(w.company.shipyard?.refitOrder).toBeDefined();

  // Deliver directly into the Refit site too (the third of the "three
  // sites"), then let both draw concurrently via pure auto-draw.
  w = applyCommand(w, { kind: "deliver", shipId: "s0", good: "grain" });
  expect(w.company.shipyard?.refitOrder?.siteStore.grain).toBe(20);
  expect(w.company.ships.find((s) => s.id === "s0")!.cargo.grain).toBe(0);
  for (let i = 0; i < 2 * TICKS_PER_DAY; i++) w = tick(w, []);

  return w;
}
