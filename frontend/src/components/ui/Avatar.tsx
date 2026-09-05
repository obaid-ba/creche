import { cn } from "@/lib/cn";

const SIZES = {
  sm: "size-9 text-xs",
  md: "size-11 text-sm",
  lg: "size-20 text-xl",
} as const;

/**
 * A person's photo, or their initials.
 *
 * Generic rather than child-specific: the same lockup is used for
 * guardians in the child profile and for message senders, so it does not
 * belong to the children feature.
 */
export function Avatar({
  firstName,
  lastName,
  photoUrl,
  size = "md",
  className,
}: {
  firstName: string;
  lastName: string;
  photoUrl?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();

  if (photoUrl !== null && photoUrl !== undefined && photoUrl !== "") {
    return (
      <img
        src={photoUrl}
        // Decorative: the person's name is always rendered next to it.
        alt=""
        loading="lazy"
        className={cn(
          "shrink-0 rounded-full object-cover ring-2 ring-white",
          SIZES[size],
          className,
        )}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid shrink-0 place-items-center rounded-full bg-secondary-100",
        "font-bold text-secondary-800 ring-2 ring-white",
        SIZES[size],
        className,
      )}
    >
      {initials}
    </span>
  );
}
