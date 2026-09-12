import { ActivitiesAndGallery } from "@/components/public/ActivitiesStrip";
import { DailyLife } from "@/components/public/DailyLife";
import { GalleryStrip } from "@/components/public/GalleryStrip";
import { Hero } from "@/components/public/Hero";
import { ParentPortalPreview } from "@/components/public/ParentPortalPreview";
import { RegistrationCta } from "@/components/public/RegistrationCta";
import { ValuesBand } from "@/components/public/ValuesBand";

/**
 * The landing page: a running order, nothing more.
 *
 * It used to be a 380-line component holding every section inline, which
 * meant any new section grew the same file and nothing could be reused.
 * Each section now owns its own markup and its own data.
 */
export function HomePage() {
  return (
    <>
      <Hero />
      <ValuesBand />
      <DailyLife />
      <ParentPortalPreview />
      <ActivitiesAndGallery gallery={<GalleryStrip />} />
      <RegistrationCta />
    </>
  );
}
