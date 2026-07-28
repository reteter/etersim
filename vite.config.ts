/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    // Default stays "node": the sim/store suite is pure TS (ADR-0002) and
    // must not pay the jsdom setup cost. Individual component test files
    // opt into jsdom via a per-file `// @vitest-environment jsdom` pragma
    // (see src/ui/Tabs.test.tsx) — vitest 4 dropped `environmentMatchGlobs`
    // from the config type, so a glob-based split isn't available here.
    environment: "node",
    // scripts/**/*.test.mjs: docs-tooling tests for scripts/normalize-markdown.mjs
    // (#341). scripts/ stays outside the tsconfig project references
    // (tsconfig.json) — this include is vitest-only, doesn't pull the .mjs
    // module into typecheck.
    // harness/**/*.test.ts (#232): the E11 Harness lives outside the Vite
    // bundle and runs with tsx, but its suites are plain node-environment
    // Vitest like the sim's — this include is vitest-only and changes
    // nothing about the bundle (harness/ has its own tsconfig project,
    // tsconfig.harness.json, for typecheck).
    include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.mjs", "harness/**/*.test.ts"],
    setupFiles: ["src/test-setup.ts"],
  },
});
