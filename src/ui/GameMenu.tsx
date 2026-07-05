import { useRef, type ChangeEvent } from "react";
import { useGameStore } from "../store/gameStore";
import { exportWorldJson, parseWorldJson } from "../store/persistence";

/**
 * Save menu (docs/specs/E2-trade-loop.md — Save/load): export the current
 * world to a downloaded JSON file, or import one from disk. Lives in the top
 * bar. File I/O is browser-standard (Blob download + hidden file input).
 */
export function GameMenu() {
  const world = useGameStore((s) => s.world);
  const loadWorld = useGameStore((s) => s.loadWorld);
  const fileInput = useRef<HTMLInputElement>(null);

  const onExport = () => {
    if (!world) return;
    const blob = new Blob([exportWorldJson(world)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `etersim-day${Math.floor(world.tick / 24) + 1}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const onImportFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // reset so choosing the same file again re-fires change
    if (!file) return;
    try {
      loadWorld(parseWorldJson(await file.text()));
    } catch {
      window.alert("Could not import that file — it is not a valid etersim save.");
    }
  };

  return (
    <div className="top-bar__menu" role="group" aria-label="Save menu">
      <button type="button" className="menu-btn" onClick={onExport} disabled={!world}>
        Export
      </button>
      <button type="button" className="menu-btn" onClick={() => fileInput.current?.click()}>
        Import
      </button>
      <input
        ref={fileInput}
        className="menu-file"
        type="file"
        accept="application/json,.json"
        aria-label="Import save file"
        onChange={onImportFile}
      />
    </div>
  );
}
