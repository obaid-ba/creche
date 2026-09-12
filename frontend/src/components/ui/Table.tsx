import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export interface Column<T> {
  key: string;
  header: ReactNode;
  /** Cell renderer; receives the whole row. */
  cell: (row: T) => ReactNode;
  /** Hide below the sm breakpoint, for columns that do not fit a phone. */
  hideOnMobile?: boolean;
  align?: "left" | "right";
}

/**
 * A data table that stays usable on a phone.
 *
 * The wrapper scrolls horizontally rather than letting the page do so —
 * a body-level horizontal scrollbar is the classic responsive failure,
 * and `docs/architecture.md` calls it out explicitly.
 */
export function Table<T>({
  columns,
  rows,
  getRowKey,
  onRowClick,
  emptyMessage = "Aucun résultat.",
  caption,
}: {
  columns: readonly Column<T>[];
  rows: readonly T[];
  getRowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  caption?: string;
}) {
  if (rows.length === 0) {
    return <p className="py-8 text-center text-sm text-ink-500">{emptyMessage}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        {caption !== undefined && <caption className="sr-only">{caption}</caption>}

        <thead>
          <tr className="border-b border-ink-200">
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cn(
                  "px-3 py-2.5 text-xs font-bold uppercase tracking-wide text-ink-500",
                  column.align === "right" ? "text-end" : "text-start",
                  column.hideOnMobile === true && "hidden sm:table-cell",
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => (
            <tr
              key={getRowKey(row)}
              onClick={onRowClick === undefined ? undefined : () => onRowClick(row)}
              className={cn(
                "border-b border-ink-100 last:border-0",
                onRowClick !== undefined && "cursor-pointer hover:bg-ink-50",
              )}
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={cn(
                    "px-3 py-3 text-ink-700",
                    column.align === "right" ? "text-end" : "text-start",
                    column.hideOnMobile === true && "hidden sm:table-cell",
                  )}
                >
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
