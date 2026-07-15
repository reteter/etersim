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
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["src/test-setup.ts"],
  },
});
