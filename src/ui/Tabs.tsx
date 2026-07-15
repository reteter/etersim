import { useEffect } from "react";

/** True when a keydown's target is a place the player is typing (input,
 *  textarea, contenteditable) — `,`/`.` must reach the route-name field
 *  (HeadquartersPanel's RouteEditor) and any other text input untouched,
 *  not get hijacked into a tab cycle. Same guard shape as TopBar's keydown
 *  handler for the existing single-letter hotkeys. */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable;
}

/**
 * Shared tab strip (#181, professor-review-ui-store-2026-07-14 Finding 2):
 * one `role="tablist"` + active-styling pattern, replacing the hand-rolled
 * `.ledger__tabs`/`.headquarters-tabs` shells (each with its own `Tab` union,
 * its own active-class ternary, its own CSS family). Generic over the tab id
 * union `T` so each overlay keeps its own `Tab` type without re-deriving the
 * rendering.
 *
 * #218: while mounted, `,`/`.` cycle the active tab left/right (wrapping).
 * Only one overlay renders a `Tabs` strip at a time (each overlay is modal),
 * so a document-level listener owned by this one instance is safe — no need
 * to route through TopBar's own keydown handler or track "which overlay is
 * focused" separately.
 */
export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
  ariaLabel,
}: {
  tabs: readonly { id: T; label: string }[];
  active: T;
  onChange: (id: T) => void;
  ariaLabel?: string;
}) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "," && e.key !== ".") return;
      if (isTypingTarget(e.target)) return;
      const i = tabs.findIndex((t) => t.id === active);
      if (i === -1) return;
      const delta = e.key === "," ? -1 : 1;
      const next = tabs[(i + delta + tabs.length) % tabs.length];
      onChange(next.id);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [tabs, active, onChange]);

  return (
    <div className="overlay__tabs" role="tablist" aria-label={ariaLabel}>
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={active === t.id}
          className={active === t.id ? "overlay__tab overlay__tab--active" : "overlay__tab"}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
