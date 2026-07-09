import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["dist", "coverage", "node_modules", "tmp"],
  },
  {
    files: ["**/*.{ts,tsx}"],
    extends: [...tseslint.configs.recommended],
    // eslint-plugin-react-hooks and eslint-plugin-react-refresh ship their
    // presets with `plugins` as an array of names (eslintrc-style), which
    // flat config rejects — so plugins/rules are wired up by hand here.
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs["recommended-latest"].rules,
      ...reactRefresh.configs.vite.rules,
    },
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  {
    // ADR-0002: src/sim is a pure TS module. No React/DOM, no UI store, no
    // imports reaching outside src/sim, and (CLAUDE.md) no non-deterministic
    // wall-clock time or randomness.
    files: ["src/sim/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          // `paths` only matches exact specifiers, so subpath imports like
          // "react-dom/client" or "zustand/vanilla" would slip through it.
          // Ban whole packages (and their subpaths) via `patterns` globs
          // instead; the `ignore`-based matcher these compile to also
          // matches "../*" against any depth of "../" escapes (proven
          // empirically: "../*" flags "../a", "../../a", "../../../a", ...).
          patterns: [
            {
              group: ["react", "react/**"],
              message: "src/sim is pure TS (ADR-0002): no React imports.",
            },
            {
              group: ["react-dom", "react-dom/**"],
              message: "src/sim is pure TS (ADR-0002): no React DOM imports.",
            },
            {
              group: ["zustand", "zustand/**"],
              message: "src/sim is pure TS (ADR-0002): no store/UI framework imports.",
            },
            {
              group: ["../*"],
              message: "src/sim must not import from outside src/sim (ADR-0002).",
            },
          ],
        },
      ],
      "no-restricted-globals": [
        "error",
        { name: "document", message: "src/sim is pure TS (ADR-0002): no DOM access." },
        { name: "window", message: "src/sim is pure TS (ADR-0002): no DOM access." },
        { name: "localStorage", message: "src/sim is pure TS (ADR-0002): no DOM/storage access." },
      ],
      "no-restricted-properties": [
        "error",
        {
          object: "Math",
          property: "random",
          message: "Determinism: all sim randomness must flow from the seeded RNG (CLAUDE.md).",
        },
        {
          object: "Date",
          property: "now",
          message: "Determinism: no wall-clock time inside src/sim (CLAUDE.md).",
        },
      ],
    },
  },
);
