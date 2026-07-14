/**
 * Shared tab strip (#181, professor-review-ui-store-2026-07-14 Finding 2):
 * one `role="tablist"` + active-styling pattern, replacing the hand-rolled
 * `.ledger__tabs`/`.headquarters-tabs` shells (each with its own `Tab` union,
 * its own active-class ternary, its own CSS family). Generic over the tab id
 * union `T` so each overlay keeps its own `Tab` type without re-deriving the
 * rendering.
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
