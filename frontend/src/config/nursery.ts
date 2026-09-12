/**
 * Real nursery details, in one place.
 *
 * Contact details and the media manifest live here rather than being
 * scattered through components, so updating a phone number or adding a
 * photo is a one-line change.
 */

export const NURSERY = {
  name: "Crèche Mamati",

  /** Header mark: 96px WebP (9 KB). The 512px PNG it came from is 269 KB
   *  and is kept only for the favicon and og:image, where a large square
   *  is actually needed — serving it in a 40px header slot was the single
   *  heaviest asset on the page. */
  logo: "/logo-96.webp",
  logoLarge: "/logo-512.png",

  // Tunisian mobile. `tel:` needs the international form; the display
  // string keeps the local grouping people recognise.
  phone: { display: "99 389 262", href: "tel:+21699389262" },

  facebook: "https://www.facebook.com/profile.php?id=100054364788852",

  /** ⚠️ UNVERIFIED — the design mock showed a placeholder address and the
   *  nursery has not supplied a real one. Confirm or remove before the
   *  site is published; a wrong address silently loses enquiries. */
  email: "contact@creche-mamati.tn",

  location: {
    mapsUrl: "https://maps.app.goo.gl/5uyJERbH2px3cdB48",
    latitude: 37.283058,
    longitude: 9.8604491,
    // Embeddable without an API key.
    embedUrl:
      "https://www.google.com/maps?q=37.283058,9.8604491&hl=fr&z=16&output=embed",
  },

  registrationDocument: "/images/documents/dossier-inscription-2026-2027.pdf",
} as const;

/**
 * ⚠️  UNVERIFIED — CONFIRM BEFORE THE SITE GOES LIVE
 *
 * These are placeholder claims written during development. They were NOT
 * supplied by the nursery. Publishing them unchecked would put wrong
 * information in front of parents — wrong opening hours in particular
 * send people to a locked door.
 *
 * Everything below is displayed publicly. Correct each line, then delete
 * this warning.
 */
export const NURSERY_FACTS = {
  /** Shown in the hero badge and on /about. */
  ageRange: { from: "2 mois", to: "4 ans", verified: false },

  /** Shown on /about and in the services list. */
  openingHours: {
    days: "Du lundi au vendredi",
    from: "07:30",
    to: "18:30",
    verified: false,
  },

  /** "Crèche privée" in the hero badge. */
  kind: { label: "Crèche privée", verified: false },

  /** Shown in the footer and on /contact. */
  email: { value: "contact@creche-mamati.tn", verified: false },

  /** Services listed on the home page. Remove any the nursery does not
   *  actually offer. */
  services: {
    meals: { label: "Repas équilibrés", verified: false },
    activities: { label: "Activités d'éveil", verified: true },
  },
} as const;

/** True once every claim above has been checked with the nursery. */
export const FACTS_VERIFIED = Object.values(NURSERY_FACTS).every((fact) =>
  "verified" in fact ? fact.verified : true,
);

export interface GalleryItem {
  /** Full-size image, shown only in the lightbox. */
  src: string;
  /** Square WebP for the grid — half the bytes, and already cropped to
   *  the aspect ratio the grid renders, so the browser stops downloading
   *  height it would immediately crop away. */
  thumb: string;
  alt: string;
}

/**
 * Photos of the premises — deliberately no children's faces, so the
 * public site carries no image requiring parental consent.
 */
export const GALLERY: GalleryItem[] = [
  { src: "/images/gallery/creche-01.jpg", thumb: "/images/gallery/thumbs/creche-01.webp", alt: "Salle de jeux colorée avec tapis alphabet, tente et coin lecture" },
  { src: "/images/gallery/creche-02.jpg", thumb: "/images/gallery/thumbs/creche-02.webp", alt: "Espace d'activités de la crèche" },
  { src: "/images/gallery/creche-03.jpg", thumb: "/images/gallery/thumbs/creche-03.webp", alt: "Coin jeux et jouets des enfants" },
  { src: "/images/gallery/creche-04.jpg", thumb: "/images/gallery/thumbs/creche-04.webp", alt: "Salle d'éveil de la crèche" },
  { src: "/images/gallery/creche-05.jpg", thumb: "/images/gallery/thumbs/creche-05.webp", alt: "Espace intérieur aménagé pour les tout-petits" },
  { src: "/images/gallery/creche-06.jpg", thumb: "/images/gallery/thumbs/creche-06.webp", alt: "Entrée de la crèche avec cour couverte et gazon" },
  { src: "/images/gallery/creche-07.jpg", thumb: "/images/gallery/thumbs/creche-07.webp", alt: "Espace extérieur sécurisé" },
  { src: "/images/gallery/creche-08.jpg", thumb: "/images/gallery/thumbs/creche-08.webp", alt: "Salle de repos et de sieste" },
  { src: "/images/gallery/creche-09.jpg", thumb: "/images/gallery/thumbs/creche-09.webp", alt: "Coin repas des enfants" },
  { src: "/images/gallery/creche-10.jpg", thumb: "/images/gallery/thumbs/creche-10.webp", alt: "Matériel pédagogique et jeux d'éveil" },
  { src: "/images/gallery/creche-11.jpg", thumb: "/images/gallery/thumbs/creche-11.webp", alt: "Espace de motricité" },
  { src: "/images/gallery/creche-12.jpg", thumb: "/images/gallery/thumbs/creche-12.webp", alt: "Aménagement intérieur de la crèche" },
];

export interface VideoItem {
  kind: "local" | "facebook";
  title: string;
  /** Local file path, or the Facebook plugin embed URL. */
  src: string;
  /** Portrait clips need a taller frame than landscape ones. */
  aspect: "portrait" | "landscape";
  /**
   * Still shown before playback. Without one, a video with
   * `preload="metadata"` renders as a black rectangle that looks broken.
   */
  poster?: string;
}

export const VIDEOS: VideoItem[] = [
  {
    kind: "local",
    title: "Visite de la crèche",
    src: "/images/videos/creche-presentation.mp4",
    aspect: "portrait",
    poster: "/images/gallery/creche-06.jpg",
  },
  {
    kind: "facebook",
    title: "Une journée à la crèche",
    src:
      "https://www.facebook.com/plugins/video.php?height=476" +
      "&href=https%3A%2F%2Fwww.facebook.com%2F100054364788852%2Fvideos%2F633371953122065%2F" +
      "&show_text=false&width=267&t=0",
    aspect: "portrait",
  },
];
