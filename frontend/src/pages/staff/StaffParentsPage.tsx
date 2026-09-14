import { Search, Users } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { PageShell } from "@/components/app";
import {
  Badge,
  Card,
  CardBody,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  Pagination,
} from "@/components/ui";
import { useParents } from "@/features/parents/hooks";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

const RELATIONSHIP_KEYS: Record<string, string> = {
  MOTHER: "form.mother",
  FATHER: "form.father",
  GUARDIAN: "form.guardian",
  OTHER: "form.other",
};

export function StaffParentsPage() {
  const { t } = useTranslation();
  const [searchInput, setSearchInput] = useState("");
  const [onlyUnlinked, setOnlyUnlinked] = useState(false);
  const [page, setPage] = useState(1);

  const search = useDebouncedValue(searchInput);
  const query = useParents({
    search,
    page,
    ...(onlyUnlinked ? { unlinked: "true" } : {}),
  });

  const rows = query.data?.results ?? [];

  return (
    <PageShell size="wide">
      <h1 className="font-display text-2xl font-extrabold text-secondary-900 sm:text-[1.75rem]">
        {t("parents.title")}
      </h1>
      <p className="mt-1 text-sm text-ink-500">
        {t("parents.count", { count: query.data?.count ?? 0 })}
      </p>

      <div className="mt-6 flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1">
          <Input
            label={t("parents.search")}
            type="search"
            placeholder={t("parents.searchPlaceholder")}
            value={searchInput}
            onChange={(event) => {
              setPage(1);
              setSearchInput(event.target.value);
            }}
            leftIcon={<Search className="size-4" />}
          />
        </div>

        <label className="flex h-11 items-center gap-2 rounded-card border border-ink-200 bg-shell px-3.5 text-sm font-semibold text-ink-700">
          <input
            type="checkbox"
            checked={onlyUnlinked}
            onChange={(event) => {
              setPage(1);
              setOnlyUnlinked(event.target.checked);
            }}
            className="size-4 rounded"
          />
          {t("parents.onlyUnlinked")}
        </label>
      </div>

      <div className="mt-6">
        {query.isPending ? (
          <LoadingState label={t("parents.loading")} />
        ) : query.isError ? (
          <ErrorState
            description={t("parents.loadError")}
            onRetry={() => void query.refetch()}
          />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<Users className="size-6" />}
            title={t("parents.empty")}
            description={t(
              search !== "" || onlyUnlinked
                ? "parents.emptySearchHint"
                : "parents.emptyHint",
            )}
          />
        ) : (
          <ul className="space-y-3">
            {rows.map((parent) => (
              <li key={parent.id}>
                <Card>
                  <CardBody className="flex flex-wrap items-start gap-4">
                    <div className="min-w-48 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-bold text-ink-900">
                          {parent.first_name} {parent.last_name}
                        </p>
                        {!parent.is_active && (
                          <Badge tone="neutral">
                            {t("parents.accountDisabled")}
                          </Badge>
                        )}
                      </div>

                      <p className="mt-0.5 text-sm text-ink-500">
                        {parent.email}
                        {parent.phone !== "" && ` · ${parent.phone}`}
                      </p>

                      {parent.children.length === 0 ? (
                        <p className="mt-2 text-sm text-ink-400">
                          {t("parents.noChildLinked")}
                        </p>
                      ) : (
                        <ul className="mt-2 flex flex-wrap gap-2">
                          {parent.children.map((child) => (
                            <li key={child.id}>
                              <Link
                                to={`/staff/children/${child.id}`}
                                className="inline-flex items-center gap-1.5 rounded-pill bg-secondary-100 px-2.5 py-1 text-xs font-semibold text-secondary-800 hover:bg-secondary-200"
                              >
                                {child.first_name}
                                {/* A tint here (opacity-75) fell below the
                                    4.5:1 AA threshold; secondary-700 on
                                    secondary-100 clears it. */}
                                <span className="font-normal text-secondary-700">
                                  {/* An unknown key resolves to itself,
                                      so an enum the client does not know
                                      renders as its raw value rather
                                      than disappearing. */}
                                  {t(
                                    RELATIONSHIP_KEYS[child.relationship] ??
                                      child.relationship,
                                  )}
                                </span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </CardBody>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>

      {query.data !== undefined && (
        <div className="mt-6">
          <Pagination
            page={query.data.page}
            totalPages={query.data.total_pages}
            count={query.data.count}
            countLabel={t("parents.count", { count: query.data.count })}
            onChange={setPage}
          />
        </div>
      )}
    </PageShell>
  );
}
