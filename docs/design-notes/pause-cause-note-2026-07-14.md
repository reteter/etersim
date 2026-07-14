# Pause-cause note — grill record (2026-07-14)

Grill of #130 ("in-game hints for existing mechanics"). Parking-lot item, flagged
"needs grill" for its tension with the E9 law (*buildings introduce mechanics — each
new gameplay layer arrives with a building, not a tutorial*). Outcome: **no hint
system exists**; #130 reframes to a single pause-cause legibility fix, rewritten in
place as the scoped feature. Sibling grill from the same session:
[route-events-2026-07-14.md](route-events-2026-07-14.md) (#131).

## Decision tree

| Fork | Options | Choice | Why |
| --- | --- | --- | --- |
| 1. Hint channel | in-situ fixes / one-time contextual notices / static Tips tab | **in-situ, no system** | the fresh-eyes routing table already fixed the legibility gaps in place (#124 buy-cap reason, #125 docking fee, #127 trend legend, #128 HQ self-explains) — the pattern works; a global hint channel is a tutorial through the back door and a maintenance tax on every future mechanic ("did we add the hint?") |
| 2. Remaining scope | *(resolved from docs, not asked)* | **one orphan: auto-pause ↔ Options** | every other fresh-eyes gap has its own issue; hotkeys are discoverable via the read-only Keybinds tab (#56/#155) |
| 3. Form | transient TopBar note / pause-button tooltip / SidePanel subtitle | **transient TopBar note** | appears at the exact moment of surprise — the game stopped *by itself*; a tooltip is passive (most players never hover), the SidePanel may be closed and sits far from the speed controls it explains |
| 4. Repetition | every time / one-time (persisted "seen") / until first Options visit | **every time** | reframes the note as a *pause-cause readout*, not a hint — the game always says why it is stopped; no persisted "seen" flag, no hint infrastructure re-entering through fork 1 |

## The reframe

The note is not a tutorial. It answers "why is the game stopped?" whenever the answer
isn't "you pressed pause" — interface-state legibility, pillar 4, the same family as
the buy-cap reason (#124). The E9 law is untouched: no gameplay layer is being taught.

## Implementation shape (see the rewritten #130)

Ephemeral pause-cause flag in the store (e.g. `pauseCause: "manual" | "autoArrival"`),
set where arrival auto-pause fires (`gameStore.ts` tick path), cleared on resume;
never serialized (not in the save, not in settings). While the cause is auto-arrival,
the TopBar renders a small note under the speed controls: *"auto-pauza: statek
zacumował (wyłączalna w Opcjach)"*. No sim change, no settings change, no new
CONTEXT.md term (no domain concept — a UI state readout). E2E: note appears on
auto-pause, absent on manual pause, gone on resume.
