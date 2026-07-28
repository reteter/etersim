import type { Policy } from "../policy.ts";
import { doNothing } from "./doNothing.ts";
import { gradientLoop, type GradientLoopParams } from "./gradientLoop.ts";

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
};

export const POLICY_NAMES: readonly string[] = ["doNothing", "gradientLoop"];

export function resolvePolicy(name: string, params: Record<string, unknown>): Policy<unknown> {
  const factory = POLICY_REGISTRY[name];
  if (!factory) {
    throw new Error(`Unknown policy "${name}" — known policies: ${POLICY_NAMES.join(", ")}`);
  }
  return factory(params);
}
