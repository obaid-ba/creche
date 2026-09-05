import { Plus, Search, Users } from "lucide-react";
import { useMemo, useState } from "react";

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
  { value: "", label: "Actifs" },
  { value: "ARCHIVED", label: "Archivés" },
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
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Enfants</h1>
          <p className="mt-1 text-sm text-ink-500">
            {total} enfant{total === 1 ? "" : "s"} au total
          </p>
        </div>

        <LinkButton to="/staff/children/new">
          <Plus aria-hidden="true" className="size-4" />
          Ajouter un enfant
        </LinkButton>
      </div>

      <div className="mb-6 flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1">
          <Input
            label="Rechercher"
            type="search"
            placeholder="Nom ou prénom…"
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
            label="Groupe d'âge"
            value={ageGroup}
            placeholder="Tous les groupes"
            options={(groupsQuery.data ?? []).map((group) => ({
              value: group.key,
              label: `${group.label} (${group.count})`,
            }))}
            onChange={(event) => {
              setPage(1);
              setAgeGroup(event.target.value as AgeGroupKey | "");
            }}
          />
        </div>

        <div className="w-40">
          <Select
            label="Statut"
            value={status}
            options={STATUS_FILTERS.map((o) => ({ value: o.value, label: o.label }))}
            onChange={(event) => {
              setPage(1);
              setStatus(event.target.value as ChildStatus | "");
            }}
          />
        </div>
      </div>

      {query.isPending ? (
        <LoadingState label="Chargement des enfants…" />
      ) : query.isError ? (
        <ErrorState
          description="Impossible de charger la liste des enfants."
          onRetry={() => void query.refetch()}
        />
      ) : results.length === 0 ? (
        <EmptyState
          icon={<Users className="size-6" />}
          title={isFiltered ? "Aucun résultat" : "Aucun enfant enregistré"}
          description={
            isFiltered
              ? "Essayez de modifier votre recherche ou vos filtres."
              : "Commencez par ajouter le premier enfant de la crèche."
          }
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
            onChange={setPage}
          />
        </div>
      )}
    </div>
  );
}
