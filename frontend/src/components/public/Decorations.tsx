import { cn } from "@/lib/cn";

/**
 * The scattered drawings that make the page feel like a nursery: a sun,
 * a cloud, hearts, sparkles, a leaf, a dashed flight path.
 *
 * All are `aria-hidden` and pointer-transparent — they carry no meaning
 * and must never land in the tab order or be read aloud. They also stay
 * sparse on purpose: the brief asks for decoration that supports the
 * design, and a page covered in cartoon clip-art reads as a toy rather
 * than as somewhere you would leave your child.
 */

type DecorProps = { className?: string };

export function Sun({ className }: DecorProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <circle cx="32" cy="32" r="13" fill="var(--color-accent-300)" />
      <g
        stroke="var(--color-accent-300)"
        strokeWidth="3.2"
        strokeLinecap="round"
      >
        <path d="M32 6v6M32 52v6M6 32h6M52 32h6M13 13l4.2 4.2M46.8 46.8 51 51M51 13l-4.2 4.2M17.2 46.8 13 51" />
      </g>
      <path
        d="M27 31.5a1.7 1.7 0 0 1 3 0M34 31.5a1.7 1.7 0 0 1 3 0"
        stroke="var(--color-accent-700)"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M29 36.5c1.7 1.6 4.3 1.6 6 0"
        stroke="var(--color-accent-700)"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

export function Cloud({ className }: DecorProps) {
  return (
    <svg viewBox="0 0 80 44" className={className} aria-hidden="true">
      <path
        d="M20 38c-7.2 0-13-5.4-13-12S12.8 14 20 14c1.3 0 2.6.2 3.8.6C26.4 8.3 32.8 4 40.2 4 50 4 58 11.5 58 20.8c0 .6 0 1.2-.1 1.8 5.1.7 9.1 4.9 9.1 10 0 5.6-4.8 10-10.7 10H20Z"
        fill="none"
        stroke="var(--color-sky-300)"
        strokeWidth="2.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Heart({ className }: DecorProps) {
  return (
    <svg viewBox="0 0 32 30" className={className} aria-hidden="true">
      <path
        d="M16 28C7 21.6 2 16.4 2 10.8 2 6 5.6 2.5 10 2.5c2.5 0 4.8 1.2 6 3.2 1.2-2 3.5-3.2 6-3.2 4.4 0 8 3.5 8 8.3C30 16.4 25 21.6 16 28Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function Sparkle({ className }: DecorProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M12 1.5 14 9l7.5 2-7.5 2-2 7.5-2-7.5L2.5 11 10 9l2-7.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function Leaf({ className }: DecorProps) {
  return (
    <svg viewBox="0 0 40 48" className={className} aria-hidden="true">
      <path
        d="M20 46C20 30 12 20 4 14"
        stroke="var(--color-mint-300)"
        strokeWidth="2.6"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M13 26c-5-1-8-5-8-10 5-1 9 1.5 10.5 6.5M20 34c4.5-2.4 6.6-7 5.6-12-5 .6-8.4 3.8-8.8 9"
        fill="var(--color-mint-300)"
      />
    </svg>
  );
}

/** A dashed flight path with a small paper plane — used once, near a CTA. */
export function FlightPath({ className }: DecorProps) {
  return (
    <svg viewBox="0 0 120 60" className={className} aria-hidden="true">
      <path
        d="M4 52C20 52 34 44 44 32S66 8 88 12"
        stroke="var(--color-secondary-300)"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeDasharray="5 7"
        fill="none"
      />
      <path
        d="m92 4 18 9-18 9 4-9-4-9Z"
        fill="var(--color-secondary-400)"
      />
    </svg>
  );
}

/**
 * Positions a decoration absolutely and keeps it out of the way of both
 * pointers and assistive technology.
 */
export function Decor({
  children,
  className,
  float = false,
}: {
  children: React.ReactNode;
  className?: string;
  float?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute select-none",
        float && "motion-safe:animate-[decor-float_6s_ease-in-out_infinite]",
        className,
      )}
    >
      {children}
    </span>
  );
}
