import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// Separate config for the single-file "tester distribution" build
// (npm run build:single, GitHub issue #238). Kept out of vite.config.ts so the
// default `npm run build` output (base, outDir, plugin set) stays untouched:
// - base: "./" so the inlined asset URLs resolve correctly when the file is
//   opened directly via file:// (no web server, no absolute-root assumption).
// - outDir: "dist-single" — never collides with the normal `dist/` used by
//   the GitHub Pages workflow.
// - vite-plugin-singlefile inlines all JS/CSS into index.html so the whole
//   game ships as one file a tester can double-click.
export default defineConfig({
  base: "./",
  plugins: [react(), viteSingleFile()],
  build: {
    outDir: "dist-single",
  },
});
