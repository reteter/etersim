import type { Policy } from "../policy.ts";

/**
 * The trivial reference Policy: never issues a Command. The world runs on its
 * own (production, consumption, drift, osmosis) while the Company sits idle.
 *
 * Its jobs: the null baseline every other policy is compared against, and the
 * smallest possible conformance case for the Policy contract
 * (docs/specs/E11-proving-grounds.md §Testing).
 */
export const doNothing: Policy<null> = {
  name: "doNothing",
  init: () => null,
  act: () => ({ commands: [], memory: null }),
};
