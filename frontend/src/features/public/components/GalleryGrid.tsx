import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import type { GalleryItem } from "@/config/nursery";
import { useDirection } from "@/i18n/useDirection";

/** Photo grid with a lightbox. Images load lazily; the grid does not. */
export function GalleryGrid({ items }: { items: GalleryItem[] }) {
  const { t } = useTranslation();
  const { dir } = useDirection();
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const active = openIndex === null ? null : items[openIndex];

  useEffect(() => {
    if (openIndex === null) return;

    // The arrow keys follow the reading direction, not the screen: in
    // Arabic the next photo is to the left, so ArrowLeft advances.
    const forward = dir === "rtl" ? "ArrowLeft" : "ArrowRight";
    const back = dir === "rtl" ? "ArrowRight" : "ArrowLeft";

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenIndex(null);
      if (event.key === forward)
        setOpenIndex((i) => (i === null ? null : (i + 1) % items.length));
      if (event.key === back)
        setOpenIndex((i) =>
          i === null ? null : (i - 1 + items.length) % items.length,
        );
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openIndex, items.length, dir]);

  return (
    <>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((item, index) => (
          <li key={item.src}>
            <button
              type="button"
              onClick={() => setOpenIndex(index)}
              className="block w-full overflow-hidden rounded-card focus-visible:outline-2"
              aria-label={t("gallery.enlarge", { alt: item.alt })}
            >
              <img
                src={item.thumb}
                alt={item.alt}
                // Explicit dimensions reserve the tile before the image
                // arrives, so the grid does not reflow as photos load.
                width={600}
                height={600}
                loading="lazy"
                decoding="async"
                className="aspect-square w-full object-cover transition-transform duration-300 hover:scale-105"
              />
            </button>
          </li>
        ))}
      </ul>

      {active !== undefined && active !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={active.alt}
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/85 p-4"
          onClick={() => setOpenIndex(null)}
        >
          <button
            type="button"
            aria-label={t("gallery.close")}
            onClick={() => setOpenIndex(null)}
            className="absolute end-4 top-4 rounded-pill bg-white/10 p-2 text-white hover:bg-white/20"
          >
            <X aria-hidden="true" className="size-5" />
          </button>

          <img
            src={active.src}
            alt={active.alt}
            // Full size, fetched only when a photo is actually opened.
            fetchPriority="high"
            className="max-h-full max-w-full rounded-card object-contain"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
