# Route events — grill record (2026-07-14)

Grill of #131 ("random route events: pirates, wandering merchant, another
civilization — parked"). Fresh-eyes signal behind it: the playtester independently
asked for more *life* on the map
(`playtest-2026-07-12-fresh-eyes-kacper.md`; see also his supplier-ships idea, PRD
Horizon). Outcome: the idea splits into **three layers with different fates** —
ambient ships now, opt-in offers parked to post-E3, intrusive events parked to
multiregion. Sibling grill from the same session:
[pause-cause-note-2026-07-14.md](pause-cause-note-2026-07-14.md) (#130).

## Decision tree

| Fork | Options | Choice | Why |
| --- | --- | --- | --- |
| 1. Character (what may touch the player) | opt-in + ambient / intrusive mechanics / reject | **opt-in + ambient** — events never interrupt or modify player routes, cargo or purse. Owner addendum: active at region-view scale (with future multiregion, rendered per viewed region) | pillar 4 (routes are legible loops) and the M3 no-punishment lock stay untouched; the fresh-eyes job was "life", not "hazard" |
| 2. Packaging | phased / one small epic now / everything behind multiregion | **phased: ambient now, opt-in after E3** | E3 already builds the offer machinery — generator, causal expiry, accept/resign (#93/#94/#96); a wandering merchant's offer is that machinery's cousin, building it earlier duplicates it |
| 3. Ambient content | flows-as-ships replacing pulses / ships alongside pulses / decorative random traffic | **NPC ships = Trade osmosis flows, replacing the pulses** | the playtester already misread the pulses as small ships (#72 / playtest item 1) — the misreading becomes the design; life that is also economic signal (pillar 4); one glyph = one meaning; sim-time anchoring solves #72's wall-clock complaint in the same stroke |
| 4. Pirates / intrusive events | park with trigger / reject permanently / grill non-punitive pirates now | **parked with a hard trigger** (see Phase 3) | keeps the "lane risk" design space alive without letting the first punitive mechanic enter casually; nothing on the roadmap needs it now |

## Law locks (not forks — recorded, non-negotiable)

- **Sim never depends on what is viewed** (ADR-0002 purity, ADR-0003 determinism).
  "Active at region-view scale" constrains *rendering only*: the ambient layer may be
  cosmetic and view-local (like the pulses it replaces — derived from
  `World.osmosisPulse`, no sim state of its own); opt-in offers (Phase 2) must live
  deterministically in the sim regardless of view, the region view merely shows them.
- **NPC ships must be unmistakable vs the player fleet**: no gold (ADR-0006,
  incident 0002 — gold belongs to the Controlled Ship), distinct silhouette/scale.

## Phases

- **Phase 1 — ambient osmosis ships** (scoped issue filed from this grill): the
  per-lane Trade osmosis signal renders as small NPC trader ships instead of abstract
  pulses. UI-only, cosmetic, view-local; anchored to sim time so pause freezes them
  and speed scales them (retires #72). New display concept named in CONTEXT.md with
  the implementing PR (glossary-first; candidate term: *osmosis skiff*).
- **Phase 2 — opt-in encounter offers** (parked in #131): wandering merchant, another
  civilization — an event is an *offer*; ignoring it has zero consequences for route,
  cargo and purse. **Unpark trigger: E3 contracts shipped** (rides E3's offer
  machinery). Own grill at unpark: offer content, spawn/expiry model, region scope.
- **Phase 3 — intrusive events, pirates** (parked in #131): anything that modifies
  route outcomes. **Unpark trigger (all required): real multiregion exists + explicit
  owner decision to revisit the M3 no-punishment lock + a carrier building per the E9
  law (e.g. an Escort dock) + its own grill.**
