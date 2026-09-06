# Crèche Mamati — Design Audit

> 2026-09-06 · Written before any redesign work, against the reference in
> `docs/design-reference/brand-mockup.png`.

---

## 1. Current architecture

Sound, and worth keeping. The redesign is a visual layer over it, not a
rewrite.

| Area | State |
| --- | --- |
| Stack | React 19 · TypeScript strict · Vite 6 · Tailwind v4 |
| Design tokens | 55, already in `@theme` in `src/index.css` |
| UI primitives | 20 in `components/ui/` — Button, Input, Select, Card, Modal, Drawer, Table, Tabs, Toast, … |
| Public components | **2** (`GalleryGrid`, `VideoEmbed`) |
| Routing | `routeTable` exported, route/nav consistency covered by tests |
| Backend | 489 tests, 97% coverage — **untouched by this work** |
| Animation library | none installed |

**API contracts stay exactly as they are.** Nothing in this redesign
requires a backend change.

---

## 2. Visual problems, and why the site reads as generic

### 2.1 The fonts were never loaded — the single biggest cause

`--font-display: "Baloo 2"` and `--font-sans: "Nunito"` are declared as
tokens and applied to `body` and `h1–h4`, but **no webfont is ever
requested**: there is no `<link>` to Google Fonts, no `@font-face`, no
bundled file. Every heading has been rendering in the system UI fallback
since Phase 1.

The brief asks for "rounded, expressive, friendly" headings. The site has
been showing the same neutral grotesque as every other site on the
machine. This alone accounts for much of the "static and generic" feeling.

### 2.2 Everything is a rectangle

Hero image, gallery tiles, value cards, section bands — all
`rounded-card` (1rem) rectangles on a flat background. The reference is
built on **organic shapes**: an asymmetric blob for the hero image, a
curved band edge under it, a purple shape peeking out behind.

### 2.3 The landing page is one 380-line component

`HomePage.tsx` holds hero, values, services, gallery, videos, testimonials
and contact inline. Brief §26 forbids huge components; §20 asks for a
`components/public/` folder. There is nowhere to put a section, so every
new one grows the same file.

### 2.4 No decorative layer at all

The reference has a sun, a cloud, hearts, sparkles, a dashed arrow, a
small green curve. The current page has none — which is why it reads as a
business template rather than a nursery.

### 2.5 The palette is close but muted and misapplied

Current primary `#c74a25` is a **terracotta**, not the coral the brief
and reference call for. Headings use warm grey `--color-ink-900`
(`#1a1714`) rather than the deep purple the reference uses. Purple exists
only as a "secondary teal" — there is no purple in the system at all.

### 2.6 No asset structure

Images live in `public/images/` referenced by string paths in
`config/nursery.ts`. §21 asks for `src/assets/{brand,hero,gallery,…}` so
the logo is replaceable in one place.

---

## 3. Reusable as-is

All 20 UI primitives. They are token-driven, so **retuning the tokens
restyles every one of them at once** — no call-site changes. This is why
the redesign is affordable.

Also keep: `GalleryGrid` (lightbox logic is good; only the layout changes),
`VideoEmbed` (the click-to-load Facebook facade is a privacy decision
worth preserving), all routing, guards, and feature modules.

---

## 4. To redesign

| Component | Why |
| --- | --- |
| `index.css` tokens | new palette, real fonts, organic radii, softer shadows |
| `PublicLayout` navbar | flat full-width bar → floating rounded pill |
| `HomePage` | split into `components/public/` sections |
| Hero | rectangle → organic blob + floating cards + decorations |
| Values | four identical cards → icon-led row with tinted shapes |
| `GalleryGrid` | even grid → editorial masonry with varied sizes |
| `Logo` | raster `.jpg` → SVG mark with proper variants |
| Footer | one copyright line → full brand footer |

---

## 5. Missing entirely

- A brand mark as **vector** (currently a 21 KB JPEG photo of a logo)
- `SectionHeading`, `Container`, `IconButton`, `Blob`, `Decorations`
- A "Une journée chez Mamati" timeline teaser (§11)
- A parent-portal preview mock (§12)
- An activities section (§14)
- Scroll animations, honouring `prefers-reduced-motion`

---

## 6. Design system to adopt

Sampled directly from the reference mockup:

| Role | Value | Where it appears in the reference |
| --- | --- | --- |
| Coral (primary) | `#F5486A` / `#FB718E` | "sourire chaque jour", CTAs, "Espace parents" |
| Deep purple (ink) | `#2B144F` | "Grandir, s'éveiller" — headings, body ink |
| Purple (secondary) | `#9B74C8`, `#6939A3` | "Nous contacter", logo "Mamati" |
| Purple tint | `#C8ADE1` | the blob behind the hero image |
| Yellow (accent) | `#FDD05F` | sun, "Éveil" star |
| Sky tint | `#E3F1FD` | "Sécurité" icon field |
| Mint tint | `#EFF9EF` | "Transparence" icon field |
| Pink tint | `#FEDDE2` | "Bienveillance" icon field |
| Cream | `#FDF8F6` → `#FFFBF9` | page and hero ground |

**Typography.** Baloo 2 for display, Nunito for body — the two the tokens
already name, this time actually loaded, self-hosted rather than
hot-linked so no third party sees a visitor's IP on a nursery site.

**Shape.** Organic radii (`42% 58% 63% 37% / …`) for hero and decorative
forms; pill radii for controls; softer, warmer shadows than the current
neutral grey.

---

## 7. Implementation plan

| Phase | Scope | Verify |
| --- | --- | --- |
| 1 | Tokens, fonts, `Container`/`SectionHeading`/`Blob`/`Decorations` | typecheck, existing tests still green |
| 2 | SVG logo + variants, favicon, navbar & footer branding | logo renders at all five sizes |
| 3 | Landing page split into `components/public/`, all sections rebuilt | axe clean, no component over ~150 lines |
| 4 | Responsive — hero, navbar, gallery, timeline get real mobile layouts | 360 / 768 / 1280 screenshots |
| 5 | Scroll and hover animation, `prefers-reduced-motion` respected | reduced-motion honoured |
| 6–8 | Carry the brand into auth, parent and staff areas | visual consistency across all three |

**Constraint held throughout:** 489 backend and 144 frontend tests must
stay green, and no working behaviour may be removed for visual reasons.
