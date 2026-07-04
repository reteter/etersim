import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["dist", "coverage", "node_modules"],
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
    languageOptions: {
      globals: {},
    },
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "react",
              message: "src/sim is pure TS (ADR-0002): no React imports.",
            },
            {
              name: "react-dom",
              message: "src/sim is pure TS (ADR-0002): no React DOM imports.",
            },
            {
              name: "zustand",
              message: "src/sim is pure TS (ADR-0002): no store/UI framework imports.",
            },
          ],
          patterns: [
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
