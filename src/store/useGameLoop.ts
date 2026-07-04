import { useEffect } from "react";
import { useGameStore } from "./gameStore";

/**
 * Drives the sim: a requestAnimationFrame loop measuring real elapsed
 * time and feeding it to the store's advance(). Mount exactly once.
 */
export function useGameLoop(): void {
  const advance = useGameStore((state) => state.advance);
  useEffect(() => {
    let last = performance.now();
    let frame = 0;
    const onFrame = (now: number) => {
      advance(now - last);
      last = now;
      frame = requestAnimationFrame(onFrame);
    };
    frame = requestAnimationFrame(onFrame);
    return () => cancelAnimationFrame(frame);
  }, [advance]);
}
