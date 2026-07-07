import { describe, expect, it } from "vitest";
import type { StorageLike } from "./persistence";
import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  SETTINGS_KEY,
  SETTINGS_VERSION,
} from "./settings";

/** In-memory StorageLike so round-trips need no browser (Vitest runs in node). */
function fakeStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    },
    removeItem: (k) => {
      map.delete(k);
    },
  };
}

describe("settings persistence", () => {
  it("defaults to autoPauseOnArrival: true when the slot is absent", () => {
    expect(loadSettings(fakeStorage())).toEqual(DEFAULT_SETTINGS);
    expect(DEFAULT_SETTINGS.autoPauseOnArrival).toBe(true);
  });

  it("round-trips a written setting", () => {
    const storage = fakeStorage();
    saveSettings({ autoPauseOnArrival: false }, storage);
    expect(loadSettings(storage)).toEqual({ autoPauseOnArrival: false });
  });

  it("uses its own key, separate from the game save", () => {
    const storage = fakeStorage();
    saveSettings({ autoPauseOnArrival: false }, storage);
    expect(storage.getItem(SETTINGS_KEY)).not.toBeNull();
    expect(storage.getItem("etersim.autosave")).toBeNull();
  });

  it("falls back to defaults on a version mismatch", () => {
    const storage = fakeStorage();
    storage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ version: SETTINGS_VERSION + 1, settings: { autoPauseOnArrival: false } }),
    );
    expect(loadSettings(storage)).toEqual(DEFAULT_SETTINGS);
  });

  it("falls back to defaults on unparseable content", () => {
    const storage = fakeStorage();
    storage.setItem(SETTINGS_KEY, "{ not json");
    expect(loadSettings(storage)).toEqual(DEFAULT_SETTINGS);
  });

  it("falls back to defaults on a malformed shape", () => {
    const storage = fakeStorage();
    storage.setItem(SETTINGS_KEY, JSON.stringify({ version: SETTINGS_VERSION, settings: {} }));
    expect(loadSettings(storage)).toEqual(DEFAULT_SETTINGS);
  });

  it("returns defaults when no storage is available (null)", () => {
    expect(loadSettings(null)).toEqual(DEFAULT_SETTINGS);
  });

  it("saveSettings is a no-op when no storage is available (null)", () => {
    expect(() => saveSettings({ autoPauseOnArrival: false }, null)).not.toThrow();
  });
});
