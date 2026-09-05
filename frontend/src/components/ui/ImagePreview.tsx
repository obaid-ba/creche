import { X } from "lucide-react";
import { useEffect } from "react";

import { cn } from "@/lib/cn";

export interface PreviewImage {
  id: string;
  url: string;
  thumbnailUrl?: string | null;
  caption?: string;
}

/**
 * A thumbnail strip that opens a full-size viewer.
 *
 * Separate from GalleryGrid: that one lays out the public site's photo
 * wall, this one attaches a small set of images to a record (an activity,
 * a message) and optionally lets staff remove them.
 */
export function ImagePreview({
  images,
  onRemove,
  openIndex,
  onOpenChange,
}: {
  images: PreviewImage[];
  onRemove?: (id: string) => void;
  openIndex: number | null;
  onOpenChange: (index: number | null) => void;
}) {
  const active = openIndex === null ? undefined : images[openIndex];

  useEffect(() => {
    if (openIndex === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(null);
      if (event.key === "ArrowRight")
        onOpenChange((openIndex + 1) % images.length);
      if (event.key === "ArrowLeft")
        onOpenChange((openIndex - 1 + images.length) % images.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openIndex, images.length, onOpenChange]);

  if (images.length === 0) return null;

  return (
    <>
      <ul className="flex flex-wrap gap-2">
        {images.map((image, index) => (
          <li key={image.id} className="relative">
            <button
              type="button"
              onClick={() => onOpenChange(index)}
              aria-label={`Agrandir ${image.caption ?? "l'image"}`}
              className="block overflow-hidden rounded-card"
            >
              <img
                src={image.thumbnailUrl ?? image.url}
                alt={image.caption ?? ""}
                width={96}
                height={96}
                loading="lazy"
                className="size-24 object-cover transition-transform hover:scale-105"
              />
            </button>

            {onRemove !== undefined && (
              <button
                type="button"
                onClick={() => onRemove(image.id)}
                aria-label="Supprimer cette image"
                className={cn(
                  "absolute -right-1.5 -top-1.5 grid size-6 place-items-center",
                  "rounded-full bg-white text-ink-500 shadow-soft",
                  "hover:bg-danger-50 hover:text-danger-700",
                )}
              >
                <X aria-hidden="true" className="size-3.5" />
              </button>
            )}
          </li>
        ))}
      </ul>

      {active !== undefined && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={active.caption ?? "Image"}
          onClick={() => onOpenChange(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/85 p-4"
        >
          <button
            type="button"
            aria-label="Fermer"
            onClick={() => onOpenChange(null)}
            className="absolute right-4 top-4 rounded-pill bg-white/10 p-2 text-white hover:bg-white/20"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
          <img
            src={active.url}
            alt={active.caption ?? ""}
            onClick={(event) => event.stopPropagation()}
            className="max-h-full max-w-full rounded-card object-contain"
          />
        </div>
      )}
    </>
  );
}
