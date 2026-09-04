import { Play } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/cn";
import type { VideoItem } from "@/config/nursery";

/**
 * A video, played on demand.
 *
 * The Facebook embed is behind a click-to-load facade: an iframe would
 * otherwise load Facebook's tracking scripts and cookies for every
 * visitor to a page about a nursery, including those who never watch.
 * Nothing third-party loads until the visitor asks for it.
 *
 * The local file uses `preload="metadata"` so a 6 MB clip is not pulled
 * down on page load.
 */
export function VideoEmbed({ video }: { video: VideoItem }) {
  const [isLoaded, setIsLoaded] = useState(false);

  const frame = cn(
    "relative overflow-hidden rounded-card bg-ink-900 shadow-soft",
    video.aspect === "portrait" ? "aspect-[9/16]" : "aspect-video",
  );

  if (video.kind === "local") {
    return (
      <figure>
        <div className={frame}>
          <video
            controls
            preload="metadata"
            playsInline
            {...(video.poster !== undefined ? { poster: video.poster } : {})}
            className="size-full object-cover"
          >
            <source src={video.src} type="video/mp4" />
            Votre navigateur ne peut pas lire cette vidéo.
          </video>
        </div>
        <figcaption className="mt-2 text-sm font-semibold text-ink-700">
          {video.title}
        </figcaption>
      </figure>
    );
  }

  return (
    <figure>
      <div className={frame}>
        {isLoaded ? (
          <iframe
            src={video.src}
            title={video.title}
            allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
            allowFullScreen
            className="size-full border-0"
          />
        ) : (
          <button
            type="button"
            onClick={() => setIsLoaded(true)}
            className="group size-full bg-gradient-to-br from-primary-200 via-accent-200 to-secondary-200"
          >
            <span className="flex size-full flex-col items-center justify-center gap-3">
              <span className="grid size-16 place-items-center rounded-full bg-white/90 shadow-lifted transition-transform group-hover:scale-105">
                <Play aria-hidden="true" className="size-7 translate-x-0.5 text-primary-600" />
              </span>
              <span className="px-4 text-sm font-bold text-ink-800">
                Lire la vidéo
              </span>
              <span className="px-6 text-xs text-ink-600">
                La lecture charge du contenu Facebook
              </span>
            </span>
          </button>
        )}
      </div>
      <figcaption className="mt-2 text-sm font-semibold text-ink-700">
        {video.title}
      </figcaption>
    </figure>
  );
}
