import { ECONOMIC_ARCHETYPES, type Command } from "../../src/sim/index.ts";
import type { Policy } from "../policy.ts";

/**
 * A deliberately adversarial reference Policy (#234,
 * `docs/experiments/README.md` §Bug-hunt mode): enrolls in every guild it
 * isn't already a member of, then spams `acceptContract` for every open
 * offer it can see, every tick — regardless of rank-gating or whether the
 * fleet can actually deliver the quota. It never sails, buys, sells,
 * delivers or resigns; a real player would never play this way.
 *
 * **This is the probe, not the proof.** It exists to put the guild/contract
 * invariants (`harness/invariants.ts` — the desperation clause, the offer
 * cap, offer-ID uniqueness, haulability) under the kind of rapid
 * enroll-and-accept churn a well-behaved reference policy
 * (`gradientLoop`/`doNothing`) never generates. Running it with
 * `--enable-assertions` and reading `report.json`'s `anomalies` is what
 * actually validates the invariants hold under pressure — an empty
 * anomalies list here means either the invariants held, or this policy
 * isn't perverse enough yet (worked example only, not a general adversarial
 * framework).
 */
export const greedyContractor: Policy<null> = {
  name: "greedyContractor",
  // Not diagnostic: every field read here (world.company.guilds,
  // world.contractOffers) is player-visible board/roster information, not a
  // sim internal.
  diagnostic: false,
  init: () => null,
  act(world, memory) {
    const commands: Command[] = [];
    for (const guildId of ECONOMIC_ARCHETYPES) {
      if (world.company.guilds[guildId] === undefined) {
        commands.push({ kind: "enroll", guildId });
      }
    }
    for (const offer of world.contractOffers) {
      commands.push({ kind: "acceptContract", offerId: offer.id });
    }
    return { commands, memory };
  },
};
