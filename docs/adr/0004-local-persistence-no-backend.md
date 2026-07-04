# Local persistence, no backend in v1

v1 is single-player and fully client-side: saves go to localStorage, with JSON file export/import as backup. Explicitly out of scope for v1: multiplayer, accounts, server sync, leaderboards, mobile, Steam.

This is a scope decision, not merely technical — every feature must work offline in the browser. Architecture is not pre-bent toward a future server; if one ever appears, it gets its own ADR.
