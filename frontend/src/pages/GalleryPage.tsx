import { useTranslation } from "react-i18next";

import { GALLERY, VIDEOS } from "@/config/nursery";
import { GalleryGrid } from "@/features/public/components/GalleryGrid";
import { VideoEmbed } from "@/features/public/components/VideoEmbed";

export function GalleryPage() {
  const { t } = useTranslation();

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 md:py-16">
      <header className="mb-10 text-center">
        <h1 className="text-3xl font-bold">{t("gallery.title")}</h1>
        <p className="mx-auto mt-3 max-w-xl text-ink-600">
          {t("galleryPage.lead")}
        </p>
      </header>

      <GalleryGrid items={GALLERY} />

      <section className="mt-16">
        <h2 className="text-center text-2xl font-bold">{t("galleryPage.videos")}</h2>
        <ul className="mx-auto mt-8 grid max-w-2xl gap-6 sm:grid-cols-2">
          {VIDEOS.map((video) => (
            <li key={video.src}>
              <VideoEmbed video={video} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
