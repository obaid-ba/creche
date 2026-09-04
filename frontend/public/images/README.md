# Static site images

Files here are served **verbatim** at the URL matching their path, and are
not processed by Vite. Reference them with an absolute path:

    public/images/hero.jpg        ->  <img src="/images/hero.jpg" />
    public/images/gallery/a.jpg   ->  <img src="/images/gallery/a.jpg" />

Use this folder for photos of the nursery, the logo, the favicon, and the
registration PDFs — anything that is part of the public website and ships
with the code.

## Not for uploaded content

Photos of children, activity photos and message attachments are **not**
placed here. They are uploaded through the app, validated and stripped of
EXIF, and stored under `backend/media/` (git-ignored). See
docs/authentication.md §6.

## Recommended

- Hero / large photos: JPEG or WebP, ~1600px wide, compressed.
- Gallery thumbnails: ~800px wide.
- Anything with a child's face needs parental consent before it goes on
  the public site.
