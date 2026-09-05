import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/cn";

export interface DropdownItem {
  key: string;
  label: string;
  icon?: ReactNode;
  tone?: "default" | "danger";
  onSelect: () => void;
}

/**
 * A menu of actions.
 *
 * Closes on outside click and on Escape, and returns focus to the
 * trigger so keyboard users are not stranded at the top of the document.
 */
export function Dropdown({
  label,
  items,
  align = "right",
}: {
  label: string;
  items: readonly DropdownItem[];
  align?: "left" | "right";
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const onPointer = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
        className="inline-flex h-9 items-center gap-1.5 rounded-pill border border-ink-200 bg-white px-3 text-sm font-semibold text-ink-700 hover:bg-ink-50"
      >
        {label}
        <ChevronDown aria-hidden="true" className="size-4" />
      </button>

      {isOpen && (
        <div
          role="menu"
          className={cn(
            "absolute z-40 mt-1 min-w-44 overflow-hidden rounded-card",
            "border border-ink-100 bg-white py-1 shadow-lifted",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              onClick={() => {
                setIsOpen(false);
                item.onSelect();
              }}
              className={cn(
                "flex w-full items-center gap-2 px-3.5 py-2 text-left text-sm",
                item.tone === "danger"
                  ? "text-danger-700 hover:bg-danger-50"
                  : "text-ink-700 hover:bg-ink-50",
              )}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
