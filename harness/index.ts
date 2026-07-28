/**
 * Public surface of the E11 Harness (docs/specs/E11-proving-grounds.md).
 * The Harness imports `src/sim` as a plain consumer (ADR-0002); the sim never
 * imports anything from here.
 */
export { runPolicy, type Policy, type RunResult } from "./policy.ts";
export { doNothing } from "./policies/doNothing.ts";
export {
  gradientLoop,
  type GradientLoopMemory,
  type GradientLoopParams,
} from "./policies/gradientLoop.ts";
