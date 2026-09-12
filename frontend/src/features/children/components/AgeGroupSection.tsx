import { useTranslation } from "react-i18next";

import type { ChildListItem } from "../types";
import { ChildCard } from "./ChildCard";

/**
 * One age band with its children, matching the staff list layout in the
 * brief (16). Rendered even when empty so the four bands keep a stable
 * order and staff always know where to look.
 *
 * The prop is `items`, not `children`: naming it `children` would shadow
 * React's own children prop and make the component confusing to use.
 */
export function AgeGroupSection({
  label,
  items,
}: {
  label: string;
  items: ChildListItem[];
}) {
  const { t } = useTranslation();
  const headingId = `group-${label.replace(/\s+/g, "-")}`;

  return (
    <section aria-labelledby={headingId} className="mb-8">
      <div className="mb-3 flex items-baseline justify-between gap-3 border-b border-ink-100 pb-2">
        <h2 id={headingId} className="font-display text-lg font-bold">
          {label}
        </h2>
        <span className="text-sm font-semibold text-ink-400">
          {t("common.child", { count: items.length })}
        </span>
      </div>

      {items.length === 0 ? (
        <p className="py-4 text-sm text-ink-400">{t("children.emptyGroup")}</p>
      ) : (
        <ul className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((child) => (
            <li key={child.id}>
              <ChildCard child={child} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
