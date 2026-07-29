import type { Policy } from "../policy.ts";
import { doNothing } from "./doNothing.ts";
import { gradientLoop, type GradientLoopParams } from "./gradientLoop.ts";
import { greedyContractor } from "./greedyContractor.ts";

/**
 * Name → factory lookup for the `harness run --policy <name>` CLI (#233).
 * A factory takes the CLI's parsed `--params` JSON (or `{}` if omitted) and
 * returns a concrete Policy — the CLI never constructs a Policy by hand, so
 * a new reference policy only has to register here to become reachable.
 *
 * Canonical order (`POLICY_NAMES`) matters only for `--help` and error
 * messages; it does not affect a Run's determinism (a Policy never reads
 * this array).
 */
export type PolicyFactory = (params: Record<string, unknown>) => Policy<unknown>;

export const POLICY_REGISTRY: Readonly<Record<string, PolicyFactory>> = {
  doNothing: () => doNothing,
  // gradientLoop's params are structurally optional and narrow (GoodId/PortId
  // strings) — the registry trusts the CLI's JSON parse and lets a bad value
  // surface as gradientLoop's own runtime lookup failure (`world.region.ports
  // .find(...)!`) rather than re-validating the shape here.
  gradientLoop: (params) => gradientLoop(params as GradientLoopParams),
  // Deliberately adversarial reference policy (docs/experiments/README.md
  // §Bug-hunt mode) — takes no params.
  greedyContractor: () => greedyContractor,
};

export const POLICY_NAMES: readonly string[] = ["doNothing", "gradientLoop", "greedyContractor"];

export function resolvePolicy(name: string, params: Record<string, unknown>): Policy<unknown> {
  // `Object.hasOwn`, not `POLICY_REGISTRY[name]` truthiness — a plain object
  // literal inherits `Object.prototype`, so `name === "constructor"` or
  // `"__proto__"` would otherwise resolve to an inherited value instead of
  // failing the "Unknown policy" check below (wave-check finding).
  if (!Object.hasOwn(POLICY_REGISTRY, name)) {
    throw new Error(`Unknown policy "${name}" — known policies: ${POLICY_NAMES.join(", ")}`);
  }
  return POLICY_REGISTRY[name](params);
}
