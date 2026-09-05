import { Avatar } from "@/components/ui";

/**
 * A child's avatar.
 *
 * Kept as a named wrapper so call sites read clearly, but the lockup
 * itself lives in the design system — it is also used for guardians and
 * message senders, so it is not child-specific.
 */
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
  return (
    <Avatar
      firstName={firstName}
      lastName={lastName}
      {...(photoUrl !== undefined ? { photoUrl } : {})}
      size={size}
      {...(className !== undefined ? { className } : {})}
    />
  );
}
