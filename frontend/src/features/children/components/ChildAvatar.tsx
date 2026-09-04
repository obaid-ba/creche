import { cn } from "@/lib/cn";

/** Photo when present, otherwise initials — never a broken image. */
export function ChildAvatar({
  firstName,
  lastName,
  photoUrl,
  size = "md",
  className,
}: {
  firstName: string;
  lastName: string;
  photoUrl?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizes = {
    sm: "size-9 text-xs",
    md: "size-11 text-sm",
    lg: "size-20 text-xl",
  } as const;

  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();

  if (photoUrl !== null && photoUrl !== undefined && photoUrl !== "") {
    return (
      <img
        src={photoUrl}
        alt=""
        loading="lazy"
        className={cn(
          "shrink-0 rounded-full object-cover ring-2 ring-white",
          sizes[size],
          className,
        )}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid shrink-0 place-items-center rounded-full bg-secondary-100 font-bold text-secondary-700 ring-2 ring-white",
        sizes[size],
        className,
      )}
    >
      {initials}
    </span>
  );
}
