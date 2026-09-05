import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * A side panel.
 *
 * Preferred over Modal when the content is a list or a long form and the
 * context behind it stays relevant — reviewing a child while the list
 * remains visible, for instance.
 */
export function Drawer({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  side = "right",
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  side?: "left" | "right";
}) {
  useEffect(() => {
    if (!isOpen) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);

    // Stop the page behind from scrolling while the panel is open.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div
        className={cn("flex-1 bg-ink-900/40", side === "left" && "order-2")}
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "flex w-full max-w-md flex-col bg-white shadow-lifted",
          side === "left" && "order-1",
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-ink-100 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-ink-900">{title}</h2>
            {description !== undefined && (
              <p className="mt-1 text-sm text-ink-500">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="rounded-pill p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {footer !== undefined && (
          <div className="flex justify-end gap-2 border-t border-ink-100 px-5 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
