/**
 * Real nursery details, in one place.
 *
 * Contact details and the media manifest live here rather than being
 * scattered through components, so updating a phone number or adding a
 * photo is a one-line change.
 */

export const NURSERY = {
  name: "Crèche Mamati",

  /** Transparent PNG, so the disc reads correctly on any background. */
  logo: "/logo-512.png",

  // Tunisian mobile. `tel:` needs the international form; the display
  // string keeps the local grouping people recognise.
  phone: { display: "99 389 262", href: "tel:+21699389262" },

  facebook: "https://www.facebook.com/profile.php?id=100054364788852",

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

export interface GalleryItem {
  src: string;
  alt: string;
}

/**
 * Photos of the premises — deliberately no children's faces, so the
 * public site carries no image requiring parental consent.
 */
export const GALLERY: GalleryItem[] = [
  { src: "/images/gallery/creche-01.jpg", alt: "Salle de jeux colorée avec tapis alphabet, tente et coin lecture" },
  { src: "/images/gallery/creche-02.jpg", alt: "Espace d'activités de la crèche" },
  { src: "/images/gallery/creche-03.jpg", alt: "Coin jeux et jouets des enfants" },
  { src: "/images/gallery/creche-04.jpg", alt: "Salle d'éveil de la crèche" },
  { src: "/images/gallery/creche-05.jpg", alt: "Espace intérieur aménagé pour les tout-petits" },
  { src: "/images/gallery/creche-06.jpg", alt: "Entrée de la crèche avec cour couverte et gazon" },
  { src: "/images/gallery/creche-07.jpg", alt: "Espace extérieur sécurisé" },
  { src: "/images/gallery/creche-08.jpg", alt: "Salle de repos et de sieste" },
  { src: "/images/gallery/creche-09.jpg", alt: "Coin repas des enfants" },
  { src: "/images/gallery/creche-10.jpg", alt: "Matériel pédagogique et jeux d'éveil" },
  { src: "/images/gallery/creche-11.jpg", alt: "Espace de motricité" },
  { src: "/images/gallery/creche-12.jpg", alt: "Aménagement intérieur de la crèche" },
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
