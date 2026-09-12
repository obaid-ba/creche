import { AlertTriangle, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui";

import type { ChildListItem } from "../types";
import { ChildAvatar } from "./ChildAvatar";

export function ChildCard({ child }: { child: ChildListItem }) {
  const hasAllergies = child.allergies.trim() !== "";

  return (
    <Link
      to={`/staff/children/${child.id}`}
      className="flex items-center gap-3 rounded-card bg-shell p-3 shadow-soft transition-all hover:bg-primary-50/50 hover:shadow-lifted"
    >
      <ChildAvatar
        firstName={child.first_name}
        lastName={child.last_name}
        photoUrl={child.photo_url}
      />

      <div className="min-w-0 flex-1">
        <p className="truncate font-bold text-ink-900">{child.full_name}</p>
        <p className="mt-0.5 text-xs text-ink-500">{child.age_display}</p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {hasAllergies && (
          // Allergy information is safety-critical, so it is visible at a
          // glance in the list rather than only on the profile.
          <Badge tone="warning">
            <AlertTriangle aria-hidden="true" className="me-1 size-3" />
            Allergies
          </Badge>
        )}
        {child.status === "ARCHIVED" && <Badge tone="neutral">Archivé</Badge>}
        <ChevronRight aria-hidden="true" className="size-4 text-ink-300" />
      </div>
    </Link>
  );
}
