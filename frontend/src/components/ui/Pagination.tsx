import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "./Button";

export function Pagination({
  page,
  totalPages,
  count,
  onChange,
}: {
  page: number;
  totalPages: number;
  count: number;
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-between gap-4 border-t border-ink-100 pt-4"
    >
      <p className="text-sm text-ink-500" aria-live="polite">
        Page {page} sur {totalPages} · {count} enfant{count === 1 ? "" : "s"}
      </p>

      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          leftIcon={<ChevronLeft className="size-4" />}
        >
          Précédent
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
          rightIcon={<ChevronRight className="size-4" />}
        >
          Suivant
        </Button>
      </div>
    </nav>
  );
}
