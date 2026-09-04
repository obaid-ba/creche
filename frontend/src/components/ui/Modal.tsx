import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * Accessible dialog built on the native <dialog> element, which gives us
 * focus trapping, Escape handling and the top layer for free rather than
 * reimplementing them.
 */
export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  className,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) return;

    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  // The Escape key closes the dialog natively; mirror that into state so
  // the parent's `isOpen` cannot drift out of sync with what is shown.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) return;

    const handleCancel = (event: Event) => {
      event.preventDefault();
      onClose();
    };
    dialog.addEventListener("cancel", handleCancel);
    return () => dialog.removeEventListener("cancel", handleCancel);
  }, [onClose]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="modal-title"
      className={cn(
        "w-[min(32rem,calc(100vw-2rem))] rounded-card bg-white p-0 shadow-lifted",
        "backdrop:bg-ink-900/40 backdrop:backdrop-blur-sm",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4 border-b border-ink-100 px-5 py-4">
        <div>
          <h2 id="modal-title" className="text-lg font-bold text-ink-900">
            {title}
          </h2>
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

      <div className="px-5 py-4">{children}</div>

      {footer !== undefined && (
        <div className="flex justify-end gap-2 border-t border-ink-100 px-5 py-4">
          {footer}
        </div>
      )}
    </dialog>
  );
}
