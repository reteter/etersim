import { describe, expect, it } from "vitest";
import { EXPECTED_GOLDEN_DIGEST } from "./e13-0-golden-digest.fixture";
import { runGoldenScenario } from "./e13-0-golden-scenario";
import { GOOD_IDS } from "./goods";
import { amountOf, type GoodsStore } from "./goodsStore";
import type { LedgerEvent } from "./ledger";
import type { Port } from "./region";
import type { Ship } from "./ship";
import type { World } from "./world";

/**
 * E13.0 (#306, docs/specs/E13.0-goods-store.md §Testing, C1) — the
 * golden-run digest: the behavior-preservation proof that stands in for "the
 * existing suite passes unchanged" (which encapsulation, #307, makes false by
 * construction — ~72 test index sites and ~33 literal store constructions
 * stop compiling). Fixed seed; a scripted command list exercising buy, sell,
 * deliver to each of the three construction sites, auto-draw across >=3
 * world days, rush, launch, commissionShipyard, commissionRefit. The digest
 * is an *explicit walk* (ports x GOOD_IDS, ships x GOOD_IDS, every store,
 * every Ledger event field) folded into one string — deliberately NOT
 * `JSON.stringify(world)`, because a GoodsStore parsed from JSON inherits the
 * file's key order (spec §Persistence and determinism, hazard 1) and raw
 * stringification would be order-sensitive exactly where #307 must not
 * change behavior.
 *
 * Digest scope note (flagged per the task package — reported, not guessed):
 * the AC names four walk items (ports x GOOD_IDS, ships x GOOD_IDS, every
 * store, every Ledger event field); this digest also includes
 * `company.thalers`, `ship.hold`/`ship.baseHold` and `world.tick` — all
 * scalars, all safe under an explicit walk (no key-order hazard), and all
 * directly exercised by the shared-purse race (F3) and the refit outcome.
 * It deliberately excludes contracts/guilds/routes/rng/flowDrift/
 * priceSnapshots/osmosisPulse: #307's refactor touches only the four goods
 * stores (Ship.cargo, HQ site, Shipyard site, Refit site), so those fields
 * are out of the refactor's blast radius and adding them would only dilute
 * the digest's signal.
 *
 * Cross-platform float formatting: the digest's two float-valued spots
 * (market stock, `netWorth`'s value fields) go through `fmtFloat` (6 decimal
 * places), not bare `toString()` — see `fmtFloat`'s own docstring for why
 * (CI caught this: `**`/`Math.pow` isn't bit-identical across platforms).
 */

/** Fixed-precision formatting for the digest's few float-valued fields
 *  (market stock; `computeNetWorth`'s cargoValue/siteStoreValue/total).
 *  Both flow through `price()` (`market.ts`), which raises a ratio to
 *  `PRICE_CURVE_EXPONENT` (0.75) — a non-integer exponent, so `**`/`Math.pow`
 *  is NOT guaranteed bit-identical across platforms/V8 versions (only
 *  +,-,*,/ are IEEE754-portable). A CI run on a different OS/Node produced a
 *  digest that differed from this worktree's only in the 15th-16th
 *  significant digit of exactly these two fields — ULP noise, not a
 *  behavior difference (confirmed: the C1 mutation drill below moves values
 *  by orders of magnitude more than 1e-6). 6 decimal places is generous
 *  headroom over that noise floor while staying far more precise than any
 *  real divergence this digest is meant to catch (the smallest real
 *  quantities in this scenario are whole-unit good counts and thaler
 *  amounts). Every OTHER field in the digest (thalers, qty, tick, hold) is
 *  an integer by construction (`Math.round` in `quoteBuy`/`quoteSell`,
 *  `holdLadder`'s rounding) and is left as bare `toString()` — no known
 *  precedent for cross-platform float-fixture rounding elsewhere in this
 *  repo (grepped for `toFixed`/`toPrecision`: the one hit,
 *  `economy.test.ts:278`, formats a *log message*, not a comparison; the
 *  repo's other "determinism" tests, `tick.test.ts`/`market.test.ts`/
 *  `shipyard.test.ts`, deep-equal two objects computed in the *same*
 *  process/platform, which sidesteps this hazard entirely — this fixture,
 *  compared across machines, is the first to need it). */
function fmtFloat(n: number): string {
  return n.toFixed(6);
}

/** One port x GOOD_IDS walk: the market stock the good sits in at this port
 *  (equilibrium/priceBias are worldgen-invariant for a fixed seed and never
 *  mutated at runtime — see `market.ts`/`osmosis.ts` — so walking them adds
 *  no signal). */
function digestPort(port: Port): string {
  const parts: string[] = [`port:${port.id}`];
  for (const good of GOOD_IDS) parts.push(`${good}=${fmtFloat(port.market[good].stock)}`);
  return parts.join("|");
}

/** One ship x GOOD_IDS walk: cargo, plus hold/baseHold (the Refit outcome
 *  lives here — `refitComplete` changes `hold`, not cargo). */
function digestShip(ship: Ship): string {
  const parts: string[] = [`ship:${ship.id}`, `hold=${ship.hold}`, `baseHold=${ship.baseHold}`];
  for (const good of GOOD_IDS) parts.push(`${good}=${amountOf(ship.cargo, good)}`);
  return parts.join("|");
}

/** One store's walk, with a present/absent sentinel: a store missing from
 *  the World entirely must digest differently than one present-but-empty
 *  (both would otherwise walk to the identical all-zero GOOD_IDS line). */
function digestStore(label: string, store: GoodsStore | undefined): string {
  if (!store) return `${label}:absent`;
  const parts = [`${label}:present`];
  for (const good of GOOD_IDS) parts.push(`${good}=${amountOf(store, good)}`);
  return parts.join("|");
}

/** Every Ledger event field, per kind — an explicit switch (not
 *  `Object.keys`) so a field silently added to one kind without a matching
 *  digest line is a compile error here (`never` below), not a silent gap. */
function digestLedgerEvent(event: LedgerEvent, index: number): string {
  const head = `#${index}`;
  switch (event.kind) {
    case "trade":
      return `${head} trade|tick=${event.tick}|shipId=${event.shipId}|portId=${event.portId}|good=${event.good}|side=${event.side}|qty=${event.qty}|thalers=${event.thalers}|routeId=${event.routeId ?? ""}`;
    case "dockingFee":
      return `${head} dockingFee|tick=${event.tick}|shipId=${event.shipId}|portId=${event.portId}|thalers=${event.thalers}`;
    case "autoDraw":
      return `${head} autoDraw|tick=${event.tick}|portId=${event.portId}|good=${event.good}|qty=${event.qty}|thalers=${event.thalers}`;
    case "rush":
      return `${head} rush|tick=${event.tick}|portId=${event.portId}|good=${event.good}|qty=${event.qty}|thalers=${event.thalers}`;
    case "delivery":
      return `${head} delivery|tick=${event.tick}|shipId=${event.shipId}|portId=${event.portId}|good=${event.good}|qty=${event.qty}`;
    case "laborFee":
      return `${head} laborFee|tick=${event.tick}|thalers=${event.thalers}`;
    case "founding":
      return `${head} founding|tick=${event.tick}|portId=${event.portId}|thalers=${event.thalers}`;
    case "launch":
      return `${head} launch|tick=${event.tick}|shipId=${event.shipId}|portId=${event.portId}`;
    case "netWorth":
      return `${head} netWorth|tick=${event.tick}|thalers=${event.thalers}|cargoValue=${fmtFloat(event.cargoValue)}|siteStoreValue=${fmtFloat(event.siteStoreValue)}|total=${fmtFloat(event.total)}`;
    case "enrollmentFee":
      return `${head} enrollmentFee|tick=${event.tick}|guildId=${event.guildId}|thalers=${event.thalers}`;
    case "upkeep":
      return `${head} upkeep|tick=${event.tick}|shipId=${event.shipId}|thalers=${event.thalers}`;
    case "contractFee":
      return `${head} contractFee|tick=${event.tick}|guildId=${event.guildId}|contractId=${event.contractId}|thalers=${event.thalers}`;
    case "settlement":
      return `${head} settlement|tick=${event.tick}|contractId=${event.contractId}|guildId=${event.guildId}|outcome=${event.outcome}|pointsDelta=${event.pointsDelta}`;
    case "shipyardBuilt":
      return `${head} shipyardBuilt|tick=${event.tick}|portId=${event.portId}`;
    case "refitStart":
      return `${head} refitStart|tick=${event.tick}|shipId=${event.shipId}|portId=${event.portId}|thalers=${event.thalers}`;
    case "refitComplete":
      return `${head} refitComplete|tick=${event.tick}|shipId=${event.shipId}|portId=${event.portId}|hold=${event.hold}`;
    default: {
      const exhaustive: never = event;
      throw new Error(`e13-0-equivalence digest: unhandled Ledger event kind ${JSON.stringify(exhaustive)}`);
    }
  }
}

/** Folds the whole World into one deterministic string via an explicit walk
 *  (never `JSON.stringify` — see the file-level docstring, hazard 1). */
export function digestWorld(world: World): string {
  const lines: string[] = [];
  lines.push(`tick=${world.tick}`);
  lines.push(`thalers=${world.company.thalers}`);

  for (const port of world.region.ports) lines.push(digestPort(port));
  for (const ship of world.company.ships) lines.push(digestShip(ship));

  lines.push(digestStore("hqBuildSite", world.company.headquarters?.buildOrder?.siteStore));
  lines.push(digestStore("shipyardSite", world.company.shipyard?.site?.siteStore));
  lines.push(digestStore("refitSite", world.company.shipyard?.refitOrder?.siteStore));

  world.ledger.forEach((event, index) => lines.push(digestLedgerEvent(event, index)));

  return lines.join("\n");
}

describe("E13.0 golden-run digest (#306, spec C1)", () => {
  it("matches the pre-refactor fixture committed against main — the behavior-preservation proof", () => {
    const finalWorld = runGoldenScenario();
    const digest = digestWorld(finalWorld);
    // Computed twice from the same world (not re-run) to catch any
    // non-deterministic fold (e.g. an accidental Object.keys/Set iteration)
    // in the digest walk itself, independent of the fixture comparison.
    expect(digestWorld(finalWorld)).toBe(digest);
    expect(digest).toBe(EXPECTED_GOLDEN_DIGEST);
  });
});
