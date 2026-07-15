// Vitest setup: registers @testing-library/jest-dom's DOM matchers
// (e.g. toBeInTheDocument) for component tests. Importing this module has
// no DOM/browser side effects on its own, so it's safe to load for every
// test file, including the node-environment sim suite.
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Testing Library's auto-cleanup hooks into Jest's global afterEach; Vitest
// needs it wired explicitly so each jsdom component test starts from an
// empty document (otherwise queries across tests collide). Guarded behind
// a `document` check so it's a no-op under the node-environment sim suite,
// which has no DOM (and no jsdom import cost) at all.
afterEach(() => {
  if (typeof document !== "undefined") cleanup();
});
