# TypeScript + Vite + React web stack

etersim is a map-and-panels trading simulation, so UI iteration speed matters more than rendering power. We build it as a browser app: Vite + TypeScript, React with Zustand for the view layer, SVG/Canvas for the region map.

## Considered Options

- **Godot 4** — rejected: panel-heavy UI is slower to build than in the web ecosystem.
- **C# + desktop (Avalonia/MonoGame)** — rejected: slower UI iteration, heavier toolchain.
- **Rust + WASM sim** — rejected for v1: upfront complexity not justified; the pure-TS sim boundary (ADR-0002) keeps this door open.

Desktop packaging (Tauri) remains an open option later; it does not affect the stack choice.
