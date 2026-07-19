import { createWorld, type Ship, type World } from '../src/sim';

/**
 * Shared World-builder helpers for specs that need a funded Company and/or a
 * ship pre-docked at one end of a lane, ready to assign a two-Stop Route
 * (#272 — was three near-identical copies: headquarters.spec.ts's and
 * route-qty-margin-gate.spec.ts's `routeReadyWorld` were byte-identical
 * apart from which extra field each returned; a third, unfunded shape lived
 * in src/store/waitingStatus.test.ts before that test moved to
 * src/sim/waiting.test.ts, where it stays local — the sim-side derivation
 * tests don't need a funded purse and shouldn't reach into e2e/ for a
 * fixture, so this file only unifies the e2e side).
 */

/** A funded World: default worldgen, thalers bumped so founding + a Build
 *  Order + a rush are all affordable within a test's time budget. */
export function fundedWorld(seed: string, thalers = 100_000): World {
  const w = createWorld(seed);
  return { ...w, company: { ...w.company, thalers } };
}

/** A funded World with s0 docked at one end of its shortest lane, plus a
 *  third port `c` distinct from both ends and the lane's own tick length —
 *  callers destructure only the fields they need. */
export function routeReadyWorld(seed: string): {
  world: World;
  a: string;
  b: string;
  c: string;
  laneTicks: number;
} {
  const w0 = fundedWorld(seed);
  const lane = [...w0.region.lanes].sort((x, y) => x.voyageTicks - y.voyageTicks)[0];
  const ship: Ship = { ...w0.company.ships[0], location: { kind: 'docked', portId: lane.a } };
  const world: World = { ...w0, company: { ...w0.company, ships: [ship] } };
  const c = world.region.ports.find((p) => p.id !== lane.a && p.id !== lane.b)!.id;
  return { world, a: lane.a, b: lane.b, c, laneTicks: lane.voyageTicks };
}
