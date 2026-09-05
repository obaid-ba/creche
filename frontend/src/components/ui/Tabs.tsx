import { cn } from "@/lib/cn";

export interface TabItem {
  key: string;
  label: string;
  count?: number;
}

/**
 * Tab bar following the ARIA tabs pattern, including arrow-key roving
 * focus — a tab list that can only be reached with Tab is a common
 * accessibility miss.
 */
export function Tabs({
  items,
  value,
  onChange,
  label,
}: {
  items: readonly TabItem[];
  value: string;
  onChange: (key: string) => void;
  label: string;
}) {
  function onKeyDown(event: React.KeyboardEvent) {
    const index = items.findIndex((item) => item.key === value);
    if (index === -1) return;

    if (event.key === "ArrowRight") {
      event.preventDefault();
      onChange(items[(index + 1) % items.length]?.key ?? value);
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      onChange(items[(index - 1 + items.length) % items.length]?.key ?? value);
    }
  }

  return (
    <div
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className="flex gap-1 overflow-x-auto border-b border-ink-100"
    >
      {items.map((item) => {
        const isActive = item.key === value;
        return (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(item.key)}
            className={cn(
              "flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3.5 py-2.5",
              "text-sm font-semibold transition-colors",
              isActive
                ? "border-primary-500 text-primary-700"
                : "border-transparent text-ink-500 hover:text-ink-800",
            )}
          >
            {item.label}
            {item.count !== undefined && (
              <span
                className={cn(
                  "rounded-pill px-1.5 py-0.5 text-xs",
                  isActive ? "bg-primary-100 text-primary-800" : "bg-ink-100 text-ink-600",
                )}
              >
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
