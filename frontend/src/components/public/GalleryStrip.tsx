import { ArrowRight, Images } from "lucide-react";
import { Link } from "react-router-dom";

import { SectionHeading } from "@/components/ui";
import { GALLERY } from "@/config/nursery";

/**
 * Four photographs and a link through to the full gallery.
 *
 * Sizes vary deliberately — an even four-up grid is the "boring grid"
 * the brief rules out, and varying them gives the row a focal point.
 */
export function GalleryStrip() {
  const photos = GALLERY.slice(1, 5);

  return (
    <div>
      <SectionHeading title="Galerie" align="left" />

      <ul className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {photos.map((photo, index) => (
          <li
            key={photo.src}
            className={index === 0 ? "sm:row-span-2 lg:col-span-2" : ""}
          >
            <img
              src={photo.thumb}
              alt={photo.alt}
              width={600}
              height={600}
              loading="lazy"
              decoding="async"
              className={`w-full rounded-card object-cover shadow-soft transition-transform duration-300 hover:scale-[1.03] ${
                index === 0 ? "h-full min-h-40" : "aspect-square"
              }`}
            />
          </li>
        ))}

        <li>
          <Link
            to="/gallery"
            className="group flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-card bg-primary-600 p-3 text-center text-white shadow-soft transition-colors hover:bg-primary-700"
          >
            <Images aria-hidden="true" className="size-5" />
            <span className="text-xs font-bold leading-tight">
              Voir toute
              <br />
              la galerie
            </span>
            <ArrowRight
              aria-hidden="true"
              className="size-4 transition-transform group-hover:translate-x-0.5"
            />
          </Link>
        </li>
      </ul>
    </div>
  );
}
