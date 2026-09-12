import { Plus, Search, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { PageShell } from "@/components/app";
import {
  EmptyState,
  ErrorState,
  Input,
  LinkButton,
  LoadingState,
  Pagination,
  Select,
} from "@/components/ui";
import { AgeGroupSection } from "@/features/children/components/AgeGroupSection";
import { ChildCard } from "@/features/children/components/ChildCard";
import { useAgeGroups, useChildren } from "@/features/children/hooks";
import type { ChildListItem } from "@/features/children/types";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import type { AgeGroupKey, ChildStatus } from "@/types/api";

const STATUS_FILTERS = [
  { value: "", key: "children.active" },
  { value: "ARCHIVED", key: "children.archived" },
] as const;

/** Split a page of children into their age bands, preserving band order. */
function groupByAgeBand(
  children: ChildListItem[],
  bands: readonly { key: AgeGroupKey; label: string }[],
) {
  return bands.map((band) => ({
    ...band,
    items: children.filter((child) => child.age_group.key === band.key),
  }));
}

export function StaffChildrenPage() {
  const { t } = useTranslation();
  const [searchInput, setSearchInput] = useState("");
  const [ageGroup, setAgeGroup] = useState<AgeGroupKey | "">("");
  const [status, setStatus] = useState<ChildStatus | "">("");
  const [page, setPage] = useState(1);

  const search = useDebouncedValue(searchInput);

  const query = useChildren({
    search,
    age_group: ageGroup,
    status,
    page,
    page_size: 24,
  });
  const groupsQuery = useAgeGroups();

  const bands = useMemo(
    () =>
      (groupsQuery.data ?? []).map(({ key, label }) => ({ key, label })),
    [groupsQuery.data],
  );

  // Grouped sections only make sense when showing everything. Once a
  // filter narrows the list, a flat result list is clearer.
  const isFiltered = search !== "" || ageGroup !== "" || status !== "";
  const results = query.data?.results ?? [];
  const total = query.data?.count ?? 0;

  return (
    <PageShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-secondary-900 sm:text-[1.75rem]">
            {t("children.title")}
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            {t("children.totalCount", { count: total })}
          </p>
        </div>

        <LinkButton to="/staff/children/new">
          <Plus aria-hidden="true" className="size-4" />
          {t("children.add")}
        </LinkButton>
      </div>

      <div className="mb-6 flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1">
          <Input
            label={t("children.search")}
            type="search"
            placeholder={t("children.searchPlaceholder")}
            value={searchInput}
            onChange={(event) => {
              setPage(1);
              setSearchInput(event.target.value);
            }}
            leftIcon={<Search className="size-4" />}
          />
        </div>

        <div className="w-48">
          <Select
            label={t("children.ageGroup")}
            value={ageGroup}
            placeholder={t("children.allGroups")}
            options={(groupsQuery.data ?? []).map((group) => ({
              value: group.key,
              // The band name comes from the API already translated; only
              // the parenthesised count is assembled here.
              label: t("children.groupWithCount", {
                label: group.label,
                count: group.count,
              }),
            }))}
            onChange={(event) => {
              setPage(1);
              setAgeGroup(event.target.value as AgeGroupKey | "");
            }}
          />
        </div>

        <div className="w-40">
          <Select
            label={t("children.status")}
            value={status}
            options={STATUS_FILTERS.map((o) => ({
              value: o.value,
              label: t(o.key),
            }))}
            onChange={(event) => {
              setPage(1);
              setStatus(event.target.value as ChildStatus | "");
            }}
          />
        </div>
      </div>

      {query.isPending ? (
        <LoadingState label={t("children.loading")} />
      ) : query.isError ? (
        <ErrorState
          description={t("children.loadError")}
          onRetry={() => void query.refetch()}
        />
      ) : results.length === 0 ? (
        <EmptyState
          icon={<Users className="size-6" />}
          title={t(isFiltered ? "children.noResults" : "children.empty")}
          description={t(
            isFiltered ? "children.noResultsHint" : "children.emptyHint",
          )}
        />
      ) : isFiltered ? (
        <ul className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {results.map((child) => (
            <li key={child.id}>
              <ChildCard child={child} />
            </li>
          ))}
        </ul>
      ) : (
        groupByAgeBand(results, bands).map((band) => (
          <AgeGroupSection key={band.key} label={band.label} items={band.items} />
        ))
      )}

      {query.data !== undefined && (
        <div className="mt-6">
          <Pagination
            page={query.data.page}
            totalPages={query.data.total_pages}
            count={query.data.count}
            countLabel={t("common.child", { count: query.data.count })}
            onChange={setPage}
          />
        </div>
      )}
    </PageShell>
  );
}
