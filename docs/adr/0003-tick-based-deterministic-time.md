# Tick-based deterministic time

World time advances in discrete ticks (1 tick = 1 world hour); the UI replays ticks at a selectable speed (pause / 1x / 10x / 100x). All sim randomness derives from a seeded RNG, so identical seed + identical player commands ⇒ identical world.

## Considered Options

- **Continuous real-time (delta time)** — rejected: breaks determinism, makes economy tests and balance reproducibility impractical.
- **Purely turn-based** — rejected: loses the feel of a living economy running alongside the player.

## Consequences

- Simulation tests can assert invariants over long runs ("run 10,000 ticks, markets never produce negative stock").
- Save/load is trivially a serialization of world state at a tick boundary.
