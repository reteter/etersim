# E8 living-economy follow-ups — parked design inputs

Parking lot for tradeoffs surfaced while implementing E8 (milestone M2). Terms per
[CONTEXT.md](../../CONTEXT.md); process per [WORKFLOW.md](../WORKFLOW.md); spec
[E8-living-economy.md](../specs/E8-living-economy.md).

---

## 1. Peripheral starvation of remote sole-producer goods

**Surfaced by the #60 invariant suite (2026-07-08).** A coder building the "no port ×
good pinned at floor/ceiling" invariant found that, in 3 of 4 test seeds, the port **two
lane-hops from a good's *sole* producer starves permanently** — its price pins at the
4.0× ceiling across the whole days-31–60 sampling window. Confirmed **independent of
flow drift** (reproduces identically with drift disabled): the driver is pure
market + osmosis.

**Root cause.** Osmosis (#59) diffuses a good one hop out of its producer fine, but its
per-lane `RATE`/`CAP`, attenuated by `voyageTicks`, is negligible two hops out. The
elasticity floor (consumption slows to 0.25×, never to zero — spec §Price-elastic flows)
means a port with no local production and no meaningful osmotic inflow drains toward
stock 0 and its price pins at the ceiling.

**Owner decision (2026-07-08): accept it as intended — a durable gradient, not a bug.**
A remote, expensive, single-source good is exactly the *durable gradient / transient
opportunity* the epic is built on (spec §Principle) and the kind of standing route E9's
fleet will exploit. The #60 invariant is therefore **scoped to encode this**: for a good
with a single net-producer, ports more than one hop from that producer are excluded from
the floor/ceiling-pin check; the dispersion and finite-stock checks stay region-wide, and
multi-producer goods / ≤1-hop ports stay fully checked. This is an owner-agreed
spec-encoding, transparently recorded here — **not** a silently weakened test.

**Playtest verdict (2026-07-09, [playtest-2026-07-09-living.md](playtest-2026-07-09-living.md)):
accepted — the pinned rim reads as a standing premium route** (₸3 → ₸50 grain, ~16×), and
one such route per region doubles as an early-game ramp and natural guide (owner). The
alternatives below **stay parked**. New watch item: worldgen guarantees neither "at most
one" sole-producer rim per region nor its existence — revisit at a worldgen grill if
generated regions oversupply premium routes, or if a future playtest flips the feel.
**Tracked as #359** (filed 2026-07-21, #326 audit) — the same watch item is also stated
independently in `playtest-2026-07-09-living.md:61`; both point here now.

**Parked alternatives (revisit only if a playtest shows the pinned rim *feels* dead, i.e.
reintroduces the "algorithm, not a decision" deadness E8 exists to kill):**

- **Retune osmosis reach (#59 calibration)** — raise `OSMOSIS_RATE`/`OSMOSIS_CAP` or
  soften the `voyageTicks` attenuation so flow reaches ~2 hops. *Cost:* trades directly
  against the "a player ship is always faster than osmosis" property the #60 dominance
  guardrail depends on — any such change must re-validate that guardrail. Deserves a
  deliberate, playtested tuning pass, not a rushed constant bump.
- **Worldgen topology guarantee** — ensure every good has ≥2 producers, or no consumer
  sits >1 hop from a producer. *Cost:* larger scope (worldgen change + its own
  determinism tests) and it constrains regional variety; likely a later epic, not E8.

**Watch for:** the fix path is a balance lever, so tune it against *feel*, not against
the test — the test now says the pinned rim is allowed, by design.
