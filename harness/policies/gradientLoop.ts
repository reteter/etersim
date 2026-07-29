import {
  amountOf,
  cargoUsed,
  effectiveBase,
  GOOD_IDS,
  maxAffordableQty,
  price,
  type Command,
  type GoodId,
  type PortId,
  type World,
} from "../../src/sim/index.ts";
import type { Policy } from "../policy.ts";

/**
 * The gradient-loop reference Policy: haul one good back and forth along the
 * region's steepest price gradient — buy where it is cheapest, sell where it
 * is dearest, repeat.
 *
 * This generalizes the "loop" bot of the #60 dominance suite
 * (`src/sim/economy.test.ts`), which hard-codes grain and the agrarian→urban
 * pair. The bots themselves stay where they are — tests remain
 * self-contained; the *pattern* is what moves here
 * (docs/specs/E11-proving-grounds.md §Placement).
 *
 * **It is a reference, not a balance statement.** It exists to exercise the
 * Policy contract end to end (buy/sail/sell over many days) and to give
 * later Batches a non-trivial baseline. Its numbers are not a claim about
 * optimal play, and nothing here is a tuning constant to be defended.
 */
export interface GradientLoopParams {
  /** Trade this good instead of the widest gradient found at `init`. */
  readonly good?: GoodId;
  /** Buy here instead of the good's cheapest port at `init`. */
  readonly sourcePortId?: PortId;
  /** Sell here instead of the good's dearest port at `init`. */
  readonly targetPortId?: PortId;
}

/** Chosen once at `init` and then carried unchanged: the loop is a fixed
 *  route by design, so a Run reads as one legible strategy rather than a
 *  drifting one. */
export interface GradientLoopMemory {
  readonly good: GoodId;
  readonly source: PortId;
  readonly target: PortId;
}

/** Mid price of `good` at `portId` — player-visible information (the quote a
 *  docked player reads), so this policy is not `diagnostic`. */
function midPrice(world: World, portId: PortId, good: GoodId): number {
  const port = world.region.ports.find((p) => p.id === portId)!;
  return price(port.market[good], effectiveBase(port, good));
}

/**
 * The steepest gradient in the region right now: the (good, cheapest port,
 * dearest port) triple with the largest dearest/cheapest price ratio.
 * Deterministic on ties — iteration follows `GOOD_IDS` and `region.ports`
 * order and only a strict improvement replaces the incumbent.
 */
function steepestGradient(world: World): GradientLoopMemory {
  let best: GradientLoopMemory | null = null;
  let bestRatio = 0;
  for (const good of GOOD_IDS) {
    let cheapest: PortId | null = null;
    let dearest: PortId | null = null;
    let low = Infinity;
    let high = 0;
    for (const port of world.region.ports) {
      const p = midPrice(world, port.id, good);
      if (p < low) {
        low = p;
        cheapest = port.id;
      }
      if (p > high) {
        high = p;
        dearest = port.id;
      }
    }
    if (cheapest === null || dearest === null || cheapest === dearest || low <= 0) continue;
    const ratio = high / low;
    if (ratio > bestRatio) {
      bestRatio = ratio;
      best = { good, source: cheapest, target: dearest };
    }
  }
  // Every generated region has cross-port dispersion in every good
  // (economy.test.ts's invariant suite pins exactly that), so `best` is
  // always found. If no gradient exists (edge case: one-port or all-zero-price
  // region), throw rather than returning an invalid loop.
  if (!best) {
    throw new Error(
      `steepestGradient: no tradeable gradient found in the region (need at least 2 ports with price dispersion)`,
    );
  }
  return best;
}

/**
 * Builds a gradient-loop Policy. Operates the Company's **first** ship only:
 * a reference policy stays legible, and a multi-ship variant has to reason
 * about a shared purse (a second ship's buy sized against a pre-buy world can
 * be silently dropped as unaffordable) — fleet policies are a Batch-time
 * question, not this policy's.
 */
export function gradientLoop(params: GradientLoopParams = {}): Policy<GradientLoopMemory> {
  return {
    name: "gradientLoop",
    // Not diagnostic: the policy reads only player-visible prices (market quotes
    // and effective base prices), not sim internals like flow drift or RNG state.
    diagnostic: false,
    init(world) {
      const found = steepestGradient(world);
      const source = params.sourcePortId ?? found.source;
      const target = params.targetPortId ?? found.target;

      // Validate explicit port IDs, if provided.
      if (params.sourcePortId) {
        const sourcePortExists = world.region.ports.some((p) => p.id === params.sourcePortId);
        if (!sourcePortExists) {
          throw new Error(
            `gradientLoop: sourcePortId "${params.sourcePortId}" does not exist in this region`,
          );
        }
      }
      if (params.targetPortId) {
        const targetPortExists = world.region.ports.some((p) => p.id === params.targetPortId);
        if (!targetPortExists) {
          throw new Error(
            `gradientLoop: targetPortId "${params.targetPortId}" does not exist in this region`,
          );
        }
      }

      return {
        good: params.good ?? found.good,
        source,
        target,
      };
    },
    act(world, memory) {
      const ship = world.company.ships[0];
      if (ship === undefined || ship.location.kind !== "docked") {
        return { commands: [], memory };
      }
      const { good, source, target } = memory;
      const at = ship.location.portId;
      const carried = amountOf(ship.cargo, good);

      if (at === target && carried > 0) {
        const commands: Command[] = [
          { kind: "sell", shipId: ship.id, good, qty: carried },
          { kind: "sailTo", shipId: ship.id, portId: source },
        ];
        return { commands, memory };
      }

      if (at === source) {
        const holdSpace = ship.hold - cargoUsed(ship);
        const port = world.region.ports.find((p) => p.id === source)!;
        const qty = maxAffordableQty(
          port.market[good],
          effectiveBase(port, good),
          holdSpace,
          world.company.thalers,
        );
        if (qty <= 0) {
          // Nothing affordable or nothing in stock: wait for the port to
          // restock rather than sailing an empty hold.
          return { commands: carried > 0 ? [{ kind: "sailTo", shipId: ship.id, portId: target }] : [], memory };
        }
        const commands: Command[] = [
          { kind: "buy", shipId: ship.id, good, qty },
          { kind: "sailTo", shipId: ship.id, portId: target },
        ];
        return { commands, memory };
      }

      // Docked anywhere else (the Company's random starting port, say):
      // head for whichever end of the loop the hold calls for.
      const portId = carried > 0 ? target : source;
      return { commands: [{ kind: "sailTo", shipId: ship.id, portId }], memory };
    },
  };
}
