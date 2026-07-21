import { applyCommand } from "./commands";
import { amountOf } from "./goodsStore";
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
 * Zero test-framework dependency (tier-3 review finding, #307): this file
 * sits in `src/sim`'s production module graph — not re-exported from
 * `src/sim/index.ts` today, tree-shaken out of the production bundle today,
 * typecheck/lint green today — but importing `runGoldenScenario` from an
 * actual production path tomorrow would pull vitest's `expect` into the
 * bundle right along with it. `assertTrue` below is a two-line local
 * assertion helper carrying the exact same intermediate-state checks
 * `e13-0-equivalence.test.ts` had inline before the extraction, expressed
 * without the test framework, so this module has none. It still fails loud
 * (throws) if the scripted scenario itself is ever broken — not just
 * "compute a digest over whatever the buggy setup produced" — which is the
 * property `e13-0-equivalence.test.ts`/`persistence.test.ts` both rely on.
 */

/** Throws with `message` (prefixed for a traceable stack) when `condition`
 *  is false. The only assertion primitive this module needs — no test
 *  framework, so this stays a genuinely pure `src/sim` module. */
function assertTrue(condition: boolean, message: string): void {
  if (!condition) throw new Error(`golden scenario: ${message}`);
}

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
  assertTrue(w.company.headquarters !== undefined, "headquarters must be defined after founding");

  w = applyCommand(w, { kind: "placeBuildOrder" });
  assertTrue(w.company.headquarters?.buildOrder !== undefined, "buildOrder must be defined after placeBuildOrder");

  // Surplus buy: HQ site's electronics need is 5 (SHIP_RECIPE); buying 10
  // leaves cargo > need at the moment of delivery below — the mutation
  // target (`applyDeliveryToConstructionSite`, dropping `min`) diverges here.
  w = applyCommand(w, { kind: "buy", shipId: "s0", good: "electronics", qty: 10 });
  // 10 electronics + 35 grain = 45 <= hold 50 — both buys must actually
  // clear the Hold cap (a grain qty large enough to overflow it, as an
  // earlier draft of this scenario did, silently no-ops the buy).
  w = applyCommand(w, { kind: "buy", shipId: "s0", good: "grain", qty: 35 });
  const s0Loaded = w.company.ships.find((s) => s.id === "s0")!.cargo;
  assertTrue(amountOf(s0Loaded, "electronics") === 10, "expected 10 electronics aboard after the buy");
  assertTrue(amountOf(s0Loaded, "grain") === 35, "expected 35 grain aboard after the buy");

  w = applyCommand(w, { kind: "deliver", shipId: "s0", good: "electronics" });
  // The surplus actually landed: site takes only the recipe's need (5), the
  // rest (5) stays aboard — this is exactly what a dropped `min` would break.
  assertTrue(
    amountOf(w.company.headquarters!.buildOrder!.siteStore, "electronics") === 5,
    "HQ site must hold exactly 5 electronics (the recipe's need) after delivery",
  );
  assertTrue(
    amountOf(w.company.ships.find((s) => s.id === "s0")!.cargo, "electronics") === 5,
    "s0 must retain the 5-unit electronics surplus after delivery",
  );

  w = applyCommand(w, { kind: "deliver", shipId: "s0", good: "grain" });
  assertTrue(
    amountOf(w.company.headquarters!.buildOrder!.siteStore, "grain") === 35,
    "HQ site must hold all 35 delivered grain",
  );
  assertTrue(
    amountOf(w.company.ships.find((s) => s.id === "s0")!.cargo, "grain") === 0,
    "s0 must have delivered all of its grain",
  );

  // >=3 world days of pure auto-draw (no rush) — the AC's explicit
  // requirement, not just "however many ticks completion happens to take".
  for (let i = 0; i < 3 * TICKS_PER_DAY; i++) w = tick(w, []);

  // Finish the HQ hull via rush.
  w = applyCommand(w, { kind: "rushBuild" });
  let guard = 0;
  while (w.company.headquarters?.buildOrder && guard++ < 2000) w = tick(w, []);
  assertTrue(w.company.headquarters?.buildOrder === undefined, "buildOrder must clear once the hull completes");
  // launchIfComplete fired: a second ship (s1) now exists.
  assertTrue(w.company.ships.length === 2, "launchIfComplete must have added a second ship");

  // Sell the electronics surplus left over from the HQ delivery (trade/sell
  // coverage), still docked at the HQ port.
  const s0AfterLaunch = w.company.ships.find((s) => s.id === "s0")!;
  const leftoverElectronics = amountOf(s0AfterLaunch.cargo, "electronics");
  if (leftoverElectronics > 0) {
    w = applyCommand(w, { kind: "sell", shipId: "s0", good: "electronics", qty: leftoverElectronics });
  }

  // Sail s0 to the Shipyard's port.
  w = applyCommand(w, { kind: "sailTo", shipId: "s0", portId: yardPortId });
  guard = 0;
  while (w.company.ships.find((s) => s.id === "s0")!.location.kind !== "docked" && guard++ < 2000) {
    w = tick(w, []);
  }
  const s0AtYard = w.company.ships.find((s) => s.id === "s0")!.location;
  assertTrue(
    s0AtYard.kind === "docked" && s0AtYard.portId === yardPortId,
    "s0 must be docked at the Shipyard port",
  );

  w = applyCommand(w, { kind: "commissionShipyard", portId: yardPortId });
  assertTrue(w.company.shipyard?.site !== undefined, "Shipyard's own construction site must be active");

  w = applyCommand(w, { kind: "buy", shipId: "s0", good: "timber", qty: 5 });
  assertTrue(
    amountOf(w.company.ships.find((s) => s.id === "s0")!.cargo, "timber") === 5,
    "expected 5 timber aboard after the buy",
  );
  w = applyCommand(w, { kind: "deliver", shipId: "s0", good: "timber" });
  assertTrue(
    amountOf(w.company.shipyard!.site!.siteStore, "timber") === 5,
    "Shipyard site must hold the delivered 5 timber",
  );
  assertTrue(
    amountOf(w.company.ships.find((s) => s.id === "s0")!.cargo, "timber") === 0,
    "s0 must have delivered all of its timber",
  );

  for (let i = 0; i < TICKS_PER_DAY; i++) w = tick(w, []);
  w = applyCommand(w, { kind: "rushShipyard" });
  guard = 0;
  while (w.company.shipyard?.site && guard++ < 2000) w = tick(w, []);
  assertTrue(w.company.shipyard?.site === undefined, "Shipyard's own site must clear once it completes");

  // Buy the Refit's delivery material *before* commissioning it: the Refit
  // lock (E14 #275) blocks `buy`/`sell`/`sailTo` on the locked ship itself
  // (cargo trade is barred while under refit) but deliberately NOT `deliver`
  // — the locked ship may still deliver from cargo it already holds
  // (`shipyard.ts` — `isUnderRefit`). Buying after commissioning would
  // silently no-op here.
  w = applyCommand(w, { kind: "buy", shipId: "s0", good: "grain", qty: 20 });
  assertTrue(
    amountOf(w.company.ships.find((s) => s.id === "s0")!.cargo, "grain") === 20,
    "expected 20 grain aboard after the buy",
  );

  // The F3 shared-purse race: a second HQ build order (now legal — the
  // Shipyard itself is built) placed concurrently with a Refit, both drawing
  // from the same purse the same tick (docs/specs/E13.0 — Determinism,
  // hazard 4; the existing shared-purse pin, shipyard.test.ts ~L732).
  w = applyCommand(w, { kind: "placeBuildOrder" });
  assertTrue(w.company.headquarters?.buildOrder !== undefined, "second HQ buildOrder must be active");
  w = applyCommand(w, { kind: "commissionRefit", shipId: "s0" });
  assertTrue(w.company.shipyard?.refitOrder !== undefined, "Refit must be active on s0");

  // Deliver directly into the Refit site too (the third of the "three
  // sites"), then let both draw concurrently via pure auto-draw.
  w = applyCommand(w, { kind: "deliver", shipId: "s0", good: "grain" });
  assertTrue(
    amountOf(w.company.shipyard!.refitOrder!.siteStore, "grain") === 20,
    "Refit site must hold the delivered 20 grain",
  );
  assertTrue(
    amountOf(w.company.ships.find((s) => s.id === "s0")!.cargo, "grain") === 0,
    "s0 must have delivered all of its grain into the Refit site",
  );
  for (let i = 0; i < 2 * TICKS_PER_DAY; i++) w = tick(w, []);

  return w;
}
