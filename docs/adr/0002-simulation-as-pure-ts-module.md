# Simulation as a pure TypeScript module, separate from UI

The simulation core lives in `src/sim` as pure TypeScript with zero dependencies on React, the DOM, or UI state. The UI reads sim state through a thin store bridge (Zustand) and issues player commands; sim code never imports from UI code.

## Consequences

- The economy is fully unit-testable and deterministic (TDD applies to `src/sim` — see docs/WORKFLOW.md).
- The sim can later move to a Web Worker or be rewritten in Rust/WASM without touching the UI.
- Any PR that introduces a UI import inside `src/sim` is wrong by definition.
