/**
 * The Crèche Mamati mark: a baby asleep on a crescent moon, with stars.
 *
 * Drawn as vector rather than shipped as the original JPEG so it stays
 * sharp at every size, can be recoloured from the token palette, and
 * costs about 2 KB instead of 21 KB. The concept follows the existing
 * logo; the execution is simplified for small sizes — at 32px in a
 * browser tab, fine illustrative detail turns to mud.
 */
export function LogoMark({
  className,
  title,
}: {
  className?: string;
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      role={title === undefined ? "presentation" : "img"}
      aria-hidden={title === undefined}
      {...(title !== undefined ? { "aria-label": title } : {})}
    >
      <defs>
        {/* The crescent is a disc with a second disc punched out, which
            keeps the inner curve true instead of approximating it. */}
        <mask id="mamati-crescent">
          <rect width="64" height="64" fill="black" />
          <circle cx="28" cy="35" r="23" fill="white" />
          <circle cx="44" cy="24" r="20" fill="black" />
        </mask>
        <linearGradient id="mamati-moon" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--color-primary-300)" />
          <stop offset="100%" stopColor="var(--color-primary-500)" />
        </linearGradient>
      </defs>

      <circle
        cx="28"
        cy="35"
        r="23"
        fill="url(#mamati-moon)"
        mask="url(#mamati-crescent)"
      />

      {/* Baby: a large head and a simple swaddled body. Detail below
          about 3px of stroke turns to mud at navbar size, so there is
          none. */}
      <path
        d="M31 38c6.2 0 10.6 3.7 10.6 8.6S37.2 54 31 54s-10.6-2.5-10.6-7.4S24.8 38 31 38Z"
        fill="var(--color-secondary-400)"
      />
      <circle cx="34" cy="31" r="11" fill="#FBE0CE" />
      {/* Sleeping cap */}
      <path
        d="M23.4 27.5C24.1 21.4 28.9 17 35.2 17c6 0 10.8 4 11.6 9.7-3.2-2.3-7.3-3.3-11.6-2.7-4.3.6-8.2 2.5-11.4 5.2a11 11 0 0 1-.4-1.7Z"
        fill="var(--color-secondary-600)"
      />
      {/* Closed eyes and a small smile: asleep, not staring. */}
      <path
        d="M29.6 31.4a2 2 0 0 1 3.2 0M36.4 31.4a2 2 0 0 1 3.2 0"
        stroke="var(--color-secondary-900)"
        strokeWidth="1.7"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M32.6 36.4c1.2 1 3 1 4.2 0"
        stroke="var(--color-secondary-900)"
        strokeWidth="1.7"
        strokeLinecap="round"
        fill="none"
      />

      <path
        d="M53 9.5 54.6 14l4.4 1.6-4.4 1.6L53 21.7l-1.6-4.5L47 15.6l4.4-1.6L53 9.5Z"
        fill="var(--color-accent-300)"
      />
      <path
        d="M11 20.5 12.2 24l3.3 1.2-3.3 1.2L11 29.9l-1.2-3.5L6.5 25.2 9.8 24 11 20.5Z"
        fill="var(--color-secondary-300)"
      />
    </svg>
  );
}
