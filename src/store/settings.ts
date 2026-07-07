import type { StorageLike } from "./persistence";

/**
 * Settings persistence (docs/design-notes/trade-loop-followups.md item 5): a
 * separate localStorage key from the game save (`etersim.autosave`), so
 * player preferences survive independently of any world/save lifecycle.
 */

/** Settings slot key in localStorage — deliberately distinct from
 *  `AUTOSAVE_KEY` (docs/specs/E2-trade-loop.md — Options / settings view). */
export const SETTINGS_KEY = "etersim.settings";

/** Settings envelope version, mirroring the save file's version gate. */
export const SETTINGS_VERSION = 1;

/** Persisted player settings (first tenant: auto-pause on arrival, #36). */
export interface Settings {
  readonly autoPauseOnArrival: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  autoPauseOnArrival: true,
};

interface SettingsFile {
  readonly version: typeof SETTINGS_VERSION;
  readonly settings: Settings;
}

/** localStorage when present (browser), otherwise null (e.g. Node tests that
 *  don't inject a storage). Resolved lazily per call, never at module load. */
function defaultStorage(): StorageLike | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** True for a parsed value that is a settings envelope of a version we can
 *  read, with an `autoPauseOnArrival` boolean. Anything else is unreadable. */
function isReadableSettingsFile(value: unknown): value is SettingsFile {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as { version?: unknown; settings?: unknown };
  if (candidate.version !== SETTINGS_VERSION) return false;
  if (typeof candidate.settings !== "object" || candidate.settings === null) return false;
  const settings = candidate.settings as { autoPauseOnArrival?: unknown };
  return typeof settings.autoPauseOnArrival === "boolean";
}

/** Reads the settings slot, falling back to `DEFAULT_SETTINGS` on anything
 *  absent, unparseable or version-mismatched — settings must never throw. */
export function loadSettings(storage: StorageLike | null = defaultStorage()): Settings {
  if (!storage) return DEFAULT_SETTINGS;
  const text = storage.getItem(SETTINGS_KEY);
  if (text === null) return DEFAULT_SETTINGS;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return DEFAULT_SETTINGS;
  }
  return isReadableSettingsFile(parsed) ? parsed.settings : DEFAULT_SETTINGS;
}

/** Writes the settings slot. Best-effort: a missing or full store is ignored. */
export function saveSettings(
  settings: Settings,
  storage: StorageLike | null = defaultStorage(),
): void {
  if (!storage) return;
  try {
    const file: SettingsFile = { version: SETTINGS_VERSION, settings };
    storage.setItem(SETTINGS_KEY, JSON.stringify(file));
  } catch {
    // Storage unavailable or quota exceeded — settings are best-effort.
  }
}
